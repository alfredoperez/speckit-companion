import * as vscode from 'vscode';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { SpecExplorerProvider } from './specExplorerProvider';
import { SpecKitDetector } from '../../speckit/detector';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import type { CustomCommandConfig, SpecTreeItem } from '../../core/types/config';
import { Commands, ConfigKeys } from '../../core/constants';
import {
    getOrSelectWorkflow,
    resolveStepCommand,
    executeCheckpointsForTrigger,
    WorkflowStep,
    WorkflowConfig,
} from '../workflows';

/**
 * Register SpecKit workflow commands (create, specify, plan, tasks, etc.)
 */
export function registerSpecKitCommands(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    specKitDetector: SpecKitDetector,
    outputChannel: vscode.OutputChannel
): void {
    // SpecKit Create - Open the spec editor webview
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.create', async () => {
            outputChannel.appendLine('\n=== COMMAND speckit.create TRIGGERED ===');

            if (!specKitDetector.workspaceInitialized) {
                const result = await vscode.window.showWarningMessage(
                    'SpecKit is not initialized in this workspace.',
                    'Initialize SpecKit'
                );
                if (result === 'Initialize SpecKit') {
                    await specKitDetector.initializeWorkspace();
                }
                return;
            }

            // Open the spec editor webview
            await vscode.commands.executeCommand('speckit.openSpecEditor');
        })
    );

    // Spec refresh
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.refresh', async () => {
            outputChannel.appendLine('[Manual Refresh] Refreshing spec explorer...');
            specExplorer.refresh();
        })
    );

    // Spec delete
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.delete', async (item: SpecTreeItem) => {
            const confirm = await vscode.window.showWarningMessage(
                `Delete spec "${item.label}"? This cannot be undone.`,
                'Delete',
                'Cancel'
            );
            if (confirm === 'Delete') {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const specPath = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'specs', item.label));
                    await vscode.workspace.fs.delete(specPath, { recursive: true });
                    specExplorer.refresh();
                    NotificationUtils.showAutoDismissNotification(`Spec "${item.label}" deleted`);
                }
            }
        })
    );

    // Register phase commands
    registerPhaseCommands(context, outputChannel);
    registerCustomCommand(context, outputChannel);

    // Watch specs/ directory
    const specsWatcher = vscode.workspace.createFileSystemWatcher('**/specs/**/*');
    specsWatcher.onDidCreate(() => specExplorer.refresh());
    specsWatcher.onDidDelete(() => specExplorer.refresh());
    specsWatcher.onDidChange(() => specExplorer.refresh());
    context.subscriptions.push(specsWatcher);
}

type NormalizedCustomCommand = {
    label: string;
    description: string;
    command: string;
    requiresSpecDir: boolean;
    autoExecute: boolean;
};

/**
 * Workflow-enabled steps that support custom command mapping
 */
const WORKFLOW_STEPS: WorkflowStep[] = ['specify', 'plan', 'implement'];

/**
 * Register phase-specific commands (specify, plan, tasks, implement, etc.)
 */
function registerPhaseCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    const phaseCommands = [
        { name: 'specify', title: 'Specify', isWorkflowStep: true },
        { name: 'plan', title: 'Plan', isWorkflowStep: true },
        { name: 'tasks', title: 'Tasks', isWorkflowStep: false },
        { name: 'implement', title: 'Implement', isWorkflowStep: true },
        { name: 'clarify', title: 'Clarify', isWorkflowStep: false },
        { name: 'analyze', title: 'Analyze', isWorkflowStep: false },
        { name: 'checklist', title: 'Checklist', isWorkflowStep: false },
    ];

    for (const cmd of phaseCommands) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`speckit.${cmd.name}`, async (specDir?: string, refinementContext?: string) => {
                outputChannel.appendLine(`[SpecKit] ${cmd.title} command triggered for: ${specDir}`);

                const targetDir = specDir || await getActiveSpecDir();
                if (!targetDir) {
                    vscode.window.showErrorMessage('No spec directory found. Create a spec first.');
                    return;
                }

                // Handle workflow-enabled steps
                if (cmd.isWorkflowStep && WORKFLOW_STEPS.includes(cmd.name as WorkflowStep)) {
                    await executeWorkflowStep(
                        cmd.name as WorkflowStep,
                        cmd.title,
                        targetDir,
                        refinementContext,
                        outputChannel
                    );
                    return;
                }

                // Non-workflow steps use default command
                let prompt = `/speckit.${cmd.name} ${targetDir}`;
                if (refinementContext) {
                    prompt += refinementContext;
                }
                await getAIProvider().executeInTerminal(prompt, `SpecKit - ${cmd.title}`);
            })
        );
    }

    // Constitution command (no spec directory required)
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.constitution', async () => {
            outputChannel.appendLine(`[SpecKit] Constitution command triggered`);

            const prompt = `/speckit.constitution`;
            await getAIProvider().executeInTerminal(prompt, 'SpecKit - Constitution');
        })
    );
}

/**
 * Execute a workflow-enabled step with workflow selection and custom command mapping
 */
async function executeWorkflowStep(
    step: WorkflowStep,
    title: string,
    targetDir: string,
    refinementContext: string | undefined,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    // Get or select workflow for this feature
    const workflow = await getOrSelectWorkflow(targetDir);
    if (!workflow) {
        // User cancelled selection
        outputChannel.appendLine(`[SpecKit] ${title} cancelled - no workflow selected`);
        return;
    }

    outputChannel.appendLine(`[SpecKit] Using workflow: ${workflow.displayName || workflow.name}`);

    // Resolve the command for this step
    const command = resolveStepCommand(workflow, step);
    outputChannel.appendLine(`[SpecKit] Resolved command: ${command}`);

    // Check if command exists (warn if custom command may not exist)
    if (command !== `speckit.${step}`) {
        outputChannel.appendLine(`[SpecKit] Using custom command: ${command}`);
    }

    // Build and execute the prompt
    let prompt = `/${command} ${targetDir}`;
    if (refinementContext) {
        prompt += refinementContext;
    }

    await getAIProvider().executeInTerminal(prompt, `SpecKit - ${title}`);

    // Execute checkpoints after implement step
    if (step === 'implement') {
        await executeImplementCheckpoints(workflow, targetDir, outputChannel);
    }
}

/**
 * Execute checkpoints after the implement step
 */
async function executeImplementCheckpoints(
    workflow: WorkflowConfig,
    featureDir: string,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    const featureName = path.basename(featureDir);

    // Get current branch name
    let branchName = 'main';
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension) {
            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];
            if (repo && repo.state.HEAD) {
                branchName = repo.state.HEAD.name || 'main';
            }
        }
    } catch (error) {
        outputChannel.appendLine(`[SpecKit] Could not get branch name: ${error}`);
    }

    const context = {
        featureName,
        branchName,
        commitMessage: `feat(${featureName}): implement feature`,
    };

    // Execute 'after-implement' checkpoints
    outputChannel.appendLine(`[SpecKit] Checking for after-implement checkpoints...`);
    const results = await executeCheckpointsForTrigger(workflow, 'after-implement', featureDir, context);

    for (const result of results) {
        outputChannel.appendLine(`[SpecKit] Checkpoint result: ${result.status} - ${result.output || result.error || ''}`);
    }

    // Check if any checkpoint was completed that should trigger 'after-commit' checkpoints
    const commitCompleted = results.some(r => r.status === 'completed');
    if (commitCompleted) {
        outputChannel.appendLine(`[SpecKit] Checking for after-commit checkpoints...`);
        const afterCommitResults = await executeCheckpointsForTrigger(workflow, 'after-commit', featureDir, context);

        for (const result of afterCommitResults) {
            outputChannel.appendLine(`[SpecKit] Checkpoint result: ${result.status} - ${result.output || result.error || ''}`);
        }
    }
}

/**
 * Register custom command runner (Quick Pick)
 */
function registerCustomCommand(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(Commands.customCommand, async (specDir?: string) => {
            const customCommands = loadCustomCommands();

            if (customCommands.length === 0) {
                vscode.window.showInformationMessage('No custom commands configured. Add speckit.customCommands in settings.');
                return;
            }

            const selection = await vscode.window.showQuickPick(
                customCommands.map(command => ({
                    label: command.label,
                    description: command.description,
                    command
                })),
                {
                    title: 'Run SpecKit Custom Command',
                    placeHolder: 'Select a custom command'
                }
            );

            if (!selection) {
                return;
            }

            const selectedCommand = selection.command;
            const targetDir = selectedCommand.requiresSpecDir ? (specDir || await getActiveSpecDir()) : undefined;

            if (selectedCommand.requiresSpecDir && !targetDir) {
                vscode.window.showErrorMessage('No spec directory found. Open a spec file or pass a spec directory.');
                return;
            }

            let commandText = selectedCommand.command;
            if (selectedCommand.requiresSpecDir && targetDir) {
                if (commandText.includes('${specDir}')) {
                    commandText = commandText.replace(/\$\{specDir\}/g, targetDir);
                } else {
                    commandText = `${commandText} ${targetDir}`;
                }
            }

            outputChannel.appendLine(`[SpecKit] Custom command triggered: ${commandText}`);
            await getAIProvider().executeSlashCommand(
                commandText,
                `SpecKit - ${selectedCommand.label}`,
                selectedCommand.autoExecute
            );
        })
    );
}

function loadCustomCommands(): NormalizedCustomCommand[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const rawCommands = config.get<Array<CustomCommandConfig | string>>(
        'customCommands',
        []
    );

    const normalized = rawCommands
        .map(entry => normalizeCustomCommand(entry))
        .filter((entry): entry is NormalizedCustomCommand => entry !== null);

    return normalized;
}

function normalizeCustomCommand(entry: CustomCommandConfig | string): NormalizedCustomCommand | null {
    if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) {
            return null;
        }
        return buildCustomCommand({
            name: trimmed
        });
    }

    const name = entry.name?.trim();
    const title = entry.title?.trim();
    const command = entry.command?.trim();

    if (!name && !command) {
        return null;
    }

    return buildCustomCommand({
        name,
        title,
        command,
        requiresSpecDir: entry.requiresSpecDir,
        autoExecute: entry.autoExecute
    });
}

function buildCustomCommand(config: {
    name?: string;
    title?: string;
    command?: string;
    requiresSpecDir?: boolean;
    autoExecute?: boolean;
}): NormalizedCustomCommand | null {
    const rawCommand = config.command?.length ? config.command : config.name;
    if (!rawCommand) {
        return null;
    }

    let commandText = rawCommand.trim();
    if (!commandText.startsWith('/')) {
        if (commandText.startsWith('speckit.')) {
            commandText = `/${commandText}`;
        } else {
            commandText = `/speckit.${commandText}`;
        }
    }

    const label = config.title || config.name || commandText;
    const description = commandText;

    return {
        label,
        description,
        command: commandText,
        requiresSpecDir: config.requiresSpecDir ?? true,
        autoExecute: config.autoExecute ?? true
    };
}

/**
 * Get the spec directory from the currently active editor
 */
async function getActiveSpecDir(): Promise<string | undefined> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return undefined;
    }

    const filePath = activeEditor.document.fileName;
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check if file is in specs/ directory
    const specsMatch = normalizedPath.match(/\/specs\/([^/]+)\//);
    if (specsMatch) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.join(workspaceFolder.uri.fsPath, 'specs', specsMatch[1]);
        }
    }

    return undefined;
}
