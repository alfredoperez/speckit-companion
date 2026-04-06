/**
 * SpecKit Companion - Inline Editor
 * Uses InlineEditorComponent for both line and row modes.
 */

import type { VSCodeApi } from '../types';
import { setActiveInlineEditor } from '../state';
import { viewerStore } from '../viewerStore';
import { detectLineType, handleContextAction } from './lineActions';
import { addRefinement, addRefinementForRow } from './refinements';
import { InlineEditorComponent } from '../components/InlineEditorComponent';

declare const vscode: VSCodeApi;

/** Currently active editor component */
let activeEditorComponent: InlineEditorComponent | null = null;

/**
 * Show inline editor below a line
 */
export function showInlineEditor(lineElement: HTMLElement): void {
    if (document.body.dataset.specStatus === 'completed' || document.body.dataset.specStatus === 'archived') {
        return;
    }

    closeInlineEditor();

    const lineNum = parseInt(lineElement.dataset.line || '0', 10);
    if (!lineNum) return;

    const lineType = detectLineType(lineElement);

    const editor = new InlineEditorComponent({
        mode: 'line',
        lineNum,
        lineType,
        onSubmit: (comment) => {
            addRefinement(lineNum, comment, lineElement);
            closeInlineEditor();
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: (action) => {
            handleContextAction(action, lineNum, closeInlineEditor, lineElement);
        },
    });

    const commentSlot = lineElement.querySelector('.line-comment-slot');
    if (commentSlot) {
        editor.mount(commentSlot as HTMLElement);
    }

    activeEditorComponent = editor;
    setActiveInlineEditor(editor.getElement());
    lineElement.classList.add('editing');
}

/**
 * Close the inline editor
 */
export function closeInlineEditor(): void {
    if (activeEditorComponent) {
        const el = activeEditorComponent.getElement();
        const lineEl = el.closest('.line');
        const rowEl = el.closest('.scenario-row');
        lineEl?.classList.remove('editing');
        rowEl?.classList.remove('editing');

        // For row mode, also remove the parent <tr> wrapper
        const editorRow = el.closest('.inline-editor-row');
        if (editorRow) {
            editorRow.remove();
        }

        activeEditorComponent.unmount();
        activeEditorComponent = null;
        setActiveInlineEditor(null);
    } else {
        // Fallback for legacy
        const legacyEditor = viewerStore.get('activeInlineEditor');
        if (legacyEditor) {
            const lineEl = legacyEditor.closest('.line');
            const rowEl = legacyEditor.closest('.scenario-row');
            lineEl?.classList.remove('editing');
            rowEl?.classList.remove('editing');
            legacyEditor.remove();
            setActiveInlineEditor(null);
        }
    }
}

/**
 * Show inline editor for a scenario table row
 */
export function showInlineEditorForRow(rowElement: HTMLElement, rowNum: number): void {
    if (document.body.dataset.specStatus === 'completed' || document.body.dataset.specStatus === 'archived') {
        return;
    }

    closeInlineEditor();

    const given = rowElement.querySelector('.col-given')?.textContent?.trim() || '';
    const when = rowElement.querySelector('.col-when')?.textContent?.trim() || '';
    const then = rowElement.querySelector('.col-then')?.textContent?.trim() || '';
    const scenarioContent = `Given ${given}, When ${when}, Then ${then}`;

    const editor = new InlineEditorComponent({
        mode: 'row',
        lineNum: rowNum,
        lineType: 'acceptance',
        scenarioContent,
        onSubmit: (comment) => {
            addRefinementForRow(rowNum, comment, scenarioContent, rowElement);
            closeInlineEditor();
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: () => closeInlineEditor(),
    });

    // Mount after the row element
    const parent = rowElement.parentElement;
    if (parent) {
        editor.mount(parent, rowElement.nextElementSibling as HTMLElement);
    }

    activeEditorComponent = editor;
    setActiveInlineEditor(editor.getElement().querySelector('.inline-editor') as HTMLElement || editor.getElement());
    rowElement.classList.add('editing');
}

/**
 * Show inline edit input for a line (legacy - kept for compatibility)
 */
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
        if (e.key === 'Escape') {
            contentEl.innerHTML = originalHtml;
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (contentEl.contains(input)) {
                contentEl.innerHTML = originalHtml;
            }
        }, 100);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(input);
    input.focus();
    input.select();
}

/**
 * Setup click handlers for the "+" button
 */
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
            if (!lineEl) return;
            showInlineEditor(lineEl);
            return;
        }

        if (target.classList.contains('row-add-btn')) {
            const rowNum = parseInt(target.dataset.row || '0', 10);
            const tableId = target.dataset.tableId;
            const selector = tableId
                ? `.scenario-row[data-row="${rowNum}"][data-table-id="${tableId}"]`
                : `.scenario-row[data-row="${rowNum}"]`;
            const rowEl = document.querySelector(selector) as HTMLElement;
            if (rowEl) {
                showInlineEditorForRow(rowEl, rowNum);
            }
            return;
        }

        if (activeEditorComponent && !target.closest('.inline-editor') && !target.classList.contains('line-add-btn') && !target.classList.contains('row-add-btn')) {
            closeInlineEditor();
        }
    });
}
