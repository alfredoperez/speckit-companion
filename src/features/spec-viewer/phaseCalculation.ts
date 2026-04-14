/**
 * SpecKit Companion - Phase Calculation
 * Calculates workflow phases and progress
 */

import { CORE_DOCUMENTS, SpecDocument, DocumentType, PhaseInfo } from './types';
import { SpecStatuses, WorkflowSteps } from '../../core/constants';

/**
 * Calculate phase information for the stepper.
 * When `stepCount` is provided, generates phases dynamically for that many steps + Done.
 * Falls back to the default 4-phase (Spec, Plan, Tasks, Done) when not provided.
 */
/**
 * Override map: `{ stepName: StepBadgeState }` from `.spec-context.json`.
 * When supplied, phase `completed` flags are derived ONLY from stepHistory
 * (FR-007). File existence is ignored for completion.
 */
export function calculatePhases(
    documents: SpecDocument[],
    currentDocType: DocumentType,
    content: string,
    stepCount?: number,
    stepHistoryBadges?: Record<string, 'not-started' | 'in-progress' | 'completed'>
): PhaseInfo[] {
    const isCompletedByContext = (step: string): boolean | null => {
        if (!stepHistoryBadges) return null;
        const s = stepHistoryBadges[step];
        if (s === undefined) return false; // step not in history = not completed (no file-existence fallback)
        return s === 'completed';
    };
    // Default behavior: 4-phase stepper
    if (!stepCount || stepCount === 0) {
        const specExists = documents.some(d => d.type === CORE_DOCUMENTS.SPEC && d.exists);
        const planExists = documents.some(d => d.type === CORE_DOCUMENTS.PLAN && d.exists);
        const tasksExists = documents.some(d => d.type === CORE_DOCUMENTS.TASKS && d.exists);
        const taskCompletion = currentDocType === CORE_DOCUMENTS.TASKS ? calculateTaskCompletion(content, CORE_DOCUMENTS.TASKS) : 0;

        // US2: prefer stepHistory when context is available.
        const specDone = isCompletedByContext('specify');
        const planDone = isCompletedByContext('plan');
        const tasksDone = isCompletedByContext('tasks');

        return [
            { phase: 1, label: 'Spec', completed: specDone ?? specExists, active: currentDocType === CORE_DOCUMENTS.SPEC },
            { phase: 2, label: 'Plan', completed: planDone ?? planExists, active: currentDocType === CORE_DOCUMENTS.PLAN },
            { phase: 3, label: 'Tasks', completed: tasksDone ?? tasksExists, active: currentDocType === CORE_DOCUMENTS.TASKS, progressPercent: tasksExists ? taskCompletion : undefined },
            { phase: 4, label: 'Done', completed: taskCompletion === 100, active: false, progressPercent: tasksExists ? taskCompletion : undefined }
        ];
    }

    // Dynamic: one phase per core document step + Done
    const coreDocs = documents.filter(d => d.isCore);
    const phases: PhaseInfo[] = [];
    let lastTaskCompletion = 0;

    for (let i = 0; i < coreDocs.length; i++) {
        const doc = coreDocs[i];
        const phaseNum = (i + 1) as 1 | 2 | 3 | 4;
        const isTasksLike = doc.type === CORE_DOCUMENTS.TASKS;
        const taskCompletion = isTasksLike && currentDocType === doc.type
            ? calculateTaskCompletion(content, doc.type)
            : 0;
        if (isTasksLike) {
            lastTaskCompletion = taskCompletion;
        }

        // US2: stepHistory wins over file existence when available.
        const ctxCompleted = isCompletedByContext(doc.type);
        phases.push({
            phase: phaseNum,
            label: doc.label,
            completed: ctxCompleted ?? doc.exists,
            active: currentDocType === doc.type,
            progressPercent: isTasksLike && doc.exists ? taskCompletion : undefined
        });
    }

    // Add Done phase
    const donePhase = (coreDocs.length + 1) as 1 | 2 | 3 | 4;
    phases.push({
        phase: donePhase,
        label: 'Done',
        completed: lastTaskCompletion === 100,
        active: false,
        progressPercent: lastTaskCompletion > 0 ? lastTaskCompletion : undefined
    });

    return phases;
}

/**
 * Get phase number from document type.
 * When `stepNames` is provided, looks up position dynamically.
 */
export function getPhaseNumber(docType: DocumentType, stepNames?: string[]): 1 | 2 | 3 | 4 {
    if (stepNames) {
        const idx = stepNames.indexOf(docType);
        if (idx >= 0) {
            return (idx + 1) as 1 | 2 | 3 | 4;
        }
    }
    if (docType === CORE_DOCUMENTS.SPEC) return 1;
    if (docType === CORE_DOCUMENTS.PLAN) return 2;
    if (docType === CORE_DOCUMENTS.TASKS) return 3;
    return 1;
}

/**
 * Calculate task completion percentage from content
 */
export function calculateTaskCompletion(content: string, docType: DocumentType): number {
    if (docType !== CORE_DOCUMENTS.TASKS || !content) return 0;

    const checkboxPattern = /- \[([ xX])\]/g;
    const matches = content.matchAll(checkboxPattern);
    const matchArray = Array.from(matches);

    if (matchArray.length === 0) return 0;

    const completed = matchArray.filter(m => m[1].toLowerCase() === 'x').length;
    return Math.round((completed / matchArray.length) * 100);
}

/**
 * Calculate current workflow phase based on which files exist.
 * Returns the type of the last existing core doc, or the first step if none exist.
 */
export function calculateWorkflowPhase(coreDocs: SpecDocument[]): string {
    // Find the last existing doc — that's where the workflow "is"
    for (let i = coreDocs.length - 1; i >= 0; i--) {
        if (coreDocs[i].exists) {
            return coreDocs[i].type;
        }
    }
    return coreDocs[0]?.type ?? CORE_DOCUMENTS.SPEC;
}

/**
 * Map SDD step field to tab name
 */
export function mapSddStepToTab(step?: string | null): string | null {
    if (!step) return null;
    switch (step) {
        case WorkflowSteps.SPECIFY: return CORE_DOCUMENTS.SPEC;
        case WorkflowSteps.PLAN: return CORE_DOCUMENTS.PLAN;
        case WorkflowSteps.TASKS: return CORE_DOCUMENTS.TASKS;
        case WorkflowSteps.IMPLEMENT: return CORE_DOCUMENTS.TASKS;
        default: return null;
    }
}

/**
 * Format an ISO timestamp as a display date (e.g., "Apr 1, 2026").
 * Returns null if the timestamp is missing or unparseable.
 */
function formatDisplayDate(isoString?: string | null): string | null {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Compute "Created" date from stepHistory.
 * Uses specify.startedAt if available, otherwise earliest startedAt across all steps.
 */
export function computeCreatedDate(stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }> | null): string | null {
    if (!stepHistory) return null;

    // Prefer specify.startedAt
    const specifyEntry = stepHistory[WorkflowSteps.SPECIFY];
    if (specifyEntry?.startedAt) {
        return formatDisplayDate(specifyEntry.startedAt);
    }

    // Fallback: earliest startedAt across all steps
    let earliest: string | null = null;
    for (const entry of Object.values(stepHistory)) {
        if (entry.startedAt && (!earliest || entry.startedAt < earliest)) {
            earliest = entry.startedAt;
        }
    }
    return formatDisplayDate(earliest);
}

/**
 * Compute "Last Updated" date from stepHistory timestamps.
 * Returns null if only one timestamp exists (same as Created) to avoid redundancy.
 */
export function computeLastUpdatedDate(
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }> | null
): string | null {
    if (!stepHistory) return null;

    // Collect all timestamps
    const timestamps: string[] = [];
    for (const entry of Object.values(stepHistory)) {
        if (entry.startedAt) timestamps.push(entry.startedAt);
        if (entry.completedAt) timestamps.push(entry.completedAt);
    }

    if (timestamps.length <= 1) return null; // Same as Created or nothing — omit

    timestamps.sort();
    return formatDisplayDate(timestamps[timestamps.length - 1]);
}

/**
 * Map a workflow step name to a human-readable document type label.
 * E.g., "specify" → "Spec", "plan" → "Plan", "tasks" → "Tasks", "implement" → "Implementation"
 */
export function getDocTypeLabel(step?: string | null): string {
    if (!step) return 'Spec';
    switch (step) {
        case WorkflowSteps.SPECIFY: return 'Spec';
        case WorkflowSteps.PLAN: return 'Plan';
        case WorkflowSteps.TASKS: return 'Tasks';
        case WorkflowSteps.IMPLEMENT: return 'Implementation';
        default: return step.charAt(0).toUpperCase() + step.slice(1);
    }
}

/**
 * Map canonical status (`draft`, `specifying`, …) → human-readable badge text.
 * Used by US1 (single-status passthrough): the same string is shown in
 * sidebar, header, and stepper, regardless of active tab.
 */
const CANONICAL_STATUS_LABELS: Record<string, string> = {
    draft: 'DRAFT',
    specifying: 'SPECIFYING...',
    specified: 'SPECIFY COMPLETE',
    planning: 'PLANNING...',
    planned: 'PLAN COMPLETE',
    tasking: 'CREATING TASKS...',
    'ready-to-implement': 'READY TO IMPLEMENT',
    implementing: 'IMPLEMENTING...',
    completed: 'COMPLETED',
    archived: 'ARCHIVED',
};

export function canonicalStatusLabel(status?: string | null): string | null {
    if (!status) return null;
    return CANONICAL_STATUS_LABELS[status] ?? null;
}

/**
 * Compute a badge label from a single step's own state, independent of the
 * spec's overall progress. Used when the user is reviewing a step other than
 * `currentStep`.
 */
function badgeForViewedStep(
    step: string,
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>,
    stepDocExists?: Record<string, boolean>
): string {
    const entry = stepHistory?.[step];
    const started = !!entry?.startedAt;
    const completed = !!entry?.completedAt;
    const docExists = stepDocExists ? stepDocExists[step] !== false : true;

    const labels: Record<string, { complete: string; progress: string; none: string }> = {
        specify:   { complete: 'SPECIFY COMPLETE',  progress: 'SPECIFYING...',     none: 'SPECIFY NOT STARTED' },
        clarify:   { complete: 'CLARIFY COMPLETE',  progress: 'CLARIFYING...',     none: 'CLARIFY NOT STARTED' },
        plan:      { complete: 'PLAN COMPLETE',     progress: 'PLANNING...',       none: 'PLAN NOT STARTED' },
        tasks:     { complete: 'TASKS COMPLETE',    progress: 'CREATING TASKS...', none: 'TASKS NOT STARTED' },
        analyze:   { complete: 'ANALYZE COMPLETE',  progress: 'ANALYZING...',      none: 'ANALYZE NOT STARTED' },
        implement: { complete: 'IMPLEMENT COMPLETE',progress: 'IMPLEMENTING...',   none: 'IMPLEMENT NOT STARTED' },
    };
    const l = labels[step] ?? { complete: `${step.toUpperCase()} COMPLETE`, progress: `${step.toUpperCase()}...`, none: `${step.toUpperCase()} NOT STARTED` };

    if (completed && docExists) return l.complete;
    if (started && docExists) return l.progress;
    return l.none;
}

/**
 * Compute a human-readable badge text from spec-context fields.
 * When progress is non-null (in-progress work), appends "..." suffix.
 */
export function computeBadgeText(
    ctx?: {
        currentStep?: string | null;
        progress?: string | null;
        currentTask?: string | null;
        status?: string;
        stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    } | null,
    viewedStep?: string | null,
    stepDocExists?: Record<string, boolean>
): string | null {
    if (!ctx) return null;

    // Terminal statuses always win — they apply to the whole spec regardless of viewed tab.
    if (ctx.status === SpecStatuses.COMPLETED || ctx.status === 'completed') return 'COMPLETED';
    if (ctx.status === SpecStatuses.ARCHIVED || ctx.status === 'archived') return 'ARCHIVED';

    // R001: when viewing a non-current step, compute label from that step's own state.
    if (viewedStep && viewedStep !== ctx.currentStep) {
        return badgeForViewedStep(viewedStep, ctx.stepHistory, stepDocExists);
    }

    // US1: canonical status labels take precedence when status is the new vocab.
    const canonical = canonicalStatusLabel(ctx.status as string | undefined);
    if (canonical) return canonical;

    const inProgress = ctx.progress != null;
    const stepCompleted = ctx.currentStep && ctx.stepHistory?.[ctx.currentStep]?.completedAt;

    // Show next action based on current step
    if (ctx.currentStep === WorkflowSteps.IMPLEMENT && ctx.currentTask) return `IMPLEMENTING ${ctx.currentTask}${inProgress ? '...' : ''}`;
    if (ctx.currentStep === WorkflowSteps.IMPLEMENT && inProgress) return 'IMPLEMENTING...';
    if (ctx.currentStep === WorkflowSteps.IMPLEMENT && stepCompleted) return 'IMPLEMENT COMPLETE';
    if (ctx.currentStep === WorkflowSteps.IMPLEMENT) return 'IMPLEMENTING';

    // Step completion: completedAt set with no active progress
    if (stepCompleted && !inProgress) {
        const completionLabels: Record<string, string> = {
            [WorkflowSteps.SPECIFY]: 'SPECIFY COMPLETE',
            [WorkflowSteps.PLAN]: 'PLAN COMPLETE',
            [WorkflowSteps.TASKS]: 'TASKS COMPLETE',
        };
        const label = completionLabels[ctx.currentStep!];
        if (label) return label;
    }

    // Fallback to current step (with in-progress suffix)
    if (ctx.currentStep === WorkflowSteps.SPECIFY) return `SPECIFYING${inProgress ? '...' : ''}`;
    if (ctx.currentStep === WorkflowSteps.PLAN) return `PLANNING${inProgress ? '...' : ''}`;
    if (ctx.currentStep === WorkflowSteps.TASKS) return `CREATING TASKS${inProgress ? '...' : ''}`;

    return 'ACTIVE';
}
