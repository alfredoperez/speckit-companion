/**
 * Content-aware completion detection for spec workflow steps.
 *
 * Spec 099: the footer's "Generating…" state needs to know whether a running
 * step has actually produced its artifact, not just whether `.spec-context.json`
 * optimistically recorded a `startedAt`. This guards against empty or
 * half-written files so the forward button stays disabled until real content
 * lands. Scope is strictly the button render state — the canonical badge/status
 * derivation (spec 060) still uses `.spec-context.json` only.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileNames, WorkflowSteps } from '../../core/constants';
import type { StepName } from '../../core/types/specContext';

/** Maps a step name to the markdown artifact it produces, if any. */
const STEP_ARTIFACT: Partial<Record<StepName, string>> = {
    [WorkflowSteps.SPECIFY]: FileNames.specFile,
    [WorkflowSteps.PLAN]: FileNames.planFile,
    [WorkflowSteps.TASKS]: FileNames.tasksFile,
};

/** Minimum non-whitespace body length (after frontmatter strip) to count as real. */
const MIN_BODY_CHARS = 40;

/** Strip a leading YAML frontmatter block (`---\n…\n---`). */
function stripFrontmatter(text: string): string {
    const m = text.match(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return m ? text.slice(m[0].length) : text;
}

/**
 * True when `{step}.md` exists in `specDir` and holds non-trivial content.
 *
 * "Non-trivial" = after stripping frontmatter and surrounding whitespace the
 * body either contains a markdown heading or clears `MIN_BODY_CHARS`. A missing
 * file, an empty file, a whitespace-only file, or a frontmatter-only stub all
 * return `false`.
 *
 * The `implement` step has no single artifact (its readiness is task-progress
 * driven) — callers handle it separately, so an unknown step returns `false`.
 */
export async function hasNonTrivialArtifact(
    specDir: string,
    step: string,
): Promise<boolean> {
    const filename = STEP_ARTIFACT[step as StepName];
    if (!filename) return false;

    let raw: string;
    try {
        raw = await fs.promises.readFile(path.join(specDir, filename), 'utf-8');
    } catch {
        return false; // missing / unreadable
    }

    const body = stripFrontmatter(raw).trim();
    if (body.length === 0) return false;
    if (/^#{1,6}\s+\S/m.test(body)) return true; // has a real heading
    return body.replace(/\s/g, '').length >= MIN_BODY_CHARS;
}
