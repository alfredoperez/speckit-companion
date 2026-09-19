import type { ViewerState } from './types';

/** Whether the spec has recorded anything at all — no run, no Overview. */
export function hasAnyData(state: ViewerState): boolean {
    if (state.approach || state.lastAction || state.prUrl) return true;
    if (state.taskSummaries && Object.keys(state.taskSummaries).length > 0) return true;
    if (state.decisions && state.decisions.length > 0) return true;
    if (state.intent || (state.expectations && state.expectations.length > 0)) return true;
    if (state.verified && state.verified.length > 0) return true;
    if (state.coverage && state.coverage.length > 0) return true;
    if (state.concerns && state.concerns.length > 0) return true;
    if (state.filesModified && state.filesModified.length > 0) return true;
    if (state.reviewComments && state.reviewComments.length > 0) return true;
    if (state.livingSpecs) return true;
    if (state.history && state.history.length > 0) return true;
    if (state.stepHistory && Object.keys(state.stepHistory).length > 0) return true;
    return false;
}

/**
 * Whether the spec carries the dossier's own material (why / fence / proof /
 * choices / traceability). A spec with only a work log still HAS an Overview,
 * but it isn't worth landing on.
 */
export function hasDurableContext(state: ViewerState): boolean {
    return !!(
        state.intent ||
        state.approach ||
        (state.expectations && state.expectations.length > 0) ||
        (state.context && state.context.length > 0) ||
        (state.verified && state.verified.length > 0) ||
        (state.decisions && state.decisions.length > 0) ||
        (state.coverage && state.coverage.length > 0) ||
        (state.concerns && state.concerns.length > 0)
    );
}
