import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { SpecInfo, RelatedDoc, EnhancementButton } from '../../../core/types';
import {
    DEFAULT_WORKFLOW,
    getFeatureWorkflow,
    getWorkflow,
    normalizeWorkflowConfig,
    getStepFile,
} from '../../workflows';
import type { WorkflowStepConfig } from '../../workflows';

/**
 * Get workflow steps for a spec directory (synchronous fallback to default)
 */
function getWorkflowStepsSync(): WorkflowStepConfig[] {
    return DEFAULT_WORKFLOW.steps!;
}

/**
 * Parse spec information from a document
 */
export function parseSpecInfo(document: vscode.TextDocument): SpecInfo {
    const fileName = path.basename(document.fileName);
    const dirPath = path.dirname(document.fileName);

    // Get workflow steps (sync — use default, async enrichment not available here)
    const steps = getWorkflowStepsSync();

    // Find the matching step for the current file
    const matchedStepIndex = steps.findIndex(s => getStepFile(s).toLowerCase() === fileName.toLowerCase());
    const matchedStep = matchedStepIndex >= 0 ? steps[matchedStepIndex] : null;

    let currentPhase = 1;
    let phaseIcon = '📋';
    let documentType: 'spec' | 'plan' | 'tasks' | 'other' = 'other';
    let enhancementButton: EnhancementButton | null = null;

    if (matchedStep) {
        currentPhase = matchedStepIndex + 1;
        // Map known step names to their icons and enhancement buttons
        switch (matchedStep.name) {
            case 'specify':
                phaseIcon = '📋';
                documentType = 'spec';
                enhancementButton = {
                    label: 'Clarify',
                    command: 'clarify',
                    icon: '?',
                    tooltip: 'Ask clarifying questions about ambiguous requirements'
                };
                break;
            case 'plan':
                phaseIcon = '🔷';
                documentType = 'plan';
                enhancementButton = {
                    label: 'Checklist',
                    command: 'checklist',
                    icon: '✓',
                    tooltip: 'Generate implementation checklist from design'
                };
                break;
            case 'tasks':
                phaseIcon = '✅';
                documentType = 'tasks';
                enhancementButton = {
                    label: 'Analyze',
                    command: 'analyze',
                    icon: '⚡',
                    tooltip: 'Analyze task dependencies and complexity'
                };
                break;
            default:
                phaseIcon = '📄';
                documentType = 'other';
                break;
        }
    } else if (fileName === 'research.md') {
        currentPhase = 2;
        phaseIcon = '🔍';
        documentType = 'plan';
    } else if (fileName.endsWith('.md')) {
        currentPhase = 2;
        phaseIcon = '📄';
        documentType = 'plan';
    }

    // Check if next phase file exists
    const nextStep = matchedStepIndex >= 0 && matchedStepIndex + 1 < steps.length
        ? steps[matchedStepIndex + 1]
        : null;
    const nextPhaseExists = nextStep
        ? fs.existsSync(path.join(dirPath, getStepFile(nextStep)))
        : false;

    // Calculate completed phases based on file existence
    const completedPhases: number[] = [];
    let taskCompletionPercent = 0;

    for (let i = 0; i < steps.length; i++) {
        const stepFile = getStepFile(steps[i]);
        const stepPath = path.join(dirPath, stepFile);
        if (fs.existsSync(stepPath)) {
            completedPhases.push(i + 1);

            // Check task completion for the last step that has checkboxes
            if (steps[i].name === 'tasks' || i === steps.length - 1) {
                const taskStats = getTaskCompletionStats(stepPath);
                if (taskStats.percent > 0) {
                    taskCompletionPercent = taskStats.percent;
                }
            }
        }
    }

    // Find ALL documents in same folder for tabs
    const stepFiles = steps.map(s => getStepFile(s));
    const allDocs = getRelatedDocs(dirPath, fileName, documentType, stepFiles);

    return {
        currentPhase,
        completedPhases,
        phaseIcon,
        progressPercent: (currentPhase / (steps.length + 1)) * 100,
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
 * Get related documents for tab display
 */
function getRelatedDocs(dirPath: string, currentFileName: string, documentType: string, mainDocs: string[] = ['spec.md', 'plan.md', 'tasks.md']): RelatedDoc[] {

    try {
        const files = fs.readdirSync(dirPath);
        // Get non-main docs
        const otherDocs = files.filter(f => f.endsWith('.md') && !mainDocs.includes(f));

        // For phase 2 (plan) or related docs, show tabs
        if (documentType === 'plan' || otherDocs.includes(currentFileName)) {
            // Collect all docs that exist
            const docsToShow: RelatedDoc[] = [];

            // Add plan.md first if it exists
            if (fs.existsSync(path.join(dirPath, 'plan.md'))) {
                docsToShow.push({
                    name: 'Plan',
                    fileName: 'plan.md',
                    path: path.join(dirPath, 'plan.md')
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
