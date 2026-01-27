/**
 * Checkpoint Handler
 *
 * Handles checkpoint execution for commit and PR generation.
 * Provides prompts for user approval and executes git operations.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    WorkflowConfig,
    CheckpointConfig,
    CheckpointTrigger,
    CheckpointResult,
    CheckpointContext,
    CheckpointId,
    FeatureWorkflowContext,
    FEATURE_CONTEXT_FILE,
} from './types';

/**
 * Get checkpoints triggered after a specific event
 * @param workflow Workflow configuration
 * @param trigger Trigger event
 * @returns Array of checkpoints to execute
 */
export function getTriggeredCheckpoints(
    workflow: WorkflowConfig,
    trigger: CheckpointTrigger
): CheckpointConfig[] {
    if (!workflow.checkpoints || workflow.checkpoints.length === 0) {
        return [];
    }

    return workflow.checkpoints.filter(cp => cp.trigger === trigger);
}

/**
 * Prompt user for checkpoint approval
 * @param checkpoint Checkpoint configuration
 * @param featureDir Path to feature directory
 * @returns True if approved, false if declined
 */
export async function promptForApproval(
    checkpoint: CheckpointConfig,
    featureDir: string
): Promise<boolean> {
    const featureName = path.basename(featureDir);
    const checkpointDescription =
        checkpoint.id === 'commit'
            ? `Create a commit for "${featureName}"?`
            : `Create a pull request for "${featureName}"?`;

    const result = await vscode.window.showInformationMessage(
        checkpointDescription,
        { modal: false },
        'Yes',
        'No'
    );

    return result === 'Yes';
}

/**
 * Execute a commit checkpoint
 * @param checkpoint Checkpoint configuration
 * @param featureDir Path to feature directory
 * @param context Checkpoint context
 * @returns Execution result
 */
export async function executeCommit(
    checkpoint: CheckpointConfig,
    featureDir: string,
    context: CheckpointContext
): Promise<CheckpointResult> {
    try {
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return {
                status: 'skipped',
                error: 'No workspace folder found',
            };
        }

        // Build commit message
        let commitMessage = context.commitMessage || `feat(${context.featureName}): implement feature`;

        // Add co-author unless excluded
        if (!checkpoint.excludeCoAuthor) {
            commitMessage += '\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
        }

        // Create terminal and execute git commands
        const terminal = vscode.window.createTerminal({
            name: 'SpecKit - Commit',
            cwd: workspaceFolder.uri.fsPath,
        });

        terminal.show();
        terminal.sendText(`git add -A && git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Update checkpoint status
        await updateCheckpointStatus(featureDir, 'commit', 'completed');

        return {
            status: 'completed',
            output: 'Commit created successfully',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            status: 'skipped',
            error: `Failed to create commit: ${errorMessage}`,
        };
    }
}

/**
 * Execute a PR checkpoint
 * @param checkpoint Checkpoint configuration
 * @param featureDir Path to feature directory
 * @param context Checkpoint context
 * @returns Execution result
 */
export async function executePR(
    checkpoint: CheckpointConfig,
    featureDir: string,
    context: CheckpointContext
): Promise<CheckpointResult> {
    try {
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return {
                status: 'skipped',
                error: 'No workspace folder found',
            };
        }

        // Build PR title
        let prTitle = checkpoint.prTitleTemplate || `feat: ${context.featureName}`;
        prTitle = prTitle.replace(/\$\{featureName\}/g, context.featureName);

        // Create terminal and execute gh CLI
        const terminal = vscode.window.createTerminal({
            name: 'SpecKit - PR',
            cwd: workspaceFolder.uri.fsPath,
        });

        terminal.show();
        terminal.sendText(`gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --fill`);

        // Update checkpoint status
        await updateCheckpointStatus(featureDir, 'pr', 'completed');

        return {
            status: 'completed',
            output: 'PR creation initiated',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            status: 'skipped',
            error: `Failed to create PR: ${errorMessage}`,
        };
    }
}

/**
 * Execute a checkpoint (orchestrates approval and execution)
 * @param checkpoint Checkpoint configuration
 * @param featureDir Path to feature directory
 * @param context Checkpoint context
 * @returns Execution result
 */
export async function executeCheckpoint(
    checkpoint: CheckpointConfig,
    featureDir: string,
    context: CheckpointContext
): Promise<CheckpointResult> {
    // Check if approval is required
    const requiresApproval = checkpoint.requiresApproval !== false;

    if (requiresApproval) {
        const approved = await promptForApproval(checkpoint, featureDir);
        if (!approved) {
            await updateCheckpointStatus(featureDir, checkpoint.id, 'skipped');
            return {
                status: 'skipped',
                output: 'User declined checkpoint',
            };
        }
    }

    // Execute based on checkpoint type
    if (checkpoint.id === 'commit') {
        return executeCommit(checkpoint, featureDir, context);
    } else if (checkpoint.id === 'pr') {
        return executePR(checkpoint, featureDir, context);
    }

    return {
        status: 'skipped',
        error: `Unknown checkpoint type: ${checkpoint.id}`,
    };
}

/**
 * Update checkpoint status in .speckit.json
 * @param featureDir Path to feature directory
 * @param checkpointId Checkpoint identifier
 * @param status New status
 */
async function updateCheckpointStatus(
    featureDir: string,
    checkpointId: CheckpointId,
    status: 'pending' | 'completed' | 'skipped'
): Promise<void> {
    const contextPath = path.join(featureDir, FEATURE_CONTEXT_FILE);

    try {
        let context: FeatureWorkflowContext;

        try {
            const content = await fs.promises.readFile(contextPath, 'utf-8');
            context = JSON.parse(content);
        } catch {
            // File doesn't exist, create minimal context
            context = {
                workflow: 'default',
                selectedAt: new Date().toISOString(),
            };
        }

        // Update checkpoint status
        if (!context.checkpointStatus) {
            context.checkpointStatus = {} as Record<CheckpointId, 'pending' | 'completed' | 'skipped'>;
        }
        context.checkpointStatus[checkpointId] = status;

        await fs.promises.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to update checkpoint status:', error);
    }
}

/**
 * Execute all checkpoints for a given trigger
 * @param workflow Workflow configuration
 * @param trigger Trigger event
 * @param featureDir Path to feature directory
 * @param context Checkpoint context
 * @returns Array of execution results
 */
export async function executeCheckpointsForTrigger(
    workflow: WorkflowConfig,
    trigger: CheckpointTrigger,
    featureDir: string,
    context: CheckpointContext
): Promise<CheckpointResult[]> {
    const checkpoints = getTriggeredCheckpoints(workflow, trigger);
    const results: CheckpointResult[] = [];

    for (const checkpoint of checkpoints) {
        const result = await executeCheckpoint(checkpoint, featureDir, context);
        results.push(result);

        // Stop execution if checkpoint failed (unless it was skipped by user)
        if (result.status === 'skipped' && result.error) {
            const retry = await vscode.window.showErrorMessage(
                `Checkpoint "${checkpoint.id}" failed: ${result.error}`,
                'Retry',
                'Skip',
                'Cancel'
            );

            if (retry === 'Retry') {
                const retryResult = await executeCheckpoint(checkpoint, featureDir, context);
                results[results.length - 1] = retryResult;
            } else if (retry === 'Cancel') {
                break;
            }
            // 'Skip' continues to next checkpoint
        }
    }

    return results;
}
