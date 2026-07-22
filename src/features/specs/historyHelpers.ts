/**
 * Pure helpers for inspecting a `.spec-context.json` `history[]` log.
 *
 * Kept in its own module (no extension/runtime deps) so both `specCommands`
 * and the spec-viewer `messageHandlers` can import the same impl without
 * pulling in circular VS Code dependencies.
 */

import type { HistoryEntry, StepName } from '../../core/types/specContext';

/**
 * Minimal structural shape both predicates accept, so canonical `HistoryEntry`
 * and the looser reader/`HistoryEntryLike` shapes pass without casts.
 */
type DiscriminatorEntry = { substep?: string | null; task?: string | null };

/**
 * True iff `e` is a step-level boundary entry (a step start/complete), not a
 * substep marker or a per-task implement finish. The single source of the
 * `substep == null && task == null` rule.
 */
export function isStepLevelEntry(e: DiscriminatorEntry): boolean {
    return e.substep == null && e.task == null;
}

/** True iff `e` is a per-task implement finish (carries a `task` id). */
export function isPerTaskEntry(e: DiscriminatorEntry): boolean {
    return e.task != null;
}

/**
 * The entry's kind, inferring it for legacy kind-less rows exactly as the Python
 * `_entry_kind` does: a self-loop (`from.step === step` with the matching
 * substep) is a completion, anything else is a start. The TS twin of that rule.
 */
function entryKind(e: HistoryEntry): 'start' | 'complete' {
    if (e.kind === 'start' || e.kind === 'complete') return e.kind;
    const from = e.from;
    if (from?.step === e.step && (from?.substep ?? null) === (e.substep ?? null)) {
        return 'complete';
    }
    return 'start';
}

/**
 * True iff a step-level `start` for `(step, substep)` already exists anywhere in
 * the log. The TypeScript twin of `write-context.py`'s `_has_step_start`: a step
 * is started once, so a redundant start append is a no-op. Per-task finishes
 * never count; `substep` defaults to `null` (the step-level start).
 */
export function hasStepStart(
    history: HistoryEntry[],
    step: StepName | string,
    substep: string | null = null,
): boolean {
    return history.some(e =>
        e.step === step
        && (e.substep ?? null) === (substep ?? null)
        && !isPerTaskEntry(e)
        && entryKind(e) === 'start'
    );
}

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
        // Per-task implement finishes and substep entries aren't the step boundary —
        // skip them and keep searching. The backstop can append task finishes AFTER
        // the step-level complete, so returning here would report the step
        // incomplete forever.
        if (!isStepLevelEntry(e)) continue;
        if (e.kind === 'complete') return true;
        if (e.kind == null && e.from?.step === step) return true;
        return false;
    }
    return false;
}
