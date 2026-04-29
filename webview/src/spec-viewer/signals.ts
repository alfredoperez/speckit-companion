/**
 * Reactive state for the spec viewer webview.
 * Components that read .value auto-re-render when it changes.
 */

import { signal } from '@preact/signals';
import type { NavState, Refinement, DocumentType, ViewerState, Transition } from './types';

/** Navigation state from extension messages */
export const navState = signal<NavState | null>(null);

/** Derived viewer state (pulse, highlights, footer, substep). */
export const viewerState = signal<ViewerState | null>(null);

/** Pending refinements for GitHub-style review */
export const pendingRefinements = signal<Refinement[]>([]);

/** Currently active inline editor element */
export const activeEditor = signal<HTMLElement | null>(null);

/** Current line being refined (modal) */
export const refineLineNum = signal<number | null>(null);

/** Current content being refined (modal) */
export const refineContent = signal('');

/** Rendered markdown HTML (set imperatively, read by App) */
export const markdownHtml = signal('');

/** Whether the timeline panel is visible (toggled from the nav bar). */
export const timelineVisible = signal(false);

/** Transitions array mirrored from viewerState for the timeline panel. */
export const transitions = signal<Transition[]>([]);
