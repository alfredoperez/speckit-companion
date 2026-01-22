/**
 * SpecKit Companion - Spec Viewer State Management
 * Handles state storage and persistence for the webview
 */

import type { Refinement, ViewerWebviewState, VSCodeApi } from './types';

declare const vscode: VSCodeApi;

// ============================================
// Global State
// ============================================

/** Current line number being refined */
export let currentRefineLineNum: number | null = null;

/** Current content being refined */
export let currentRefineContent: string = '';

/** Pending refinements for GitHub-style review */
export let pendingRefinements: Refinement[] = [];

/** Currently active inline editor element */
export let activeInlineEditor: HTMLElement | null = null;

// ============================================
// State Setters
// ============================================

export function setCurrentRefineLineNum(lineNum: number | null): void {
    currentRefineLineNum = lineNum;
}

export function setCurrentRefineContent(content: string): void {
    currentRefineContent = content;
}

export function setActiveInlineEditor(editor: HTMLElement | null): void {
    activeInlineEditor = editor;
}

export function addPendingRefinement(refinement: Refinement): void {
    pendingRefinements.push(refinement);
}

export function removePendingRefinement(refId: string): Refinement | undefined {
    const index = pendingRefinements.findIndex(r => r.id === refId);
    if (index > -1) {
        return pendingRefinements.splice(index, 1)[0];
    }
    return undefined;
}

export function clearPendingRefinements(): void {
    pendingRefinements = [];
}

export function getPendingRefinementsCount(): number {
    return pendingRefinements.length;
}

export function getPendingRefinements(): Refinement[] {
    return pendingRefinements;
}

// ============================================
// State Persistence
// ============================================

export function saveState(contentArea: HTMLElement, activeTab: HTMLButtonElement | null): void {
    const state: ViewerWebviewState = {
        currentDocument: activeTab?.dataset.doc || 'spec',
        scrollPosition: contentArea.scrollTop,
        specDirectory: ''
    };

    vscode.setState(state);
}

export function restoreState(contentArea: HTMLElement): void {
    const state = vscode.getState<ViewerWebviewState>();
    if (state?.scrollPosition) {
        contentArea.scrollTop = state.scrollPosition;
    }
}
