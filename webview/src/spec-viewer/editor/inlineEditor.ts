/**
 * SpecKit Companion - Inline Editor
 * Uses Preact render() to mount InlineEditor components.
 */

import { render, h } from 'preact';
import type { VSCodeApi } from '../types';
import { activeEditor } from '../signals';
import { detectLineType, handleContextAction } from './lineActions';
import { addRefinement, addRefinementForRow } from './refinements';
import { InlineEditor } from '../components/InlineEditor';

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
    if (document.body.dataset.specStatus === 'completed' || document.body.dataset.specStatus === 'archived') return;

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

export function showInlineEditorForRow(rowElement: HTMLElement, rowNum: number): void {
    if (document.body.dataset.specStatus === 'completed' || document.body.dataset.specStatus === 'archived') return;

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
        const target = e.target as HTMLElement;
        const addBtn = target.closest('.line-add-btn') as HTMLElement;

        if (addBtn || target.classList.contains('line-add-btn')) {
            const btn = addBtn || target;
            const lineNum = parseInt(btn.dataset.line || '0', 10);
            const listId = btn.dataset.listId;
            const selector = listId
                ? `.line[data-line="${lineNum}"][data-list-id="${listId}"]`
                : `.line[data-line="${lineNum}"]`;
            const lineEl = document.querySelector(selector) as HTMLElement;
            if (lineEl) showInlineEditor(lineEl);
            return;
        }

        if (target.classList.contains('row-add-btn')) {
            const rowNum = parseInt(target.dataset.row || '0', 10);
            const tableId = target.dataset.tableId;
            const selector = tableId
                ? `.scenario-row[data-row="${rowNum}"][data-table-id="${tableId}"]`
                : `.scenario-row[data-row="${rowNum}"]`;
            const rowEl = document.querySelector(selector) as HTMLElement;
            if (rowEl) showInlineEditorForRow(rowEl, rowNum);
            return;
        }

        if (activeEditorContainer && !target.closest('.inline-editor') && !target.classList.contains('line-add-btn') && !target.classList.contains('row-add-btn')) {
            closeInlineEditor();
        }
    });
}
