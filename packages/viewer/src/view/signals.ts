/**
 * Reactive state for the viewer. Components that read `.value` re-render when it changes.
 * One viewer per page: these are module state.
 */

import { computed, signal } from '@preact/signals';
import type { NavState, ReportSummary } from '../contract/viewer';
import type { HistoryEntry } from '../contract/specContext';
import type { ViewerState } from '../contract/viewerState';
import { hasOverview } from '../core/overviewAvailability';

/** Navigation state from the host. */
export const navState = signal<NavState<ReportSummary> | null>(null);

/** Derived viewer state (pulse, highlights, footer, substep). */
export const viewerState = signal<ViewerState | null>(null);

/** Rendered markdown HTML, set by the host and read by `App`. */
export const markdownHtml = signal('');

/** Which view the reader picked; null until they pick, so the data decides. */
export const viewerMode = signal<'overview' | 'document' | null>(null);

/** The spec folder the view is keyed by no longer exists; the view cannot follow it. */
export const specMoved = signal(false);

/** Whether this spec has an Overview at all (no recorded run → no Overview). */
export const overviewAvailable = computed(() => {
    const ns = navState.value;
    return hasOverview(viewerState.value, ns?.activityPanelEnabled ?? true);
});

/** Read by both the rail (selection) and the pane (content), so they cannot disagree. */
export const showingOverview = computed(() => {
    if (!overviewAvailable.value) return false;
    // The Overview opens only when the spec itself was opened. Any document, step or
    // artifact row opens what it names; the reader's own click inside the viewer wins.
    const landing = navState.value?.landing ?? 'document';
    return (viewerMode.value ?? landing) === 'overview';
});

/** History array mirrored from viewerState for the timeline panel. */
export const historyEntries = signal<HistoryEntry[]>([]);
