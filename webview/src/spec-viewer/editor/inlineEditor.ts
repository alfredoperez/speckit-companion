/**
 * SpecKit Companion - Inline Editor
 * Uses Preact render() to mount InlineEditor components.
 */

import { render, h } from 'preact';
import type { VSCodeApi } from '../types';
import { activeEditor } from '../signals';
import { detectLineType, handleContextAction } from './lineActions';
import { addRefinement, addRefinementForRow, editRefinement, mountedRefinement } from './refinements';
import { InlineEditor } from '../components/InlineEditor';
import { isReadOnly } from './readOnly';

declare const vscode: VSCodeApi;

let activeEditorContainer: HTMLElement | null = null;

function cleanup(): void {
    if (activeEditorContainer) {
        render(null, activeEditorContainer);
        const lineEl = activeEditorContainer.closest('.line');
        const rowEl = activeEditorContainer.closest('.scenario-row');
        // For row mode, the container is a <tbody> after the row
        const editorRow = activeEditorContainer.closest('.inline-editor-row') || activeEditorContainer;
        lineEl?.classList.remove('editing');
        rowEl?.classList.remove('editing');
        activeEditorContainer.remove();
        activeEditorContainer = null;
        activeEditor.value = null;
    }
}

export function showInlineEditor(lineElement: HTMLElement): void {
    if (isReadOnly()) return;

    closeInlineEditor();

    const lineNum = parseInt(lineElement.dataset.line || '0', 10);
    if (!lineNum) return;

    const lineType = detectLineType(lineElement);
    const commentSlot = lineElement.querySelector('.line-comment-slot');
    if (!commentSlot) return;

    const container = document.createElement('div');
    commentSlot.appendChild(container);

    render(h(InlineEditor, {
        mode: 'line',
        lineNum,
        lineType,
        onSubmit: (comment: string) => {
            addRefinement(lineNum, comment, lineElement);
            closeInlineEditor();
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: (action: string) => {
            handleContextAction(action, lineNum, closeInlineEditor, lineElement);
        },
    }), container);

    activeEditorContainer = container;
    activeEditor.value = container;
    lineElement.classList.add('editing');
}

export function closeInlineEditor(): void {
    cleanup();
}

/** Reopen the composer on an existing comment, pre-filled with its current text. */
export function showInlineEditorForEdit(refId: string): void {
    if (isReadOnly()) return;

    const entry = mountedRefinement(refId);
    if (!entry) return;

    closeInlineEditor();

    const { ref, target, mode } = entry;
    const container = document.createElement(mode === 'row' ? 'tbody' : 'div');
    if (mode === 'row') {
        target.parentElement?.insertBefore(container, target.nextSibling);
    } else {
        const commentSlot = target.querySelector('.line-comment-slot');
        if (!commentSlot) return;
        commentSlot.appendChild(container);
    }

    render(h(InlineEditor, {
        mode,
        lineNum: ref.lineNum,
        lineType: ref.lineType,
        initialValue: ref.comment,
        submitLabel: 'Save',
        onSubmit: (comment: string) => {
            editRefinement(refId, comment);
            closeInlineEditor();
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: () => closeInlineEditor(),
    }), container);

    activeEditorContainer = container;
    activeEditor.value = container;
    target.classList.add('editing');
}

export function showInlineEditorForRow(rowElement: HTMLElement, rowNum: number): void {
    if (isReadOnly()) return;

    closeInlineEditor();

    const given = rowElement.querySelector('.col-given')?.textContent?.trim() || '';
    const when = rowElement.querySelector('.col-when')?.textContent?.trim() || '';
    const then = rowElement.querySelector('.col-then')?.textContent?.trim() || '';
    const scenarioContent = `Given ${given}, When ${when}, Then ${then}`;

    const container = document.createElement('tbody');
    rowElement.parentElement?.insertBefore(container, rowElement.nextSibling);

    render(h(InlineEditor, {
        mode: 'row',
        lineNum: rowNum,
        lineType: 'acceptance',
        scenarioContent,
        onSubmit: (comment: string) => {
            addRefinementForRow(rowNum, comment, scenarioContent, rowElement);
            closeInlineEditor();
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: () => closeInlineEditor(),
    }), container);

    activeEditorContainer = container;
    activeEditor.value = container;
    rowElement.classList.add('editing');
}

export function showInlineEdit(lineEl: HTMLElement | null, lineNum: number, content: string): void {
    if (!lineEl) return;
    const contentEl = lineEl.querySelector('.line-content');
    if (!contentEl) return;

    const originalHtml = contentEl.innerHTML;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = content.trim();
    input.className = 'inline-edit-input';

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newText = input.value.trim();
            if (newText && newText !== content.trim()) {
                vscode.postMessage({ type: 'editLine', lineNum, newText });
            }
            contentEl.innerHTML = originalHtml;
        }
        if (e.key === 'Escape') contentEl.innerHTML = originalHtml;
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (contentEl.contains(input)) contentEl.innerHTML = originalHtml;
        }, 100);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(input);
    input.focus();
    input.select();
}

export function setupLineActions(): void {
    document.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        const target = e.target;
        const addBtn = target.closest<HTMLElement>('.line-add-btn');

        if (addBtn) {
            const lineNum = parseInt(addBtn.dataset.line || '0', 10);
            const listId = addBtn.dataset.listId;
            const selector = listId
                ? `.line[data-line="${lineNum}"][data-list-id="${listId}"]`
                : `.line[data-line="${lineNum}"]`;
            const lineEl = document.querySelector(selector) as HTMLElement;
            if (lineEl) showInlineEditor(lineEl);
            return;
        }

        const rowBtn = target.closest<HTMLElement>('.row-add-btn');
        if (rowBtn) {
            const rowNum = parseInt(rowBtn.dataset.row || '0', 10);
            const tableId = rowBtn.dataset.tableId;
            const selector = tableId
                ? `.scenario-row[data-row="${rowNum}"][data-table-id="${tableId}"]`
                : `.scenario-row[data-row="${rowNum}"]`;
            const rowEl = document.querySelector(selector) as HTMLElement;
            if (rowEl) showInlineEditorForRow(rowEl, rowNum);
            return;
        }

        // The Edit action opens the composer on the same click that bubbles here.
        if (activeEditorContainer && !target.closest('.inline-editor') && !target.closest('.inline-comment')) {
            closeInlineEditor();
        }
    });
}
