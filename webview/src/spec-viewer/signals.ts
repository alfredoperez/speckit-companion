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

// There's no global signal for the in-flight refine line — nothing else
// needs to read it.

/** Rendered markdown HTML (set imperatively, read by App) */
export const markdownHtml = signal('');

/** Which view the reader picked; null until they pick, so the data decides. */
export const viewerMode = signal<'overview' | 'document' | null>(null);

/** Whether this spec has an Overview at all (no recorded run → no Overview). */
export const overviewAvailable = computed(() => {
    const ns = navState.value;
    const vs = viewerState.value;
    if (ns?.livingMode) return true;
    return (ns?.activityPanelEnabled ?? true) && !!vs && hasAnyData(vs);
});

/** Read by both the rail (selection) and the pane (content), so they cannot disagree. */
export const showingOverview = computed(() => {
    if (!overviewAvailable.value) {
        console.log('[viewer-nav] showing document: this spec has no Overview to land on');
        return false;
    }
    // Three sources, most specific first: the reader's own click inside the
    // viewer, then what the entry point asked for (a tree click on a document is
    // a request for that document), then the default for a spec opened as a
    // whole. Without the middle one, every document row in the tree landed on
    // the Overview, because the default is what any run spec resolves to.
    // The Overview opens only when the spec itself was opened — clicking its
    // name. Any document, step or artifact row opens what it names. The old
    // rule derived a default from recorded activity, and that default was the
    // Overview for every spec that had ever run, so every document row in the
    // tree lost to it.
    // A living spec opens on its Overview unless a document or requirement was asked for.
    const landing = navState.value?.landing ?? (navState.value?.livingMode ? 'overview' : 'document');
    const answer = (viewerMode.value ?? landing) === 'overview';
    console.log(`[viewer-nav] showing ${answer ? 'overview' : 'document'}: viewerMode=${viewerMode.value ?? 'null'}, landing=${landing}`);
    return answer;
});

/** History array mirrored from viewerState for the timeline panel. */
export const historyEntries = signal<HistoryEntry[]>([]);
