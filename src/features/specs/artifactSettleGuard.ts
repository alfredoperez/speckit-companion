/**
 * Pure decision: should the always-on artifact watcher settle a `specify` or
 * `plan` step from its artifact (`spec.md` / `plan.md`) going quiet?
 *
 * Issue #324 — in a stock SpecKit project (no companion spec-kit extension),
 * `specify` finishes writing `spec.md` but `.spec-context.json` never advances
 * to `specified`. The completing transition is recorded only by the companion
 * `after_specify`/`after_plan` hooks (absent in stock), a terminal-exit tracker
 * (no signal for panel/chat dispatch), or a footer click (suppressed while the
 * status is the in-flight `specifying`). So the spec sticks forever and the only
 * way forward is editing `.spec-context.json` by hand.
 *
 * `implement` already has a mode-agnostic settle (the `tasks.md` watcher closes
 * it from "every task checked"). This is the same move for the two earlier
 * artifact steps, decided as a pure function so it is testable without a live
 * `vscode` watcher — no extension/runtime deps.
 *
 * Unlike `tasks.md` (where "all boxes checked" is a content-level done signal),
 * `spec.md`/`plan.md` simply existing is NOT "done" — they are written
 * incrementally while the step is still running. The watcher therefore only
 * calls this AFTER the artifact has been quiet for a stability window; this
 * guard adds the state-level conditions on top.
 */

import { lastEntryIsCompletionFor } from './historyHelpers';
import { isTerminalStatus } from './stepHistoryDerivation';

/** The artifact-backed steps this guard settles, mapped to their in-flight status. */
export const ARTIFACT_SETTLE_STEPS = {
    specify: 'specifying',
    plan: 'planning',
} as const;

export type ArtifactSettleStep = keyof typeof ARTIFACT_SETTLE_STEPS;

/** The minimal recorded-context shape the guard reads. */
export interface ArtifactSettleContext {
    currentStep?: string;
    status?: string;
    history?: Array<{ step?: string; substep?: string | null; task?: string | null; kind?: string }>;
}

/**
 * True iff the watcher should now write the terminal close for `step`.
 *
 * All of the following must hold:
 *   - The spec is not terminal (`implemented`/`completed`/`archived`) — never
 *     regress a finished spec.
 *   - The spec is sitting ON this step: `currentStep === step`. A fast-path spec
 *     that folded `plan`/`tasks` into `specify` has already moved `currentStep`
 *     past `specify`, so its `plan.md`/`spec.md` writes never settle here.
 *   - The step is genuinely in flight: `status` is the in-progress form for the
 *     step (`specifying` / `planning`). This is precisely the stuck state. Once
 *     a companion hook (or the AI) has already flipped it to `specified` /
 *     `planned`, this returns false — no double-write.
 *   - The step is not already closed: no step-level completion for it in
 *     `history[]` (FR — idempotent re-saves add nothing).
 */
export function shouldSettleArtifactStep(
    ctx: ArtifactSettleContext | null | undefined,
    step: ArtifactSettleStep,
): boolean {
    if (!ctx) return false;
    if (isTerminalStatus(ctx.status)) return false;
    if (ctx.currentStep !== step) return false;
    if (ctx.status !== ARTIFACT_SETTLE_STEPS[step]) return false;

    const history = ctx.history ?? [];
    if (lastEntryIsCompletionFor(history as Parameters<typeof lastEntryIsCompletionFor>[0], step)) {
        return false;
    }
    return true;
}
