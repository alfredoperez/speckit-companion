import type { ViewerState } from './types';

export { hasAnyData } from '../../../src/core/utils/overviewAvailability';

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
