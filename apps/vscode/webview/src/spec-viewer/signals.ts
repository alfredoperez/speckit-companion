/**
 * The viewer's signals live in the package; the extension reads them with its own
 * report-page type and keeps the editor's state here. Importing this module also routes
 * the package view's actions to the extension.
 */

import { signal, type Signal } from '@preact/signals';
import * as viewer from 'speckit-viewer/view/signals';
import { setActionHandler } from 'speckit-viewer/view/host';
import type { NavState, Refinement, VSCodeApi } from './types';

declare const vscode: VSCodeApi;

// Read at call time, so a test or story that sets `globalThis.vscode` later still receives the messages.
setActionHandler(action => vscode.postMessage(action));

export const navState = viewer.navState as Signal<NavState | null>;
export const {
    viewerState,
    markdownHtml,
    viewerMode,
    specMoved,
    overviewAvailable,
    showingOverview,
    historyEntries,
} = viewer;

/** Pending refinements for GitHub-style review */
export const pendingRefinements = signal<Refinement[]>([]);

/** Currently active inline editor element */
export const activeEditor = signal<HTMLElement | null>(null);
