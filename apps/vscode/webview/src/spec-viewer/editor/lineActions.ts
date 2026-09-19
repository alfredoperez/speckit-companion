/**
 * SpecKit Companion - Line Actions
 * Line type detection and the context-aware actions each type offers.
 * Pure classifiers — acting on an action lives with the composer that raised it.
 */

import type { LineType } from '../types';

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
        'user-story': [{ action: 'remove-story', label: 'Suggest removing story' }],
        'acceptance': [{ action: 'remove-scenario', label: 'Suggest removing scenario' }],
        'task': [{ action: 'toggle-task', label: 'Toggle' }, { action: 'remove-task', label: 'Suggest removing task' }],
        'section': [{ action: 'remove-section', label: 'Suggest removing section' }],
        'paragraph': [{ action: 'remove-line', label: 'Suggest removing line' }],
    };
    return actions[lineType];
}
