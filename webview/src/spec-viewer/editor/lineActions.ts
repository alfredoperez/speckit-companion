/**
 * SpecKit Companion - Line Actions
 * Handles line type detection and context-aware action buttons
 */

import type { LineType, VSCodeApi } from '../types';

declare const vscode: VSCodeApi;

/**
 * Detect the type of a line element for context-aware actions
 */
export function detectLineType(element: HTMLElement): LineType {
    // Check if inside a user story header
    if (element.closest('.user-story-header')) return 'user-story';

    // Check if this is a task item
    if (element.closest('li.task-item')) return 'task';

    // Check if this is a heading (section)
    const lineContent = element.querySelector('.line-content');
    if (lineContent) {
        const firstChild = lineContent.firstElementChild;
        if (firstChild && (firstChild.tagName === 'H2' || firstChild.tagName === 'H3')) {
            return 'section';
        }
    }

    // Check if inside acceptance scenarios (numbered list with Given/When/Then)
    const parentList = element.closest('ol');
    if (parentList) {
        const listText = parentList.textContent || '';
        if (listText.includes('Given') || listText.includes('When') || listText.includes('Then')) {
            return 'acceptance';
        }
    }

    return 'paragraph';
}

/**
 * Get context-aware quick action buttons based on line type
 * Uses ghost-style buttons with muted text (no emojis, minimal styling)
 */
export function getContextActions(lineType: LineType, lineNum: number): string {
    const actions: Record<LineType, string> = {
        'user-story': `<button class="context-action" data-action="remove-story" data-line="${lineNum}">Remove</button>`,
        'acceptance': `<button class="context-action" data-action="remove-scenario" data-line="${lineNum}">Remove</button>`,
        'task': `<button class="context-action" data-action="toggle-task" data-line="${lineNum}">Toggle</button><button class="context-action" data-action="remove-task" data-line="${lineNum}">Remove</button>`,
        'section': `<button class="context-action" data-action="remove-section" data-line="${lineNum}">Remove</button>`,
        'paragraph': `<button class="context-action" data-action="remove-line" data-line="${lineNum}">Remove</button>`
    };
    return actions[lineType];
}

/**
 * Handle context-aware action clicks
 */
export function handleContextAction(action: string, lineNum: number, closeEditor: () => void): void {
    closeEditor();

    switch (action) {
        case 'remove-line':
        case 'remove-story':
        case 'remove-section':
        case 'remove-scenario':
        case 'remove-task':
            if (confirm('Delete this content?')) {
                vscode.postMessage({ type: 'removeLine', lineNum });
            }
            break;
        case 'toggle-task':
            // Find the checkbox and toggle it
            const lineEl = document.querySelector(`.line[data-line="${lineNum}"]`);
            const checkbox = lineEl?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
            break;
    }
}
