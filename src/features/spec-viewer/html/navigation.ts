/**
 * SpecKit Companion - Navigation HTML Generation
 * Generates the compact navigation bar HTML
 */

import { SpecDocument, DocumentType, StalenessMap } from '../types';

/**
 * Generate the unified navigation bar (merged tabs + stepper)
 */
export function generateCompactNav(
    coreDocs: SpecDocument[],
    relatedDocs: SpecDocument[],
    currentDocType: DocumentType,
    workflowPhase: string,
    isViewingRelatedDoc: boolean,
    taskCompletionPercent: number,
    stalenessMap?: StalenessMap,
    activeStep?: string | null,
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>
): string {
    // Unified step-tabs: each core doc is a tab with status indicator
    const stepTabsHtml = coreDocs.map((doc, i) => {
        const phase = doc.type;
        const exists = doc.exists || relatedDocs.some(d => d.parentStep === phase);
        const isViewing = phase === currentDocType ||
            (isViewingRelatedDoc && relatedDocs.some(d => d.type === currentDocType && d.parentStep === phase));
        const isWorkflow = phase === workflowPhase;
        const isClickable = exists || i === 0;
        const isLastStep = i === coreDocs.length - 1;
        const inProgress = isLastStep && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        // Review mode: viewing a completed step that isn't the current workflow phase
        const isReviewing = isViewing && exists && phase !== workflowPhase && !isViewingRelatedDoc;

        // Tasks-active: viewing last step with progress (special prominent state)
        const isTasksActive = isLastStep && isViewing && inProgress;

        const isStale = stalenessMap?.[phase]?.isStale ?? false;

        const isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt;

        const classes = [
            'step-tab',
            exists ? 'exists' : '',
            isReviewing ? 'reviewing' : (isViewing ? 'viewing' : ''),
            isTasksActive ? 'tasks-active' : '',
            isWorkflow && !isViewing ? 'workflow' : '',
            isWorking ? 'working' : '',
            !isClickable ? 'disabled' : '',
            inProgress && !isTasksActive ? 'in-progress' : '',
            isStale ? 'stale' : ''
        ].filter(Boolean).join(' ');

        const label = doc.label;
        // Show percentage for last step in-progress, checkmark for completed files
        const statusIcon = inProgress ? `${taskCompletionPercent}%` : (exists ? '✓' : '');
        const staleBadge = isStale ? '<span class="stale-badge">!</span>' : '';

        // Connector line between steps
        const connector = i < coreDocs.length - 1
            ? `<span class="step-connector ${exists ? 'filled' : ''}"></span>`
            : '';

        return `<button class="${classes}" data-phase="${phase}" ${!isClickable ? 'disabled' : ''}>
            <span class="step-status">${statusIcon}</span>
            <span class="step-label">${label}</span>${staleBadge}
        </button>${connector}`;
    }).join('');

    // Related docs bar - show when the current step has related docs (filtered by parentStep)
    // or when viewing a related doc itself
    const relevantRelatedDocs = relatedDocs.filter(d =>
        d.parentStep === currentDocType
    );
    const showRelatedBar = (relevantRelatedDocs.length > 0 && coreDocs.some(d => d.type === currentDocType)) || isViewingRelatedDoc;
    const isCoreDoc = coreDocs.some(d => d.type === currentDocType);

    // Get the parent phase for overview tab
    const parentPhase = isViewingRelatedDoc
        ? (relatedDocs.find(d => d.type === currentDocType)?.parentStep || currentDocType)
        : currentDocType;
    const parentCoreDoc = coreDocs.find(d => d.type === parentPhase);
    const parentCoreExists = parentCoreDoc?.exists ?? false;
    const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;

    // When viewing a related doc, show siblings (docs with same parentStep)
    const displayRelatedDocs = isViewingRelatedDoc
        ? relatedDocs.filter(d => {
            const viewingDoc = relatedDocs.find(rd => rd.type === currentDocType);
            return !d.parentStep || d.parentStep === viewingDoc?.parentStep;
        })
        : relevantRelatedDocs;

    const relatedTabsHtml = displayRelatedDocs.map(doc => {
        const isActive = doc.type === currentDocType;
        return `<button class="related-tab ${isActive ? 'active' : ''}" data-doc="${doc.type}">${doc.label}</button>`;
    }).join('');

    // Build the related bar with Overview tab and centered layout
    // Only show Overview tab when the core step file exists
    const overviewTabHtml = parentCoreExists
        ? `<button class="overview-tab ${isOverviewActive ? 'active' : ''}" data-doc="${parentPhase}">Overview</button>
                    <span class="overview-divider"></span>`
        : '';

    const relatedBarHtml = showRelatedBar
        ? `<div class="related-bar">
                <div class="related-bar-content">
                    ${overviewTabHtml}
                    <div class="related-tabs">${relatedTabsHtml}</div>
                </div>
            </div>`
        : '';

    return `
        <nav class="compact-nav">
            <div class="nav-primary">
                <div class="step-tabs">${stepTabsHtml}</div>
            </div>
            ${relatedBarHtml}
        </nav>`;
}
