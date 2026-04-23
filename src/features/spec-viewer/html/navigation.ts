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
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>
): string {
    // Unified step-tabs: each core doc is a tab with canonical state (R007, R008)
    // Running step is derived from stepHistory (entry with startedAt and no
    // completedAt) so this mirrors the webview's NavigationBar derivation.
    const runningStepIndex = (() => {
        if (!stepHistory) return -1;
        for (const [stepKey, entry] of Object.entries(stepHistory)) {
            if (entry?.startedAt && !entry?.completedAt) {
                const idx = coreDocs.findIndex(d => d.type === stepKey);
                if (idx >= 0) return idx;
            }
        }
        return -1;
    })();
    const runningStepKey = runningStepIndex >= 0 ? coreDocs[runningStepIndex].type : null;

    const stepTabsHtml = coreDocs.map((doc, i) => {
        const phase = doc.type;
        const stepDocExists = doc.exists;
        const exists = stepDocExists || relatedDocs.some(d => d.parentStep === phase);
        const isViewing = phase === currentDocType ||
            (isViewingRelatedDoc && relatedDocs.some(d => d.type === currentDocType && d.parentStep === phase));
        const isLastStep = i === coreDocs.length - 1;
        const inProgress = isLastStep && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        const isStale = stalenessMap?.[phase]?.isStale ?? false;

        const isWorking = runningStepKey === phase;

        const isLocked = runningStepIndex >= 0
            && i > runningStepIndex
            && !isViewing
            && !stepDocExists;
        const isClickable = (exists || i === 0) && !isLocked;

        // Precedence: locked > in-flight > current > done
        let canonicalState = '';
        if (isLocked) {
            canonicalState = 'locked';
        } else if (isWorking || inProgress) {
            canonicalState = 'in-flight';
        } else if (isViewing) {
            canonicalState = 'current';
        } else if (stepDocExists) {
            canonicalState = 'done';
        }

        const classes = [
            'step-tab',
            canonicalState,
            isStale ? 'stale' : ''
        ].filter(Boolean).join(' ');

        const label = doc.label;
        const statusIcon = canonicalState === 'in-flight' && inProgress
            ? `${taskCompletionPercent}%`
            : (canonicalState === 'done' ? '✓' : '');
        const staleBadge = isStale ? '<span class="stale-badge">!</span>' : '';
        const elapsedPlaceholder = canonicalState === 'in-flight' && !inProgress
            ? '<span class="step-tab__elapsed"></span>'
            : '';

        const connector = i < coreDocs.length - 1
            ? `<span class="step-connector ${exists ? 'filled' : ''}"></span>`
            : '';

        return `<button class="${classes}" data-phase="${phase}" aria-disabled="${!isClickable}" ${!isClickable ? 'disabled' : ''}>
            <span class="step-status">${statusIcon}</span>
            <span class="step-label">${label}</span>${elapsedPlaceholder}${staleBadge}
        </button>${connector}`;
    }).join('');

    // Related tabs render in a right-aligned slot inside .nav-primary.
    // Overview tab is removed (parent step-tab routes to overview already, R011).
    const relevantRelatedDocs = relatedDocs.filter(d =>
        d.parentStep === currentDocType
    );

    const displayRelatedDocs = isViewingRelatedDoc
        ? relatedDocs.filter(d => {
            const viewingDoc = relatedDocs.find(rd => rd.type === currentDocType);
            return !d.parentStep || d.parentStep === viewingDoc?.parentStep;
        })
        : relevantRelatedDocs;

    const relatedTabsHtml = displayRelatedDocs.length > 0
        ? `<div class="related-tabs">${displayRelatedDocs.map(doc => {
            const isActive = doc.type === currentDocType;
            return `<button class="related-tab ${isActive ? 'active' : ''}" data-doc="${doc.type}">${doc.label}</button>`;
        }).join('')}</div>`
        : '';

    return `
        <nav class="compact-nav">
            <div class="nav-primary">
                <div class="step-tabs">${stepTabsHtml}</div>
                ${relatedTabsHtml}
            </div>
        </nav>`;
}
