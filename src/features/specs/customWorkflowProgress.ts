/**
 * File-driven progression for custom workflows.
 *
 * Built-in spec-kit / Companion workflows advance because their commands emit
 * capture context (`startStep`/`completeStep` writing `.spec-context.json`).
 * A user's own workflow — any skill set wired through `speckit.customWorkflows` —
 * runs commands that just write markdown to disk
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
 * A workflow is "custom" for progression purposes when ANY of its steps —
 * navigable or action-only — carries a name outside the spec-kit lifecycle set.
 * Action-only steps count too: a workflow like GSD (discuss → plan → execute →
 * verify) has custom action-only steps (discuss/execute/verify) but its one
 * navigable step reuses the lifecycle name `plan`. Looking only at navigable
 * steps would misread that as a built-in workflow and strand its progression.
 * Built-in workflows use lifecycle names for every step, so they stay non-custom
 * and are left entirely to the capture-context machinery.
 */
export function isCustomWorkflow(steps: WorkflowStepConfig[] | undefined): boolean {
    if (!steps) return false;
    return steps.some(s => !STEP_NAMES.includes(s.name as StepName));
}

const CORE_DOCS = ['spec.md', 'plan.md', 'tasks.md'];

/**
 * Every `.md` in the spec dir (recursively, hidden dirs skipped) that no step
 * claims as its own file and isn't a lifecycle core doc. This is the same
 * "related docs" set the Living Specs computes — the files a step marked
 * `includeRelatedDocs` produces when its output doesn't match a fixed name
 * (GSD's `gsd-plan-phase` writes `01-01-PLAN.md`, not `plan.md`).
 */
function relatedDocsPresent(specDir: string, allSteps: WorkflowStepConfig[]): boolean {
    const claimed = new Set<string>();
    for (const s of allSteps) {
        claimed.add(getStepFile(s));
        for (const f of s.subFiles ?? []) claimed.add(f);
    }
    let found = false;
    const scan = (dir: string, rel: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch { return; }
        for (const e of entries) {
            if (found) return;
            if (e.name.startsWith('.')) continue;
            const entryRel = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) {
                scan(path.join(dir, e.name), entryRel);
            } else if (e.isFile() && e.name.endsWith('.md')) {
                if (!rel && (CORE_DOCS.includes(e.name) || claimed.has(e.name))) continue;
                if (claimed.has(entryRel)) continue;
                found = true;
                return;
            }
        }
    };
    scan(specDir, '');
    return found;
}

/**
 * Has this step produced its output on disk? Mirrors the existence rules the
 * Living Specs already uses: the step's own `file`, any explicit `subFiles`,
 * any `.md` under its `subDir` (a tickets step's `issues/NN-*.md`), or — when the
 * step is marked `includeRelatedDocs` — any related `.md` in the spec dir that no
 * step claims (GSD's plan phase writes `01-01-PLAN.md`, not `plan.md`).
 * `actionOnly` steps (no output file, e.g. implement) always read false.
 *
 * `allSteps` is needed only to resolve related-doc ownership; it may be omitted
 * for the file/subFile/subDir checks.
 */
export function stepHasOutput(
    specDir: string,
    step: WorkflowStepConfig,
    allSteps?: WorkflowStepConfig[]
): boolean {
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
    if (step.includeRelatedDocs && allSteps && relatedDocsPresent(specDir, allSteps)) {
        return true;
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
 *  - no step output exists yet (nothing to advance to), or
 *  - the recorded `currentStep` is already at or past the furthest produced
 *    step (a capturing custom workflow, or nothing new on disk — we never
 *    regress or override genuine progression).
 *
 * We advance only when the files on disk are FURTHER ALONG than the context.
 * This matters because the extension's own forward button writes lifecycle
 * bookkeeping (e.g. a lone `specify complete`) but never records the custom
 * steps a third-party command produced — so `currentStep` sticks at `specify`
 * even after the tickets folder fills up. History being non-empty is therefore
 * NOT a signal to leave it alone.
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
    const base = ctx as SpecContext;

    const nav = steps.filter(s => !s.actionOnly);
    let lastProduced = -1;
    for (let i = 0; i < nav.length; i++) {
        if (hasOutput(nav[i])) lastProduced = i;
    }
    if (lastProduced < 0) return ctx;

    // Synthesize when disk is AHEAD of the recorded position, or when the
    // context has no history at all (a selection stub — without a synthetic
    // start entry the entry step could never surface its forward button).
    // A capturing workflow at the same position keeps its real history.
    // A currentStep that isn't a nav step (findIndex -1) counts as "behind
    // everything", so any produced output moves it forward.
    const currentIdx = nav.findIndex(s => s.name === base.currentStep);
    const hasHistory = (base.history?.length ?? 0) > 0;
    if (lastProduced <= currentIdx && hasHistory) return ctx;
    if (lastProduced < currentIdx) return ctx;

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
