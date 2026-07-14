/**
 * SpecKit Companion - The single open inline composer.
 * Owned here so the new-comment composer (`inlineEditor`) and the edit-an-existing
 * -comment composer (`refinements`) can share one open slot without importing each other.
 */

import { render } from 'preact';
import { activeEditor } from '../signals';

let activeEditorContainer: HTMLElement | null = null;
let activeEditingTarget: HTMLElement | null = null;

export function openInlineEditor(container: HTMLElement, target: HTMLElement): void {
    activeEditorContainer = container;
    activeEditingTarget = target;
    activeEditor.value = container;
    target.classList.add('editing');
}

export function isInlineEditorOpen(): boolean {
    return activeEditorContainer !== null;
}

export function closeInlineEditor(): void {
    if (!activeEditorContainer) return;

    render(null, activeEditorContainer);
    activeEditorContainer.remove();
    activeEditingTarget?.classList.remove('editing');

    activeEditorContainer = null;
    activeEditingTarget = null;
    activeEditor.value = null;
}
