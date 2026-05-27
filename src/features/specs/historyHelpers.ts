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
 * entry for `step` is a completion.
 *
 * Accepts both the current kind-based shape and the legacy self-loop
 * (`from.step === step` with no `kind`) so callers that bypass
 * `normalizeSpecContext` (unit tests, in-memory paths) still classify
 * correctly. Misclassifying a legacy completion as "not yet complete"
 * triggers the duplicate-write path the writer's append-only check
 * is designed to reject.
 */
export function lastEntryIsCompletionFor(
    history: HistoryEntry[],
    step: StepName | string
): boolean {
    for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (e.step !== step) continue;
        if (e.substep != null) return false;
        if (e.kind === 'complete') return true;
        if (e.kind == null && e.from?.step === step) return true;
        return false;
    }
    return false;
}
