/**
 * Reactive state for the spec viewer webview.
 * Components that read .value auto-re-render when it changes.
 */

import { computed, signal } from '@preact/signals';
import type { NavState, Refinement, ViewerState, HistoryEntry } from './types';
import { hasAnyData, hasDurableContext } from './overviewModel';

/** Navigation state from extension messages */
export const navState = signal<NavState | null>(null);

/** Derived viewer state (pulse, highlights, footer, substep). */
export const viewerState = signal<ViewerState | null>(null);

/** Pending refinements for GitHub-style review */
export const pendingRefinements = signal<Refinement[]>([]);

/** Currently active inline editor element */
export const activeEditor = signal<HTMLElement | null>(null);

// The active refine flow uses `ui/refinePopover.ts` which manages its
// own state directly — there's no global signal for the in-flight
// refine line because nothing else needs to read it.

/** Rendered markdown HTML (set imperatively, read by App) */
export const markdownHtml = signal('');

/** Which view the reader picked; null until they pick, so the data decides. */
export const viewerMode = signal<'overview' | 'document' | null>(null);

/** Whether this spec has an Overview at all (no recorded run → no Overview). */
export const overviewAvailable = computed(() => {
    const ns = navState.value;
    const vs = viewerState.value;
    return (ns?.activityPanelEnabled ?? true) && !ns?.livingMode && !!vs && hasAnyData(vs);
});

/** Read by both the rail (selection) and the pane (content), so they cannot disagree. */
export const showingOverview = computed(() => {
    if (!overviewAvailable.value) return false;
    const landing = hasDurableContext(viewerState.value!) ? 'overview' : 'document';
    return (viewerMode.value ?? landing) === 'overview';
});

/** History array mirrored from viewerState for the timeline panel. */
export const historyEntries = signal<HistoryEntry[]>([]);
