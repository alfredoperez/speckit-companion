/**
 * SpecKit Companion - Spec Viewer State Management
 * Thin facade over viewerStore — setters/getters for consumers that
 * haven't migrated to using viewerStore directly.
 */

import type { Refinement, ViewerWebviewState, VSCodeApi } from './types';
import { viewerStore } from './viewerStore';

declare const vscode: VSCodeApi;

// ============================================
// State Initialization (no-op, kept for compatibility)
// ============================================

export function initStateSync(): void {
    // No-op — components use viewerStore directly.
}

// ============================================
// State Setters (delegate to store)
// ============================================

export function setCurrentRefineLineNum(lineNum: number | null): void {
    viewerStore.set('currentRefineLineNum', lineNum);
}

export function setCurrentRefineContent(content: string): void {
    viewerStore.set('currentRefineContent', content);
}

export function setActiveInlineEditor(editor: HTMLElement | null): void {
    viewerStore.set('activeInlineEditor', editor);
}

export function addPendingRefinement(refinement: Refinement): void {
    const current = viewerStore.get('pendingRefinements');
    viewerStore.set('pendingRefinements', [...current, refinement]);
}

export function removePendingRefinement(refId: string): Refinement | undefined {
    const current = viewerStore.get('pendingRefinements');
    const index = current.findIndex(r => r.id === refId);
    if (index > -1) {
        const removed = current[index];
        viewerStore.set('pendingRefinements', current.filter((_, i) => i !== index));
        return removed;
    }
    return undefined;
}

export function clearPendingRefinements(): void {
    viewerStore.set('pendingRefinements', []);
}

export function getPendingRefinementsCount(): number {
    return viewerStore.get('pendingRefinements').length;
}

export function getPendingRefinements(): Refinement[] {
    return viewerStore.get('pendingRefinements');
}

// ============================================
// State Persistence
// ============================================

export function saveState(contentArea: HTMLElement, activeTab: HTMLButtonElement | null): void {
    const state: ViewerWebviewState = {
        currentDocument: activeTab?.dataset.doc || activeTab?.dataset.phase || 'spec',
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
