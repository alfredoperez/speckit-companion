/**
 * SpecKit Companion - Inline Editor
 * Uses Preact render() to mount InlineEditor components.
 */

import { render, h } from 'preact';
import type { VSCodeApi } from '../types';
import { detectLineType } from './lineActions';
import { addRefinement, addRefinementForRow } from './refinements';
import { InlineEditor } from '../components/InlineEditor';
import { isReadOnly } from './readOnly';
import { closeInlineEditor, isInlineEditorOpen, openInlineEditor } from './editorHost';

declare const vscode: VSCodeApi;

/** A remove action becomes a refinement comment, never an immediate deletion. */
export function handleContextAction(
    action: string,
    lineNum: number,
    closeEditor: () => void,
    lineElement?: HTMLElement
): void {
    switch (action) {
        case 'remove-line':
        case 'remove-story':
        case 'remove-section':
        case 'remove-scenario':
        case 'remove-task':
            if (lineElement) {
                const actionLabel = action.replace('remove-', '').replace('-', ' ');
                addRefinement(lineNum, `🗑️ Remove this ${actionLabel}`, lineElement);
            }
            closeEditor();
            break;
        case 'toggle-task': {
            closeEditor();
            const lineEl = document.querySelector(`.line[data-line="${lineNum}"]`);
            const checkbox = lineEl?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
            break;
        }
        default:
            closeEditor();
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

    openInlineEditor(container, lineElement);
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

    openInlineEditor(container, rowElement);
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
        if (isInlineEditorOpen() && !target.closest('.inline-editor') && !target.closest('.inline-comment')) {
            closeInlineEditor();
        }
    });
}
