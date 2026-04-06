/**
 * SpecKit Companion - Delegated Actions
 * Handles checkbox toggle and file reference clicks (delegated handlers).
 * Footer actions are now handled by FooterActions component.
 */

import type { VSCodeApi } from './types';

declare const vscode: VSCodeApi;

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
    document.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
            return;
        }

        const checkbox = target as HTMLInputElement;
        const lineNum = parseInt(checkbox.dataset.line || '0', 10);
        if (!lineNum) return;

        const isChecked = checkbox.checked;

        const li = checkbox.closest('li');
        if (li) {
            li.classList.toggle('checked', isChecked);
        }

        vscode.postMessage({
            type: 'toggleCheckbox',
            lineNum,
            checked: isChecked
        });

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
