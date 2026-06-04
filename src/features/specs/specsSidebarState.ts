/**
 * Sidebar state facade — owns the filter, sort, and collapse pieces of UI
 * state for the SpecKit explorer tree.
 *
 * Round-3 audit asked for a single place to coordinate sidebar state.
 * Rather than merge filter and sort into one mega-class (they're
 * conceptually independent and each is small + tested), this facade owns
 * the *registry* of state holders and exposes a single `initialize()` so
 * activation sites stop hand-sequencing `await filterState.initialize();
 * await sortState.initialize();` and friends.
 *
 * Adding a new sidebar UI dimension (e.g., "group-by" mode) goes here:
 * register the holder, surface it through `state`, ensure it's `initialize`d.
 */

import * as vscode from 'vscode';
import { SpecsFilterState } from './specsFilterState';
import { SpecsSortState } from './specsSortState';

export interface SpecsSidebarState {
    readonly filter: SpecsFilterState;
    readonly sort: SpecsSortState;
    /** Initialize every holder atomically — restore from workspace state, sync context keys. */
    initialize(): Promise<void>;
}

/**
 * Build the facade. Each holder receives the shared `onChange` callback so
 * filter/sort changes both trigger a single tree refresh.
 */
export function createSpecsSidebarState(
    context: vscode.ExtensionContext,
    onChange: () => void,
): SpecsSidebarState {
    const filter = new SpecsFilterState(context, onChange);
    const sort = new SpecsSortState(context, onChange);

    return {
        filter,
        sort,
        async initialize() {
            // Run in parallel — initialization is just "read workspace value,
            // sync context key." No ordering dependency between filter and sort.
            await Promise.all([filter.initialize(), sort.initialize()]);
        },
    };
}
