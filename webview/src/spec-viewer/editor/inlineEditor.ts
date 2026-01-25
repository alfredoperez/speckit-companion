/**
 * SpecKit Companion - Inline Editor
 * GitHub-style inline editor for adding comments
 */

import type { VSCodeApi } from '../types';
import { escapeHtml } from '../markdown';
import { activeInlineEditor, setActiveInlineEditor } from '../state';
import { detectLineType, getContextActions, handleContextAction } from './lineActions';
import { addRefinement, addRefinementForRow } from './refinements';

declare const vscode: VSCodeApi;

/**
 * Show inline editor below a line
 */
export function showInlineEditor(lineElement: HTMLElement): void {
    console.log('[SpecViewer] showInlineEditor called with element:', lineElement);

    // Close any existing editor first
    closeInlineEditor();

    const lineNum = parseInt(lineElement.dataset.line || '0', 10);
    console.log('[SpecViewer] Opening inline editor for line:', lineNum);
    if (!lineNum) {
        console.warn('[SpecViewer] Invalid line number, aborting');
        return;
    }

    const lineType = detectLineType(lineElement);

    const editor = document.createElement('div');
    editor.className = 'inline-editor';
    editor.innerHTML = `
        <div class="editor-actions">
            ${getContextActions(lineType, lineNum)}
        </div>
        <div class="editor-comment-section">
            <textarea class="editor-textarea" placeholder="Add a comment or refinement instruction..."></textarea>
            <div class="editor-buttons">
                <button class="editor-cancel">Cancel</button>
                <button class="editor-add">Add Comment</button>
            </div>
        </div>
    `;

    // Insert editor into the comment slot
    const commentSlot = lineElement.querySelector('.line-comment-slot');
    if (commentSlot) {
        commentSlot.appendChild(editor);
    }

    setActiveInlineEditor(editor);
    lineElement.classList.add('editing');

    // Setup event listeners
    const textarea = editor.querySelector('.editor-textarea') as HTMLTextAreaElement;
    const cancelBtn = editor.querySelector('.editor-cancel') as HTMLButtonElement;
    const addBtn = editor.querySelector('.editor-add') as HTMLButtonElement;

    // Focus textarea
    setTimeout(() => textarea?.focus(), 50);

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
        closeInlineEditor();
    });

    // Add comment button
    addBtn?.addEventListener('click', () => {
        const comment = textarea?.value.trim();
        if (comment) {
            addRefinement(lineNum, comment, lineElement);
        }
        closeInlineEditor();
    });

    // Keyboard shortcuts
    textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInlineEditor();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const comment = textarea.value.trim();
            if (comment) {
                addRefinement(lineNum, comment, lineElement);
            }
            closeInlineEditor();
        }
    });

    // Context action buttons
    const contextButtons = editor.querySelectorAll('.context-action');
    contextButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = (e.target as HTMLElement).dataset.action;
            handleContextAction(action || '', lineNum, closeInlineEditor, lineElement);
        });
    });
}

/**
 * Close the inline editor
 */
export function closeInlineEditor(): void {
    if (activeInlineEditor) {
        const lineEl = activeInlineEditor.closest('.line');
        const rowEl = activeInlineEditor.closest('.scenario-row');
        lineEl?.classList.remove('editing');
        rowEl?.classList.remove('editing');
        activeInlineEditor.remove();
        setActiveInlineEditor(null);
    }
}

/**
 * Show inline editor for a scenario table row
 */
export function showInlineEditorForRow(rowElement: HTMLElement, rowNum: number): void {
    // Close any existing editor first
    closeInlineEditor();

    // Get the scenario content from table cells
    const given = rowElement.querySelector('.col-given')?.textContent?.trim() || '';
    const when = rowElement.querySelector('.col-when')?.textContent?.trim() || '';
    const then = rowElement.querySelector('.col-then')?.textContent?.trim() || '';
    const scenarioContent = `Given ${given}, When ${when}, Then ${then}`;

    const editor = document.createElement('tr');
    editor.className = 'inline-editor-row';
    editor.innerHTML = `
        <td colspan="4" class="editor-cell">
            <div class="inline-editor">
                <div class="editor-context">
                    <span class="editor-context-label">Scenario ${rowNum}:</span>
                    <span class="editor-context-text">${escapeHtml(scenarioContent)}</span>
                </div>
                <div class="editor-comment-section">
                    <textarea class="editor-textarea" placeholder="Add a comment or refinement instruction..."></textarea>
                    <div class="editor-buttons">
                        <button class="editor-cancel">Cancel</button>
                        <button class="editor-add">Add Comment</button>
                    </div>
                </div>
            </div>
        </td>
    `;

    // Insert editor row after the scenario row
    rowElement.after(editor);

    setActiveInlineEditor(editor.querySelector('.inline-editor') as HTMLElement);
    rowElement.classList.add('editing');

    // Setup event listeners
    const textarea = editor.querySelector('.editor-textarea') as HTMLTextAreaElement;
    const cancelBtn = editor.querySelector('.editor-cancel') as HTMLButtonElement;
    const addBtn = editor.querySelector('.editor-add') as HTMLButtonElement;

    // Focus textarea
    setTimeout(() => textarea?.focus(), 50);

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
        closeInlineEditor();
        editor.remove();
    });

    // Add comment button
    addBtn?.addEventListener('click', () => {
        const comment = textarea?.value.trim();
        if (comment) {
            addRefinementForRow(rowNum, comment, scenarioContent, rowElement);
        }
        closeInlineEditor();
        editor.remove();
    });

    // Keyboard shortcuts
    textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInlineEditor();
            editor.remove();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const comment = textarea.value.trim();
            if (comment) {
                addRefinementForRow(rowNum, comment, scenarioContent, rowElement);
            }
            closeInlineEditor();
            editor.remove();
        }
    });
}

/**
 * Show inline edit input for a line (legacy - kept for compatibility)
 */
export function showInlineEdit(lineEl: HTMLElement | null, lineNum: number, content: string): void {
    if (!lineEl) return;

    const contentEl = lineEl.querySelector('.line-content');
    if (!contentEl) return;

    // Store original content for cancel
    const originalHtml = contentEl.innerHTML;

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = content.trim();
    input.className = 'inline-edit-input';

    // Handle keyboard events
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

    // Handle blur (click away)
    input.addEventListener('blur', () => {
        // Small delay to allow Enter key to fire first
        setTimeout(() => {
            if (contentEl.contains(input)) {
                contentEl.innerHTML = originalHtml;
            }
        }, 100);
    });

    // Replace content with input
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

        // Check if click is on button or inside button (SVG elements)
        const addBtn = target.closest('.line-add-btn') as HTMLElement;

        // Handle "+" button click for lines
        if (addBtn || target.classList.contains('line-add-btn')) {
            const btn = addBtn || target;
            const lineNum = parseInt(btn.dataset.line || '0', 10);
            console.log('[SpecViewer] Add button clicked, lineNum:', lineNum);

            const lineEl = document.querySelector(`.line[data-line="${lineNum}"]`) as HTMLElement;
            if (!lineEl) {
                console.warn('[SpecViewer] Line element not found for line:', lineNum);
                return;
            }
            console.log('[SpecViewer] Found line element:', lineEl);
            showInlineEditor(lineEl);
            return;
        }

        // Handle "+" button click for scenario table rows
        if (target.classList.contains('row-add-btn')) {
            const rowNum = parseInt(target.dataset.row || '0', 10);
            const tableId = target.dataset.tableId;
            // Use table-scoped selector to find the correct row
            const selector = tableId
                ? `.scenario-row[data-row="${rowNum}"][data-table-id="${tableId}"]`
                : `.scenario-row[data-row="${rowNum}"]`;
            const rowEl = document.querySelector(selector) as HTMLElement;
            if (rowEl) {
                showInlineEditorForRow(rowEl, rowNum);
            }
            return;
        }

        // Close editor when clicking outside
        if (activeInlineEditor && !target.closest('.inline-editor') && !target.classList.contains('line-add-btn') && !target.classList.contains('row-add-btn')) {
            closeInlineEditor();
        }
    });
}
