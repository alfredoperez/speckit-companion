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

    // Determine the parent phase for the current related doc (if viewing one)
    const viewingRelatedDoc = isViewingRelatedDoc ? relatedDocs.find(d => d.type === currentDoc) : undefined;
    const parentPhaseForRelated = viewingRelatedDoc?.parentStep || coreDocs?.[0]?.type || 'spec';

    // Update step-tabs: active/viewing/reviewing states
    document.querySelectorAll('.step-tab').forEach(tab => {
        const tabEl = tab as HTMLElement;
        const phase = tabEl.dataset.phase;
        if (!phase) return;

        // Check if this phase's document exists
        const docExists = coreDocs?.find(d => d.type === phase)?.exists
            || relatedDocs?.some(d => d.parentStep === phase)
            || tabEl.classList.contains('exists');
        // When viewing a related doc, highlight the parent phase
        const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
        const inProgress = phase === 'tasks' && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        // Review mode: viewing a completed step that isn't the current workflow phase
        // Don't apply review styling when viewing related docs - just show normal viewing state
        const isReviewing = isViewing && docExists && phase !== workflowPhase && !isViewingRelatedDoc;

        // Tasks-active: viewing tasks with progress (special prominent state)
        const isTasksActive = phase === 'tasks' && isViewing && inProgress;

        // Reset classes
        tabEl.classList.remove('viewing', 'reviewing', 'tasks-active', 'workflow', 'in-progress', 'stale');

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

        // Update staleness badge
        const isStale = navState.stalenessMap?.[phase]?.isStale ?? false;
        let staleBadge = tabEl.querySelector('.stale-badge') as HTMLElement | null;
        if (isStale) {
            tabEl.classList.add('stale');
            if (!staleBadge) {
                staleBadge = document.createElement('span');
                staleBadge.className = 'stale-badge';
                staleBadge.textContent = '!';
                tabEl.appendChild(staleBadge);
            }
        } else {
            if (staleBadge) staleBadge.remove();
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
        // Show related bar when the current step has related docs (filtered by parentStep)
        const coreDocTypes = coreDocs?.map(d => d.type) ?? [];
        const isCoreDocNow = coreDocTypes.includes(currentDoc);
        const relevantRelatedDocs = relatedDocs.filter(d =>
            !d.parentStep || d.parentStep === currentDoc
        );
        const showRelatedBar = (relevantRelatedDocs.length > 0 && isCoreDocNow) || isViewingRelatedDoc;
        relatedBar.style.display = showRelatedBar ? 'flex' : 'none';

        // Update related tab active states
        relatedBar.querySelectorAll('.related-tab').forEach(tab => {
            const tabEl = tab as HTMLElement;
            const docType = tabEl.dataset.doc;
            tabEl.classList.toggle('active', docType === currentDoc);
        });

        // Update Overview tab state — hide if the core doc doesn't exist
        const overviewTab = relatedBar.querySelector('.overview-tab') as HTMLElement | null;
        const overviewDivider = relatedBar.querySelector('.overview-divider') as HTMLElement | null;
        if (overviewTab) {
            const parentPhase = isViewingRelatedDoc ? parentPhaseForRelated : currentDoc;
            const parentCoreDoc = coreDocs?.find(d => d.type === parentPhase);
            const parentCoreExists = parentCoreDoc?.exists ?? false;

            if (!parentCoreExists) {
                overviewTab.style.display = 'none';
                if (overviewDivider) overviewDivider.style.display = 'none';
            } else {
                overviewTab.style.display = '';
                if (overviewDivider) overviewDivider.style.display = '';
                const isOverviewActive = isCoreDocNow && !isViewingRelatedDoc;
                overviewTab.classList.toggle('active', isOverviewActive);

                if (coreDocTypes.includes(parentPhase)) {
                    overviewTab.dataset.doc = parentPhase;
                }
            }
        }
    }

    // Update stale warning banner
    const staleBanner = document.getElementById('stale-banner');
    if (staleBanner) {
        const currentStaleness = navState.stalenessMap?.[currentDoc];
        if (currentStaleness?.isStale) {
            staleBanner.style.display = '';
            staleBanner.innerHTML = `
                <span class="stale-banner-message">${currentStaleness.staleReason}</span>
                <button id="stale-regen" class="stale-regen-btn">Regenerate</button>
            `;
            const regenBtn = document.getElementById('stale-regen');
            regenBtn?.addEventListener('click', () => {
                vscode.postMessage({ type: 'regenerate' });
            });
        } else {
            staleBanner.style.display = 'none';
            staleBanner.innerHTML = '';
        }
    }

    // Update footer buttons based on footerState
    if (navState.footerState) {
        const approveButton = document.getElementById('approve');
        const actionsRight = document.querySelector('.actions-right');

        if (navState.footerState.showApproveButton) {
            if (approveButton) {
                approveButton.textContent = navState.footerState.approveText;
                approveButton.style.display = '';
            } else if (actionsRight) {
                const newButton = document.createElement('button');
                newButton.id = 'approve';
                newButton.className = 'primary';
                newButton.textContent = navState.footerState.approveText;
                newButton.addEventListener('click', () => {
                    vscode.postMessage({ type: 'approve' });
                });
                actionsRight.appendChild(newButton);
            }
        } else {
            if (approveButton) {
                approveButton.style.display = 'none';
            }
        }

        // Update enhancement buttons
        const actionsLeft = document.querySelector('.actions-left');
        if (actionsLeft && navState.footerState.enhancementButtons) {
            // Clear existing enhancement buttons
            actionsLeft.innerHTML = '';
            for (const btn of navState.footerState.enhancementButtons) {
                const button = document.createElement('button');
                button.className = 'enhancement';
                button.dataset.command = btn.command;
                button.title = btn.tooltip || '';
                button.innerHTML = `<span class="icon">${btn.icon}</span> ${btn.label}`;
                button.addEventListener('click', () => {
                    vscode.postMessage({ type: 'clarify' });
                });
                actionsLeft.appendChild(button);
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

            const phase = btn.dataset.phase;
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
