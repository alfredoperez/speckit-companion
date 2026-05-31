/**
 * Reactive state for the spec viewer webview.
 * Components that read .value auto-re-render when it changes.
 */

import { signal } from '@preact/signals';
import type { NavState, Refinement, DocumentType, ViewerState, HistoryEntry } from './types';

/** Navigation state from extension messages */
export const navState = signal<NavState | null>(null);

/** Derived viewer state (pulse, highlights, footer, substep). */
export const viewerState = signal<ViewerState | null>(null);

/** Pending refinements for GitHub-style review */
export const pendingRefinements = signal<Refinement[]>([]);

/** Currently active inline editor element */
export const activeEditor = signal<HTMLElement | null>(null);

// `refineLineNum` and `refineContent` signals removed in Phase 5b — the
// hardcoded refine-modal HTML + modal.ts that wrote them is gone. The
// active refine flow uses `ui/refinePopover.ts` which manages its own
// state directly.

/** Rendered markdown HTML (set imperatively, read by App) */
export const markdownHtml = signal('');

/** Whether the activity panel is visible (toggled from the nav bar). */
export const activityVisible = signal(false);

/** History array mirrored from viewerState for the timeline panel. */
export const historyEntries = signal<HistoryEntry[]>([]);
