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
export function calculatePhases(
    documents: SpecDocument[],
    currentDocType: DocumentType,
    content: string,
    stepCount?: number
): PhaseInfo[] {
    // Default behavior: 4-phase stepper
    if (!stepCount || stepCount === 0) {
        const specExists = documents.some(d => d.type === CORE_DOCUMENTS.SPEC && d.exists);
        const planExists = documents.some(d => d.type === CORE_DOCUMENTS.PLAN && d.exists);
        const tasksExists = documents.some(d => d.type === CORE_DOCUMENTS.TASKS && d.exists);
        const taskCompletion = currentDocType === CORE_DOCUMENTS.TASKS ? calculateTaskCompletion(content, CORE_DOCUMENTS.TASKS) : 0;

        return [
            { phase: 1, label: 'Spec', completed: specExists, active: currentDocType === CORE_DOCUMENTS.SPEC },
            { phase: 2, label: 'Plan', completed: planExists, active: currentDocType === CORE_DOCUMENTS.PLAN },
            { phase: 3, label: 'Tasks', completed: tasksExists, active: currentDocType === CORE_DOCUMENTS.TASKS, progressPercent: tasksExists ? taskCompletion : undefined },
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

        phases.push({
            phase: phaseNum,
            label: doc.label,
            completed: doc.exists,
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
 * Compute a human-readable badge text from spec-context fields.
 * When progress is non-null (in-progress work), appends "..." suffix.
 */
export function computeBadgeText(ctx?: {
    currentStep?: string | null;
    progress?: string | null;
    currentTask?: string | null;
    status?: string;
} | null): string | null {
    if (!ctx) return null;

    if (ctx.status === SpecStatuses.COMPLETED) return 'COMPLETED';
    if (ctx.status === SpecStatuses.ARCHIVED) return 'ARCHIVED';

    const inProgress = ctx.progress != null;

    // Show next action based on current step
    if (ctx.currentStep === WorkflowSteps.IMPLEMENT && ctx.currentTask) return `IMPLEMENTING ${ctx.currentTask}${inProgress ? '...' : ''}`;
    if (ctx.currentStep === WorkflowSteps.IMPLEMENT) return `IMPLEMENTING${inProgress ? '...' : ''}`;

    // Fallback to current step (with in-progress suffix)
    if (ctx.currentStep === WorkflowSteps.SPECIFY) return `SPECIFYING${inProgress ? '...' : ''}`;
    if (ctx.currentStep === WorkflowSteps.PLAN) return `PLANNING${inProgress ? '...' : ''}`;
    if (ctx.currentStep === WorkflowSteps.TASKS) return `CREATING TASKS${inProgress ? '...' : ''}`;

    return 'ACTIVE';
}
