/**
 * SpecKit Companion - Spec Viewer State Management
 * Thin facade over signals — kept for consumers not yet migrated to signals.
 */

import type { Refinement, ViewerWebviewState, VSCodeApi } from './types';
import { pendingRefinements, activeEditor, refineLineNum, refineContent } from './signals';

declare const vscode: VSCodeApi;

export function initStateSync(): void {
    // No-op — signals are reactive.
}

export function setCurrentRefineLineNum(lineNum: number | null): void {
    refineLineNum.value = lineNum;
}

export function setCurrentRefineContent(content: string): void {
    refineContent.value = content;
}

export function setActiveInlineEditor(editor: HTMLElement | null): void {
    activeEditor.value = editor;
}

export function addPendingRefinement(refinement: Refinement): void {
    pendingRefinements.value = [...pendingRefinements.value, refinement];
}

export function removePendingRefinement(refId: string): Refinement | undefined {
    const current = pendingRefinements.value;
    const index = current.findIndex(r => r.id === refId);
    if (index > -1) {
        const removed = current[index];
        pendingRefinements.value = current.filter((_, i) => i !== index);
        return removed;
    }
    return undefined;
}

export function clearPendingRefinements(): void {
    pendingRefinements.value = [];
}

export function getPendingRefinementsCount(): number {
    return pendingRefinements.value.length;
}

export function getPendingRefinements(): Refinement[] {
    return pendingRefinements.value;
}

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
