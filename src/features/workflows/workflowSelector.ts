/**
 * Workflow Selector
 *
 * Resolves which workflow a feature runs: an existing recorded selection wins,
 * else the effective default. The Create Spec form is the only interactive
 * workflow picker — there is no standalone quick-pick surface.
 */

import * as vscode from 'vscode';
import { WorkflowConfig } from './types';
import { getWorkflows, getFeatureWorkflow, saveFeatureWorkflow, getWorkflow, resolveEffectiveDefaultWorkflow } from './workflowManager';

/**
 * Shared logic to resolve the default workflow for a feature directory.
 * Returns the workflow config without any side effects (no disk writes).
 */
async function resolveDefaultWorkflow(featureDir: string, outputChannel?: vscode.OutputChannel): Promise<WorkflowConfig | undefined> {
    // Check if feature has existing workflow. Same tolerance for transient
    // read failures as the interactive picker above.
    let existingContext: Awaited<ReturnType<typeof getFeatureWorkflow>>;
    try {
        existingContext = await getFeatureWorkflow(featureDir);
    } catch (err) {
        outputChannel?.appendLine(
            `[workflowSelector] resolveDefaultWorkflow: getFeatureWorkflow failed — ${err instanceof Error ? err.message : String(err)}`,
        );
        existingContext = undefined;
    }
    if (existingContext) {
        const workflow = getWorkflow(existingContext.workflow);
        if (workflow) {
            return workflow;
        }
        // Workflow no longer exists, fall through to default
    }

    // Get the effective default workflow: an explicit setting wins; otherwise
    // an unset default resolves to companion when the companion extension is installed.
    // Resolve the root from the feature's own folder (correct in multi-root workspaces).
    const root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(featureDir))?.uri.fsPath
        ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const defaultWorkflowName = resolveEffectiveDefaultWorkflow(root);
    const workflows = getWorkflows(outputChannel);

    let selectedWorkflow = workflows.find(w => w.name === defaultWorkflowName);

    if (!selectedWorkflow) {
        outputChannel?.appendLine(
            `[Workflows] Default workflow "${defaultWorkflowName}" not found. Using built-in default.`
        );
        selectedWorkflow = workflows[0];
    }

    return selectedWorkflow;
}

/**
 * Resolve the workflow for a feature without writing to disk.
 * Used by read-only paths (tree rendering, viewer init) that should never modify .spec-context.json.
 * @param featureDir Path to feature directory
 * @returns Resolved workflow config
 */
export async function resolveWorkflow(featureDir: string, outputChannel?: vscode.OutputChannel): Promise<WorkflowConfig | undefined> {
    return resolveDefaultWorkflow(featureDir, outputChannel);
}

/**
 * Get the workflow for a feature, auto-selecting and persisting based on settings.
 * Only use this from explicit user actions (step execution, workflow selection).
 * @param featureDir Path to feature directory
 * @returns Selected workflow or undefined if cancelled
 */
export async function getOrSelectWorkflow(featureDir: string, outputChannel?: vscode.OutputChannel): Promise<WorkflowConfig | undefined> {
    const workflow = await resolveDefaultWorkflow(featureDir, outputChannel);
    if (workflow) {
        await saveFeatureWorkflow(featureDir, workflow.name);
    }
    return workflow;
}
