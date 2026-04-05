import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { SpecInfo, RelatedDoc, EnhancementButton } from '../../../core/types';
import { WorkflowSteps } from '../../../core/constants';
import { CORE_DOCUMENTS } from '../../spec-viewer/types';
import {
    getFeatureWorkflow,
    getWorkflow,
    normalizeWorkflowConfig,
    getStepFile,
    DEFAULT_WORKFLOW,
    type WorkflowStepConfig,
    FEATURE_CONTEXT_FILE,
    LEGACY_CONTEXT_FILE,
} from '../../workflows';

/**
 * Resolve workflow steps for a spec directory.
 * Checks .spec-context.json first, then legacy .speckit.json.
 */
function resolveStepsSync(dirPath: string): WorkflowStepConfig[] {
    const filesToCheck = [FEATURE_CONTEXT_FILE, LEGACY_CONTEXT_FILE];

    for (const file of filesToCheck) {
        try {
            const contextPath = path.join(dirPath, file);
            if (fs.existsSync(contextPath)) {
                const content = fs.readFileSync(contextPath, 'utf-8');
                const ctx = JSON.parse(content);
                if (ctx.workflow) {
                    const wf = getWorkflow(ctx.workflow);
                    if (wf) {
                        const normalized = normalizeWorkflowConfig(wf);
                        if (normalized.steps && normalized.steps.length > 0) {
                            return normalized.steps;
                        }
                    }
                }
            }
        } catch {
            // fall through
        }
    }
    return DEFAULT_WORKFLOW.steps!;
}

/**
 * Parse spec information from a document
 */
export function parseSpecInfo(document: vscode.TextDocument): SpecInfo {
    const fileName = path.basename(document.fileName);
    const dirPath = path.dirname(document.fileName);

    // Resolve workflow steps dynamically (exclude action-only steps)
    const steps = resolveStepsSync(dirPath).filter(s => !s.actionOnly);

    // Build step-to-file and file-to-step maps
    const fileToStep = new Map<string, WorkflowStepConfig>();
    for (const step of steps) {
        fileToStep.set(getStepFile(step), step);
    }

    // Detect current phase and document type based on workflow steps
    let currentPhase = 1;
    let phaseIcon = '📋';
    let documentType: 'spec' | 'plan' | 'tasks' | 'other' = 'other';
    let enhancementButton: EnhancementButton | null = null;

    const matchedStep = fileToStep.get(fileName);
    if (matchedStep) {
        const stepIndex = steps.indexOf(matchedStep);
        currentPhase = stepIndex + 1;

        // Map known step names to icons and types
        const iconMap: Record<string, string> = { [WorkflowSteps.SPECIFY]: '📋', [WorkflowSteps.PLAN]: '🔷', [WorkflowSteps.TASKS]: '✅', [WorkflowSteps.IMPLEMENT]: '🚀' };
        phaseIcon = iconMap[matchedStep.name] || '📄';

        // Map to documentType (for backward compat with spec/plan/tasks)
        if (matchedStep.name === WorkflowSteps.SPECIFY || getStepFile(matchedStep) === 'spec.md') {
            documentType = CORE_DOCUMENTS.SPEC;
            enhancementButton = { label: 'Clarify', command: 'clarify', icon: '?', tooltip: 'Ask clarifying questions about ambiguous requirements' };
        } else if (matchedStep.name === WorkflowSteps.PLAN || getStepFile(matchedStep) === 'plan.md') {
            documentType = CORE_DOCUMENTS.PLAN;
            enhancementButton = { label: 'Checklist', command: 'checklist', icon: '✓', tooltip: 'Generate implementation checklist from design' };
        } else if (matchedStep.name === WorkflowSteps.TASKS || getStepFile(matchedStep) === 'tasks.md') {
            documentType = CORE_DOCUMENTS.TASKS;
            enhancementButton = { label: 'Analyze', command: 'analyze', icon: '⚡', tooltip: 'Analyze task dependencies and complexity' };
        } else {
            documentType = 'other';
        }
    } else if (fileName === 'research.md') {
        currentPhase = 2;
        phaseIcon = '🔍';
        documentType = CORE_DOCUMENTS.PLAN;
    } else if (fileName.endsWith('.md')) {
        currentPhase = 2;
        phaseIcon = '📄';
        documentType = CORE_DOCUMENTS.PLAN;
    }

    // Check if next phase file exists
    const nextStepIndex = currentPhase; // 0-indexed next = currentPhase (since currentPhase is 1-indexed)
    const nextStep = steps[nextStepIndex];
    const nextPhaseExists = nextStep ? fs.existsSync(path.join(dirPath, getStepFile(nextStep))) : false;

    // Calculate completed phases based on file existence
    const completedPhases: number[] = [];
    let taskCompletionPercent = 0;

    for (let i = 0; i < steps.length; i++) {
        const stepFile = getStepFile(steps[i]);
        const stepPath = path.join(dirPath, stepFile);
        if (fs.existsSync(stepPath)) {
            completedPhases.push(i + 1);

            // Check task completion for steps that produce tasks-like files
            if (steps[i].name === WorkflowSteps.TASKS || stepFile === 'tasks.md') {
                const taskStats = getTaskCompletionStats(stepPath);
                taskCompletionPercent = taskStats.percent;
            }
        }
    }

    const totalPhases = steps.length + 1; // steps + Done
    const allDocs = getRelatedDocs(dirPath, fileName, documentType, steps);

    return {
        currentPhase,
        completedPhases,
        phaseIcon,
        progressPercent: (currentPhase / totalPhases) * 100,
        taskCompletionPercent,
        specDir: dirPath,
        documentType,
        enhancementButton,
        nextPhaseExists,
        currentFileName: fileName,
        allDocs
    };
}

/**
 * Get related documents for tab display.
 * Uses workflow steps to determine which files are "main" docs.
 */
function getRelatedDocs(dirPath: string, currentFileName: string, documentType: string, steps?: WorkflowStepConfig[]): RelatedDoc[] {
    // Build the set of main doc filenames from workflow steps
    const mainDocs = steps
        ? steps.map(s => getStepFile(s))
        : ['spec.md', 'plan.md', 'tasks.md'];

    try {
        const files = fs.readdirSync(dirPath);
        // Get non-main docs
        const otherDocs = files.filter(f => f.endsWith('.md') && !mainDocs.includes(f));

        // For plan-like docs or related docs, show tabs
        if (documentType === CORE_DOCUMENTS.PLAN || otherDocs.includes(currentFileName)) {
            const docsToShow: RelatedDoc[] = [];

            // Add the plan step's file first if it exists
            const planFile = steps
                ? getStepFile(steps.find(s => s.name === WorkflowSteps.PLAN) || { name: WorkflowSteps.PLAN, command: '' })
                : 'plan.md';
            if (fs.existsSync(path.join(dirPath, planFile))) {
                docsToShow.push({
                    name: 'Plan',
                    fileName: planFile,
                    path: path.join(dirPath, planFile)
                });
            }

            // Add other docs and sort alphabetically
            const sortedOtherDocs = [...otherDocs].sort((a, b) => a.localeCompare(b));
            sortedOtherDocs.forEach(f => {
                docsToShow.push({
                    name: formatDocName(f.replace('.md', '')),
                    fileName: f,
                    path: path.join(dirPath, f)
                });
            });

            return docsToShow;
        }
    } catch {
        // Ignore errors
    }

    return [];
}

/**
 * Format document name: capitalize and replace dashes with spaces
 */
export function formatDocName(name: string): string {
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Get task completion stats from tasks.md
 * Returns { complete: boolean, percent: number }
 */
function getTaskCompletionStats(tasksPath: string): { complete: boolean; percent: number } {
    try {
        const content = fs.readFileSync(tasksPath, 'utf-8');
        const unchecked = (content.match(/- \[ \]/g) || []).length;
        const checked = (content.match(/- \[x\]/gi) || []).length;
        const total = checked + unchecked;

        if (total === 0) {
            return { complete: false, percent: 0 };
        }

        const percent = Math.round((checked / total) * 100);
        const complete = checked > 0 && unchecked === 0;

        return { complete, percent };
    } catch {
        return { complete: false, percent: 0 };
    }
}
