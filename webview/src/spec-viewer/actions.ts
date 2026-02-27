/**
 * SpecKit Companion - Footer Actions
 * Handles edit button and footer action buttons
 */

import type { VSCodeApi } from './types';
import { getElements } from './elements';

declare const vscode: VSCodeApi;

/**
 * Setup the edit button handler
 */
export function setupEditButton(): void {
    const { editButton } = getElements();

    editButton?.addEventListener('click', () => {
        if (!editButton.disabled) {
            vscode.postMessage({ type: 'editDocument' });
        }
    });
}

/**
 * Setup footer action button handlers
 */
export function setupFooterActions(): void {
    const { enhanceButton, editSourceButton, regenerateButton, approveButton } = getElements();

    enhanceButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'clarify' });
    });

    editSourceButton?.addEventListener('click', () => {
        if (!editSourceButton.disabled) {
            vscode.postMessage({ type: 'editSource' });
        }
    });

    regenerateButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'regenerate' });
    });

    approveButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'approve' });
    });
}

/**
 * Setup delegated click handler for file reference buttons
 */
export function setupFileRefClickHandler(): void {
    document.addEventListener('click', (e) => {
        const el = (e.target as HTMLElement).closest('.file-ref') as HTMLElement | null;
        if (!el) return;
        const filename = el.dataset.filename;
        if (filename) {
            vscode.postMessage({ type: 'openFile', filename });
        }
    });
}

/**
 * Setup checkbox toggle handler for task items
 */
export function setupCheckboxToggle(): void {
    // Use event delegation for checkbox changes
    document.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
            return;
        }

        const checkbox = target as HTMLInputElement;
        const lineNum = parseInt(checkbox.dataset.line || '0', 10);
        if (!lineNum) return;

        const isChecked = checkbox.checked;

        // Update the li class for visual feedback
        const li = checkbox.closest('li');
        if (li) {
            li.classList.toggle('checked', isChecked);
        }

        // Send message to extension to update the file
        vscode.postMessage({
            type: 'toggleCheckbox',
            lineNum,
            checked: isChecked
        });
    });
}
