/**
 * Spec Viewer store instance — single source of truth for viewer state.
 */

import { Store } from '../shared/store';
import type { Refinement, NavState, DocumentType } from './types';

export interface SpecViewerState {
    // Refinement state (previously globals in state.ts)
    currentRefineLineNum: number | null;
    currentRefineContent: string;
    pendingRefinements: Refinement[];
    activeInlineEditor: HTMLElement | null;

    // Navigation state (from extension messages)
    navState: NavState | null;

    // Persistence state (from vscode.setState)
    currentDocument: DocumentType;
    scrollPosition: number;
}

const initialState: SpecViewerState = {
    currentRefineLineNum: null,
    currentRefineContent: '',
    pendingRefinements: [],
    activeInlineEditor: null,
    navState: null,
    currentDocument: 'spec',
    scrollPosition: 0,
};

export const viewerStore = new Store<SpecViewerState>(initialState);
