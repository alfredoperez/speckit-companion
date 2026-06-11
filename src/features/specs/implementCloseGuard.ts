/**
 * Pure decision: should the always-on tasks watcher close the implement step?
 *
 * Issue #244 — a spec driven specify→plan→tasks→implement finishes writing code
 * but its status stays `implementing` forever, because the closing implement
 * transition is never recorded in `.spec-context.json` `history[]`. The terminal
 * status is dropped whenever neither the terminal-close tracker fires (IDE chat
 * dispatch returns no terminal) nor the Python `after_implement` hook runs (stock
 * speckit mode has no companion hook, and implement has no "next step" so the
 * complete-on-advance path never fires for it).
 *
 * The tasks watcher (`setupTasksWatcher`) is the only surface that fires for
 * EVERY driving mode, so it is the genuine shared, mode-agnostic completion path.
 * This module holds the decision as a pure function so it is testable without a
 * live `vscode` watcher — no extension/runtime deps.
 */

import { lastEntryIsCompletionFor } from './historyHelpers';
import { isTerminalStatus } from './stepHistoryDerivation';

/** The minimal recorded-context shape the guard reads. */
export interface ImplementCloseContext {
    currentStep?: string;
    status?: string;
    history?: Array<{ step?: string; substep?: string | null; task?: string | null; kind?: string }>;
}

/** The minimal task-progress shape the guard reads. */
export interface ImplementCloseProgress {
    totalTasks: number;
    completedTasks: number;
}

/**
 * True iff the watcher should now write the terminal implement close.
 *
 * All of the following must hold:
 *   - Every task is checked: `totalTasks > 0 && completedTasks === totalTasks`
 *     (FR-001 / FR-009 — 0/0 is never "all done").
 *   - The spec is not already terminal (`implemented`/`completed`/`archived`)
 *     (FR-007 — no re-close, no backward clobber).
 *   - The implement step is underway: `currentStep === 'implement'`, OR
 *     `status === 'implementing'`, OR an implement entry already exists in
 *     `history[]` (FR-008 — this is what preserves fast-path's pause at
 *     `ready-to-implement`: a parked spec has no implement step yet, so even a
 *     fully-checked `tasks.md` is NOT auto-closed).
 *   - The implement step is not already closed: no step-level implement
 *     completion in `history[]` (FR-005 — idempotent re-saves add nothing).
 */
export function shouldCloseImplement(
    ctx: ImplementCloseContext | null | undefined,
    progress: ImplementCloseProgress,
): boolean {
    // FR-001 / FR-009: all tasks checked, and there is at least one task.
    if (!(progress.totalTasks > 0 && progress.completedTasks === progress.totalTasks)) {
        return false;
    }

    const status = ctx?.status;
    // FR-007: never re-close or regress a genuinely terminal spec. `implemented`
    // is included so a re-saved fully-checked tasks.md never double-writes.
    if (isTerminalStatus(status) || status === 'implemented') {
        return false;
    }

    const history = ctx?.history ?? [];

    // FR-008: only close when implement is actually underway. A fast-path spec
    // parked at tasks/ready-to-implement has no implement step recorded, so it is
    // left alone even with every box checked.
    const implementUnderway =
        ctx?.currentStep === 'implement' ||
        status === 'implementing' ||
        history.some(e => e?.step === 'implement');
    if (!implementUnderway) {
        return false;
    }

    // FR-005: idempotent — if the implement step already has a step-level
    // completion entry, don't append a second one. (Per-task implement finishes
    // are skipped by `lastEntryIsCompletionFor` via `isStepLevelEntry`, so a
    // trailing task finish can't hide a missing real close.)
    if (lastEntryIsCompletionFor(history as never, 'implement')) {
        return false;
    }

    return true;
}
