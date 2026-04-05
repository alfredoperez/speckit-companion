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
    const { regenerateButton, approveButton, completeSpecButton, archiveSpecButton, reactivateSpecButton } = getElements();

    // Handle all enhancement buttons (multiple supported)
    document.querySelectorAll('.enhancement').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = (btn as HTMLElement).dataset.command;
            vscode.postMessage({ type: 'clarify', command });
        });
    });

    regenerateButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'regenerate' });
    });

    approveButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'approve' });
    });

    completeSpecButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'completeSpec' });
    });

    archiveSpecButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'archiveSpec' });
    });

    reactivateSpecButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'reactivateSpec' });
    });

    // Stale banner regen button (if present on initial load)
    const staleRegenButton = document.getElementById('stale-regen');
    staleRegenButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'regenerate' });
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

        // Recalculate and update task completion percentage in step tabs
        updateTaskPercentage();
    });
}

/**
 * Recalculate task completion and update the Tasks tab badge
 */
function updateTaskPercentage(): void {
    const total = document.querySelectorAll('.task-item').length;
    const checked = document.querySelectorAll('.task-item.checked').length;
    if (total === 0) return;

    const percent = Math.round((checked / total) * 100);

    // Update the Tasks step-tab status
    const tasksTab = document.querySelector('.step-tab[data-phase="tasks"]');
    if (!tasksTab) return;

    const statusEl = tasksTab.querySelector('.step-status');
    if (statusEl && percent > 0 && percent < 100) {
        statusEl.textContent = `${percent}%`;
        tasksTab.classList.add('in-progress');
    } else if (statusEl && percent === 100) {
        statusEl.textContent = '✓';
        tasksTab.classList.remove('in-progress');
    }

    // Update progress bars
    document.querySelectorAll('.section-progress-fill').forEach(fill => {
        const bar = fill.closest('.section-progress');
        if (!bar) return;
        const section = bar.nextElementSibling || bar.parentElement;
        if (!section) return;
        const sectionTasks = section.querySelectorAll('.task-item').length;
        const sectionChecked = section.querySelectorAll('.task-item.checked').length;
        if (sectionTasks > 0) {
            const sectionPercent = Math.round((sectionChecked / sectionTasks) * 100);
            (fill as HTMLElement).style.width = `${sectionPercent}%`;
            const textEl = bar.querySelector('.section-progress-text');
            if (textEl) {
                textEl.textContent = `${sectionChecked}/${sectionTasks}${sectionPercent === 100 ? ' ✓' : ''}`;
            }
        }
    });
}
