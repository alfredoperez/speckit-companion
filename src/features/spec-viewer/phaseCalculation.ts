/**
 * SpecKit Companion - Phase Calculation
 * Calculates workflow phases and progress
 */

import { SpecDocument, DocumentType, PhaseInfo } from './types';

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
        const specExists = documents.some(d => d.type === 'spec' && d.exists);
        const planExists = documents.some(d => d.type === 'plan' && d.exists);
        const tasksExists = documents.some(d => d.type === 'tasks' && d.exists);
        const taskCompletion = currentDocType === 'tasks' ? calculateTaskCompletion(content, 'tasks') : 0;

        return [
            { phase: 1, label: 'Spec', completed: specExists, active: currentDocType === 'spec' },
            { phase: 2, label: 'Plan', completed: planExists, active: currentDocType === 'plan' },
            { phase: 3, label: 'Tasks', completed: tasksExists, active: currentDocType === 'tasks', progressPercent: tasksExists ? taskCompletion : undefined },
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
        const isTasksLike = doc.type === 'tasks';
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
    switch (docType) {
        case 'spec': return 1;
        case 'plan': return 2;
        case 'tasks': return 3;
        default: return 1;
    }
}

/**
 * Calculate task completion percentage from content
 */
export function calculateTaskCompletion(content: string, docType: DocumentType): number {
    if (docType !== 'tasks' || !content) return 0;

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
    return coreDocs[0]?.type ?? 'spec';
}
