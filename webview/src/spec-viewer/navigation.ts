/**
 * SpecKit Companion - Navigation Module
 * Handles tab navigation and navigation state updates
 */

import type { NavState, VSCodeApi } from './types';
import { getElements } from './elements';

declare const vscode: VSCodeApi;

/**
 * Update navigation state without full page reload
 * Called when content is updated via message to reflect new active tab/phase
 */
export function updateNavState(navState: NavState): void {
    const { currentDoc, workflowPhase, taskCompletionPercent, isViewingRelatedDoc, relatedDocs, coreDocs } = navState;

    // Determine the parent phase for related docs
    // Related docs are associated with 'plan' phase (research, data-model, etc.)
    const parentPhaseForRelated = 'plan';

    // Update step-tabs: active/viewing/reviewing states
    document.querySelectorAll('.step-tab').forEach(tab => {
        const tabEl = tab as HTMLElement;
        const phase = tabEl.dataset.phase;
        if (!phase) return;

        // Check if this phase's document exists
        const docExists = coreDocs?.find(d => d.type === phase)?.exists ?? tabEl.classList.contains('exists');
        // When viewing a related doc, highlight the parent phase (plan)
        const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
        const inProgress = phase === 'tasks' && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        // Review mode: viewing a completed step that isn't the current workflow phase
        // Don't apply review styling when viewing related docs - just show normal viewing state
        const isReviewing = isViewing && docExists && phase !== workflowPhase && !isViewingRelatedDoc;

        // Tasks-active: viewing tasks with progress (special prominent state)
        const isTasksActive = phase === 'tasks' && isViewing && inProgress;

        // Reset classes
        tabEl.classList.remove('viewing', 'reviewing', 'tasks-active', 'workflow', 'in-progress');

        // Apply appropriate viewing class
        if (isReviewing) {
            tabEl.classList.add('reviewing');
        } else if (isViewing) {
            tabEl.classList.add('viewing');
        }

        // Apply tasks-active for prominent progress badge
        if (isTasksActive) {
            tabEl.classList.add('tasks-active');
        }

        // Mark workflow phase (when not viewing)
        if (phase === workflowPhase && !isViewing) {
            tabEl.classList.add('workflow');
        }

        // Update Tasks tab progress indicator
        if (phase === 'tasks') {
            const statusEl = tabEl.querySelector('.step-status');
            if (statusEl && inProgress) {
                statusEl.textContent = `${taskCompletionPercent}%`;
                if (!isTasksActive) {
                    tabEl.classList.add('in-progress');
                }
            }
        }
    });

    // Update completion badge visibility
    const existingBadge = document.querySelector('.completion-badge');
    if (taskCompletionPercent === 100 && !existingBadge) {
        // Add completion badge if not present (insert before step-tabs)
        const navPrimary = document.querySelector('.nav-primary');
        const stepTabs = document.querySelector('.step-tabs');
        if (navPrimary && stepTabs) {
            const badge = document.createElement('span');
            badge.className = 'completion-badge';
            badge.textContent = 'PROJECT COMPLETE';
            navPrimary.insertBefore(badge, stepTabs);
        }
    } else if (taskCompletionPercent < 100 && existingBadge) {
        // Remove badge if tasks not complete
        existingBadge.remove();
    }

    // Update related tabs visibility and active state
    const relatedBar = document.querySelector('.related-bar') as HTMLElement | null;
    if (relatedBar) {
        // Show related bar only when viewing plan/tasks or their related docs
        // Hide when viewing spec since related docs typically belong to plan phase
        const showRelatedBar = relatedDocs.length > 0 && currentDoc !== 'spec';
        relatedBar.style.display = showRelatedBar ? 'flex' : 'none';

        // Update related tab active states
        relatedBar.querySelectorAll('.related-tab').forEach(tab => {
            const tabEl = tab as HTMLElement;
            const docType = tabEl.dataset.doc;
            tabEl.classList.toggle('active', docType === currentDoc);
        });

        // Update Overview tab state
        const overviewTab = relatedBar.querySelector('.overview-tab') as HTMLElement | null;
        if (overviewTab) {
            const isCoreDoc = ['spec', 'plan', 'tasks'].includes(currentDoc);
            const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;
            overviewTab.classList.toggle('active', isOverviewActive);

            // Update the overview tab's data-doc to point to the current parent phase
            const parentPhase = isViewingRelatedDoc ? 'plan' : currentDoc;
            if (['spec', 'plan', 'tasks'].includes(parentPhase)) {
                overviewTab.dataset.doc = parentPhase;
            }
        }
    }
}

/**
 * Setup step-tab navigation (unified stepper + tabs)
 */
export function setupTabNavigation(): void {
    const { stepTabs, relatedTabs, backLink } = getElements();

    // Unified step-tabs (Spec, Plan, Tasks, Done)
    stepTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;

            const phase = btn.dataset.phase as 'spec' | 'plan' | 'tasks' | 'done';
            if (phase && phase !== 'done') {
                vscode.postMessage({
                    type: 'stepperClick',
                    phase
                });
            }
        });
    });

    // Related document tabs
    relatedTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const docType = btn.dataset.doc;
            if (docType) {
                vscode.postMessage({
                    type: 'switchDocument',
                    documentType: docType
                });
            }
        });
    });

    // Overview tab (navigates to main document - spec.md, plan.md, or tasks.md)
    const overviewTab = document.querySelector('.overview-tab') as HTMLButtonElement | null;
    if (overviewTab) {
        overviewTab.addEventListener('click', () => {
            const docType = overviewTab.dataset.doc;
            if (docType) {
                vscode.postMessage({
                    type: 'switchDocument',
                    documentType: docType
                });
            }
        });
    }

    // Back link (← Plan)
    if (backLink) {
        backLink.addEventListener('click', () => {
            const docType = backLink.dataset.doc;
            if (docType) {
                vscode.postMessage({
                    type: 'switchDocument',
                    documentType: docType
                });
            }
        });
    }
}

/**
 * Setup stepper navigation (legacy - kept for compatibility)
 */
export function setupStepperNavigation(): void {
    // Now handled by setupTabNavigation with unified step-tabs
}
