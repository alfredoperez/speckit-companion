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
 * Compute a human-readable badge text from spec-context fields
 */
export function computeBadgeText(ctx?: {
    step?: string | null;
    next?: string | null;
    task?: string | null;
    status?: string;
} | null): string | null {
    if (!ctx) return null;

    if (ctx.status === SpecStatuses.COMPLETED) return 'COMPLETED';
    if (ctx.status === SpecStatuses.ARCHIVED) return 'ARCHIVED';

    // Show next action based on current step
    if (ctx.step === WorkflowSteps.IMPLEMENT && ctx.task) return `IMPLEMENTING ${ctx.task}`;
    if (ctx.step === WorkflowSteps.IMPLEMENT) return 'IMPLEMENTING';

    // Use next field to show what's coming
    if (ctx.next === WorkflowSteps.PLAN) return 'CREATE PLAN';
    if (ctx.next === WorkflowSteps.TASKS) return 'CREATE TASKS';
    if (ctx.next === WorkflowSteps.IMPLEMENT) return 'IMPLEMENT';
    if (ctx.next === 'done') return 'COMPLETED';

    // Fallback to current step
    if (ctx.step === WorkflowSteps.SPECIFY) return 'SPECIFYING';
    if (ctx.step === WorkflowSteps.PLAN) return 'PLANNING';
    if (ctx.step === WorkflowSteps.TASKS) return 'CREATING TASKS';

    return 'ACTIVE';
}
