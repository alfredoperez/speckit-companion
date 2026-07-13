/**
 * Reactive state for the spec viewer webview.
 * Components that read .value auto-re-render when it changes.
 */

import { signal } from '@preact/signals';
import type { NavState, Refinement, ViewerState, HistoryEntry } from './types';
import type { ActivityTabId } from './activityTabsModel';

/** Navigation state from extension messages */
export const navState = signal<NavState | null>(null);

/** Derived viewer state (pulse, highlights, footer, substep). */
export const viewerState = signal<ViewerState | null>(null);

/** Active Activity-panel detail tab; null = use the default-tab rule. */
export const activityTab = signal<ActivityTabId | null>(null);

/** Pending refinements for GitHub-style review */
export const pendingRefinements = signal<Refinement[]>([]);

/** Currently active inline editor element */
export const activeEditor = signal<HTMLElement | null>(null);

// The active refine flow uses `ui/refinePopover.ts` which manages its
// own state directly — there's no global signal for the in-flight
// refine line because nothing else needs to read it.

/** Rendered markdown HTML (set imperatively, read by App) */
export const markdownHtml = signal('');

/**
 * Viewer mode: 'overview' (the run's story — the Activity data as the landing
 * view) vs 'document' (reading a markdown artifact). Starts null so the first
 * data decides the landing view: overview when the spec has recorded activity,
 * document otherwise. Living mode always reads as 'document'.
 */
export const viewerMode = signal<'overview' | 'document' | null>(null);

/** History array mirrored from viewerState for the timeline panel. */
export const historyEntries = signal<HistoryEntry[]>([]);
