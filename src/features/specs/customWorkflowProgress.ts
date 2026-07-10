/**
 * File-driven progression for custom workflows.
 *
 * Built-in spec-kit / Companion workflows advance because their commands emit
 * capture context (`startStep`/`completeStep` writing `.spec-context.json`).
 * A user's own workflow — Matt Pocock's skills, GSD, anything wired through
 * `speckit.customWorkflows` — runs commands that just write markdown to disk
 * and never touch the context file. Its `.spec-context.json` is a stub the
 * extension wrote on first selection (`currentStep: "specify"`, `history: []`)
 * and never updates, so the spec viewer's forward button never appears and the
 * run is stranded at specify.
 *
 * This module reconstructs the progression the missing hooks would have
 * recorded, from the one signal a non-capturing workflow does leave behind:
 * the step output files on disk. It is a no-op for workflows that DO emit
 * context (their real history wins) and for the built-in lifecycle workflows,
 * so the spec-kit / Companion paths are provably untouched.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecContext, HistoryEntry, StepName, STEP_NAMES } from '../../core/types/specContext';
import type { WorkflowStepConfig } from '../workflows/types';
import { getStepFile } from '../workflows/workflowManager';

/**
 * A workflow is "custom" for progression purposes when it has a navigable step
 * whose name isn't one of the spec-kit lifecycle steps. Built-in workflows use
 * only lifecycle names and are left entirely to the capture-context machinery.
 */
export function isCustomWorkflow(steps: WorkflowStepConfig[] | undefined): boolean {
    if (!steps) return false;
    return steps.some(s => !s.actionOnly && !STEP_NAMES.includes(s.name as StepName));
}

/**
 * Has this step produced its output on disk? Mirrors the existence rules the
 * Spec Explorer already uses: the step's own `file`, any explicit `subFiles`,
 * or any `.md` under its `subDir` (Matt's `issues/NN-*.md`, for instance).
 * `actionOnly` steps (no output file, e.g. implement) always read false.
 */
export function stepHasOutput(specDir: string, step: WorkflowStepConfig): boolean {
    if (step.actionOnly) return false;
    try {
        if (fs.existsSync(path.join(specDir, getStepFile(step)))) return true;
    } catch { /* fall through */ }
    for (const f of step.subFiles ?? []) {
        try {
            if (fs.existsSync(path.join(specDir, f))) return true;
        } catch { /* skip */ }
    }
    if (step.subDir) {
        try {
            const dir = path.join(specDir, step.subDir);
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.isFile() && e.name.endsWith('.md')) return true;
                if (e.isDirectory()) {
                    if (fs.existsSync(path.join(dir, e.name, getStepFile(step)))) return true;
                }
            }
        } catch { /* skip */ }
    }
    return false;
}

/**
 * Rebuild `currentStep` + a synthetic `history` for a custom workflow from the
 * step outputs on disk, so the pure viewer/footer derivation lights up the
 * forward button and the Approve dispatch targets the right next step.
 *
 * Returns `ctx` unchanged when:
 *  - the workflow isn't custom (built-in lifecycle — untouched), or
 *  - the context already carries real history (a capturing custom workflow
 *    wins — we never overwrite genuine progression), or
 *  - no step output exists yet (nothing to advance to).
 *
 * The synthesized `history` is a sequence of `start` transitions, one per
 * produced navigable step in order. `deriveStepHistory` turns that into the
 * expected per-step `startedAt`/`completedAt` shape: every produced step but
 * the last reads complete, and the last (the new `currentStep`) reads in
 * flight — exactly the state that surfaces Approve labeled with the next step.
 */
export function synthesizeCustomProgress<T extends SpecContext | null>(
    ctx: T,
    steps: WorkflowStepConfig[] | undefined,
    hasOutput: (step: WorkflowStepConfig) => boolean
): T {
    if (!ctx || !steps || !isCustomWorkflow(steps)) return ctx;
    if ((ctx.history?.length ?? 0) > 0) return ctx;

    const nav = steps.filter(s => !s.actionOnly);
    let lastProduced = -1;
    for (let i = 0; i < nav.length; i++) {
        if (hasOutput(nav[i])) lastProduced = i;
    }
    if (lastProduced < 0) return ctx;
    // narrowed to non-null SpecContext past the guards above
    const base = ctx as SpecContext;

    // Deterministic synthetic timestamps — order is what deriveStepHistory
    // reads, not wall-clock; a fixed epoch keeps renders reproducible.
    const at = (i: number): string => new Date(i * 1000).toISOString();
    const history: HistoryEntry[] = [];
    for (let i = 0; i <= lastProduced; i++) {
        history.push({
            step: nav[i].name as StepName,
            substep: null,
            kind: 'start',
            by: 'derive',
            at: at(i),
        });
    }

    return {
        ...base,
        currentStep: nav[lastProduced].name as StepName,
        status: base.status,
        history,
    } as T;
}
