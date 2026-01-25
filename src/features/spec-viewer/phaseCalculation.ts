/**
 * SpecKit Companion - Phase Calculation
 * Calculates workflow phases and progress
 */

import { SpecDocument, DocumentType, PhaseInfo } from './types';

/**
 * Calculate phase information for the stepper
 */
export function calculatePhases(
    documents: SpecDocument[],
    currentDocType: DocumentType,
    content: string
): PhaseInfo[] {
    const specExists = documents.some(d => d.type === 'spec' && d.exists);
    const planExists = documents.some(d => d.type === 'plan' && d.exists);
    const tasksExists = documents.some(d => d.type === 'tasks' && d.exists);
    const taskCompletion = currentDocType === 'tasks' ? calculateTaskCompletion(content, 'tasks') : 0;

    return [
        {
            phase: 1,
            label: 'Spec',
            completed: specExists,
            active: currentDocType === 'spec'
        },
        {
            phase: 2,
            label: 'Plan',
            completed: planExists,
            active: currentDocType === 'plan'
        },
        {
            phase: 3,
            label: 'Tasks',
            completed: tasksExists,
            active: currentDocType === 'tasks',
            progressPercent: tasksExists ? taskCompletion : undefined
        },
        {
            phase: 4,
            label: 'Done',
            completed: taskCompletion === 100,
            active: false,
            progressPercent: tasksExists ? taskCompletion : undefined
        }
    ];
}

/**
 * Get phase number from document type
 */
export function getPhaseNumber(docType: DocumentType): 1 | 2 | 3 | 4 {
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
 * Calculate current workflow phase based on which files exist
 * Returns: 'spec' | 'plan' | 'tasks' | 'done'
 */
export function calculateWorkflowPhase(coreDocs: SpecDocument[]): 'spec' | 'plan' | 'tasks' | 'done' {
    const specExists = coreDocs.find(d => d.type === 'spec')?.exists;
    const planExists = coreDocs.find(d => d.type === 'plan')?.exists;
    const tasksExists = coreDocs.find(d => d.type === 'tasks')?.exists;

    if (tasksExists) return 'tasks';
    if (planExists) return 'plan';
    if (specExists) return 'spec';
    return 'spec';
}
