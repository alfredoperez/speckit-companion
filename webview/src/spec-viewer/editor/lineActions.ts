/**
 * SpecKit Companion - Line Actions
 * Handles line type detection and context-aware action buttons
 */

import type { LineType, VSCodeApi } from '../types';
import { addRefinement } from './refinements';

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

export interface ContextAction {
    action: string;
    label: string;
}

/**
 * Get context-aware quick actions based on line type.
 * Returns data — components render the buttons.
 */
export function getContextActions(lineType: LineType): ContextAction[] {
    const actions: Record<LineType, ContextAction[]> = {
        'user-story': [{ action: 'remove-story', label: 'Remove Story' }],
        'acceptance': [{ action: 'remove-scenario', label: 'Remove Scenario' }],
        'task': [{ action: 'toggle-task', label: 'Toggle' }, { action: 'remove-task', label: 'Remove Task' }],
        'section': [{ action: 'remove-section', label: 'Remove Section' }],
        'paragraph': [{ action: 'remove-line', label: 'Remove Line' }],
    };
    return actions[lineType];
}

/**
 * Handle context-aware action clicks
 * Remove actions now add a refinement comment instead of immediately deleting
 */
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
            // Add removal comment instead of immediate deletion
            if (lineElement) {
                const actionLabel = action.replace('remove-', '').replace('-', ' ');
                addRefinement(lineNum, `🗑️ Remove this ${actionLabel}`, lineElement);
            }
            closeEditor();
            break;
        case 'toggle-task':
            closeEditor();
            // Find the checkbox and toggle it
            const lineEl = document.querySelector(`.line[data-line="${lineNum}"]`);
            const checkbox = lineEl?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
            break;
        default:
            closeEditor();
    }
}
