/**
 * Workflow Selector
 *
 * Provides UI for selecting a workflow when multiple workflows are available.
 * Uses VS Code QuickPick for workflow selection.
 */

import * as vscode from 'vscode';
import { WorkflowConfig } from './types';
import { getWorkflows, getFeatureWorkflow, saveFeatureWorkflow, getWorkflow } from './workflowManager';
import { ConfigKeys } from '../../core/constants';

/**
 * Check if workflow selection is needed
 * @returns True if multiple workflows are configured
 */
export function needsSelection(): boolean {
    const workflows = getWorkflows();
    return workflows.length > 1;
}

/**
 * Show workflow selection picker
 * @param featureDir Path to feature directory (for context)
 * @returns Selected workflow or undefined if cancelled
 */
export async function selectWorkflow(featureDir: string): Promise<WorkflowConfig | undefined> {
    const workflows = getWorkflows();

    // If only default workflow, auto-select it
    if (workflows.length === 1) {
        return workflows[0];
    }

    // Check if feature already has a workflow selected
    const existingContext = await getFeatureWorkflow(featureDir);
    if (existingContext) {
        const existingWorkflow = getWorkflow(existingContext.workflow);
        if (existingWorkflow) {
            // Ask if user wants to keep existing or select new
            const action = await vscode.window.showQuickPick(
                [
                    {
                        label: `$(check) Continue with "${existingWorkflow.displayName || existingWorkflow.name}"`,
                        description: 'Use the previously selected workflow',
                        action: 'keep' as const,
                    },
                    {
                        label: '$(list-selection) Select a different workflow',
                        description: 'Choose a new workflow for this feature',
                        action: 'select' as const,
                    },
                ],
                {
                    title: 'Workflow Selection',
                    placeHolder: `This feature is using the "${existingWorkflow.displayName || existingWorkflow.name}" workflow`,
                }
            );

            if (!action) {
                return undefined; // User cancelled
            }

            if (action.action === 'keep') {
                return existingWorkflow;
            }
            // Fall through to show picker
        }
    }

    // Build quick pick items
    const items = workflows.map(workflow => ({
        label: workflow.displayName || workflow.name,
        description: workflow.name === 'default' ? '(built-in)' : '',
        detail: buildWorkflowDetail(workflow),
        workflow,
    }));

    const selection = await vscode.window.showQuickPick(items, {
        title: 'Select Workflow',
        placeHolder: 'Choose a workflow for this feature',
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!selection) {
        return undefined; // User cancelled
    }

    // Save selection to feature context
    await saveFeatureWorkflow(featureDir, selection.workflow.name);

    return selection.workflow;
}

/**
 * Build detail string for workflow quick pick item
 */
function buildWorkflowDetail(workflow: WorkflowConfig): string {
    const parts: string[] = [];

    if (workflow.description) {
        parts.push(workflow.description);
    }

    // Show step mappings if custom
    const customSteps: string[] = [];
    if (workflow['step-specify'] && workflow['step-specify'] !== 'speckit.specify') {
        customSteps.push(`specify: ${workflow['step-specify']}`);
    }
    if (workflow['step-plan'] && workflow['step-plan'] !== 'speckit.plan') {
        customSteps.push(`plan: ${workflow['step-plan']}`);
    }
    if (workflow['step-tasks'] && workflow['step-tasks'] !== 'speckit.tasks') {
        customSteps.push(`tasks: ${workflow['step-tasks']}`);
    }
    if (workflow['step-implement'] && workflow['step-implement'] !== 'speckit.implement') {
        customSteps.push(`implement: ${workflow['step-implement']}`);
    }

    if (customSteps.length > 0) {
        parts.push(`Steps: ${customSteps.join(', ')}`);
    }

    // Show checkpoint info
    if (workflow.checkpoints && workflow.checkpoints.length > 0) {
        const checkpointTypes = workflow.checkpoints.map(cp => cp.id).join(', ');
        parts.push(`Checkpoints: ${checkpointTypes}`);
    }

    return parts.join(' | ') || 'Standard SpecKit workflow';
}

/**
 * Get the workflow for a feature, auto-selecting based on settings
 * @param featureDir Path to feature directory
 * @returns Selected workflow or undefined if cancelled
 */
export async function getOrSelectWorkflow(featureDir: string, outputChannel?: vscode.OutputChannel): Promise<WorkflowConfig | undefined> {
    // Check if feature has existing workflow
    const existingContext = await getFeatureWorkflow(featureDir);
    if (existingContext) {
        const workflow = getWorkflow(existingContext.workflow);
        if (workflow) {
            return workflow;
        }
        // Workflow no longer exists, need to select new one
    }

    // Get the configured default workflow
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const defaultWorkflowName = config.get<string>('defaultWorkflow', 'default');
    const workflows = getWorkflows(outputChannel);

    // Find the configured default workflow
    let selectedWorkflow = workflows.find(w => w.name === defaultWorkflowName);

    if (!selectedWorkflow) {
        // Configured workflow doesn't exist, log and fall back silently
        outputChannel?.appendLine(
            `[Workflows] Default workflow "${defaultWorkflowName}" not found. Using built-in default.`
        );
        selectedWorkflow = workflows[0];
    }

    // Auto-select the default workflow
    await saveFeatureWorkflow(featureDir, selectedWorkflow.name);
    return selectedWorkflow;
}
