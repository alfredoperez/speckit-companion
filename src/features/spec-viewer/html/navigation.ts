/**
 * SpecKit Companion - Navigation HTML Generation
 * Generates the compact navigation bar HTML
 */

import { SpecDocument, DocumentType } from '../types';

/**
 * Generate the unified navigation bar (merged tabs + stepper)
 */
export function generateCompactNav(
    coreDocs: SpecDocument[],
    relatedDocs: SpecDocument[],
    currentDocType: DocumentType,
    workflowPhase: 'spec' | 'plan' | 'tasks' | 'done',
    isViewingRelatedDoc: boolean,
    taskCompletionPercent: number
): string {
    // Calculate if project is complete (persists regardless of current view)
    const isProjectComplete = taskCompletionPercent === 100;

    // Unified step-tabs: each step is a tab with status indicator
    // Note: "Done" is no longer a step - it's shown as a completion badge instead
    const phases = ['spec', 'plan', 'tasks'] as const;
    const stepTabsHtml = phases.map((phase, i) => {
        const doc = coreDocs.find(d => d.type === phase);
        const exists = doc?.exists ?? false;
        const isViewing = phase === currentDocType || (isViewingRelatedDoc && phase === 'plan');
        const isWorkflow = phase === workflowPhase;
        const isClickable = exists || phase === 'spec';
        const inProgress = phase === 'tasks' && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        // Review mode: viewing a completed step that isn't the current workflow phase
        // This helps distinguish "actively working on a step" vs "reviewing a completed step"
        const isReviewing = isViewing && exists && phase !== workflowPhase && !isViewingRelatedDoc;

        // Tasks-active: viewing tasks with progress (special prominent state)
        const isTasksActive = phase === 'tasks' && isViewing && inProgress;

        const classes = [
            'step-tab',
            exists ? 'exists' : '',
            isReviewing ? 'reviewing' : (isViewing ? 'viewing' : ''),
            isTasksActive ? 'tasks-active' : '',
            isWorkflow && !isViewing ? 'workflow' : '',
            !isClickable ? 'disabled' : '',
            inProgress && !isTasksActive ? 'in-progress' : ''
        ].filter(Boolean).join(' ');

        const label = phase.charAt(0).toUpperCase() + phase.slice(1);
        // Show percentage for tasks in-progress, checkmark for completed files
        const statusIcon = inProgress ? `${taskCompletionPercent}%` : (exists ? '✓' : '');

        // Connector line between steps
        const connector = i < phases.length - 1
            ? `<span class="step-connector ${exists ? 'filled' : ''}"></span>`
            : '';

        return `<button class="${classes}" data-phase="${phase}" ${!isClickable ? 'disabled' : ''}>
            <span class="step-status">${statusIcon}</span>
            <span class="step-label">${label}</span>
        </button>${connector}`;
    }).join('');

    // Add completion badge when tasks are 100% complete (persists when reviewing earlier steps)
    // Positioned on the right side of nav
    const completionBadge = isProjectComplete
        ? `<span class="completion-badge">🌱 Spec Completed</span>`
        : '';

    // Related docs bar - only show when viewing plan or related docs
    // Hide in Tasks view since related docs belong to the Plan phase, not Tasks
    const showRelatedBar = relatedDocs.length > 0 && (currentDocType === 'plan' || isViewingRelatedDoc);
    const isCoreDoc = ['spec', 'plan', 'tasks'].includes(currentDocType);

    // Get the parent phase for overview tab (spec, plan, or tasks)
    const parentPhase = isViewingRelatedDoc ? 'plan' : currentDocType;
    const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;

    const relatedTabsHtml = relatedDocs.map(doc => {
        const isActive = doc.type === currentDocType;
        return `<button class="related-tab ${isActive ? 'active' : ''}" data-doc="${doc.type}">${doc.displayName}</button>`;
    }).join('');

    // Build the related bar with Overview tab and centered layout
    const relatedBarHtml = showRelatedBar
        ? `<div class="related-bar" style="${showRelatedBar ? '' : 'display: none;'}">
                <div class="related-bar-content">
                    <button class="overview-tab ${isOverviewActive ? 'active' : ''}" data-doc="${parentPhase}">Overview</button>
                    <span class="overview-divider"></span>
                    <div class="related-tabs">${relatedTabsHtml}</div>
                </div>
            </div>`
        : '';

    return `
        <nav class="compact-nav">
            <div class="nav-primary">
                <div class="step-tabs">${stepTabsHtml}</div>
                ${completionBadge}
            </div>
            ${relatedBarHtml}
        </nav>`;
}
