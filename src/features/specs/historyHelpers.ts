/**
 * Pure helpers for inspecting a `.spec-context.json` `history[]` log.
 *
 * Kept in its own module (no extension/runtime deps) so both `specCommands`
 * and the spec-viewer `messageHandlers` can import the same impl without
 * pulling in circular VS Code dependencies.
 */

import type { HistoryEntry, StepName } from '../../core/types/specContext';

/**
 * Walk `history` from newest to oldest and report whether the most recent
 * entry for `step` is a completion. Completion entries are written by
 * `setStepCompleted` with `kind: "complete"`.
 *
 * Used by:
 *   - `specCommands.executeWorkflowStep` (complete-on-advance guard)
 *   - `messageHandlers.handleApprove` (skip the duplicate completion when
 *     Copilot has already written one per the preamble)
 */
export function lastEntryIsCompletionFor(
    history: HistoryEntry[],
    step: StepName | string
): boolean {
    for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (e.step !== step) continue;
        return e.kind === 'complete' && e.substep == null;
    }
    return false;
}
