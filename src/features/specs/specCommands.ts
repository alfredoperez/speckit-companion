import * as vscode from 'vscode';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { SpecExplorerProvider } from './specExplorerProvider';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import type { CustomCommandConfig, SpecTreeItem } from '../../core/types/config';
import { Commands, ConfigKeys } from '../../core/constants';
import { isInsideSpecDirectory, getFileWatcherPatterns } from '../../core/specDirectoryResolver';
import {
    getOrSelectWorkflow,
    resolveStepCommand,
    executeCheckpointsForTrigger,
    normalizeWorkflowConfig,
    WorkflowStep,
    WorkflowConfig,
} from '../workflows';
import { updateStepProgress, setSpecStatus } from './specContextManager';

/**
 * Register SpecKit workflow commands (create, specify, plan, tasks, etc.)
 */
export function registerSpecKitCommands(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    outputChannel: vscode.OutputChannel
): void {
    // SpecKit Create - Open the spec editor webview
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.create', async () => {
            outputChannel.appendLine('\n=== COMMAND speckit.create TRIGGERED ===');

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
                    // Use specPath from tree item if available, fall back to specs/<label>
                    const relativePath = (item as SpecTreeItem).specPath || `specs/${item.label}`;
                    const specPath = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, relativePath));
                    await vscode.workspace.fs.delete(specPath, { recursive: true });
                    specExplorer.refresh();
                    NotificationUtils.showAutoDismissNotification(`Spec "${item.label}" deleted`);
                }
            }
        })
    );

    // Open source file from sidebar inline action
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.openSpecSource', async (item: vscode.TreeItem & { fileUri?: vscode.Uri }) => {
            const uri = item?.fileUri ?? item?.resourceUri;
            if (uri) {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
            }
        })
    );

    // Register phase commands
    registerPhaseCommands(context, specExplorer, outputChannel);
    registerCustomCommand(context, outputChannel);

    // Mark as Completed
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.markCompleted', async (item: SpecTreeItem) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder && item) {
                const relativePath = (item as SpecTreeItem).specPath || `specs/${item.label}`;
                const specDir = path.join(workspaceFolder.uri.fsPath, relativePath);
                await setSpecStatus(specDir, 'completed');
                specExplorer.refresh();
                NotificationUtils.showAutoDismissNotification(`Spec "${item.label}" marked as completed`);
            }
        })
    );

    // Archive spec
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.archive', async (item: SpecTreeItem) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder && item) {
                const relativePath = (item as SpecTreeItem).specPath || `specs/${item.label}`;
                const specDir = path.join(workspaceFolder.uri.fsPath, relativePath);
                await setSpecStatus(specDir, 'archived');
                specExplorer.refresh();
                NotificationUtils.showAutoDismissNotification(`Spec "${item.label}" archived`);
            }
        })
    );

    // Watch configured spec directories
    const watcherPatterns = getFileWatcherPatterns();
    for (const pattern of watcherPatterns.specs) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidCreate(() => specExplorer.refresh());
        watcher.onDidDelete(() => specExplorer.refresh());
        watcher.onDidChange(() => specExplorer.refresh());
        context.subscriptions.push(watcher);
    }
}

type NormalizedCustomCommand = {
    label: string;
    description: string;
    command: string;
    requiresSpecDir: boolean;
    autoExecute: boolean;
};

/**
 * Default workflow step names that are always registered as VS Code commands
 */
const DEFAULT_WORKFLOW_STEP_NAMES = ['specify', 'plan', 'tasks', 'implement'];

/**
 * Register phase-specific commands (specify, plan, tasks, implement, etc.)
 */
function registerPhaseCommands(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    outputChannel: vscode.OutputChannel
): void {
    const phaseCommands = [
        { name: 'specify', title: 'Specify', isWorkflowStep: true },
        { name: 'plan', title: 'Plan', isWorkflowStep: true },
        { name: 'tasks', title: 'Tasks', isWorkflowStep: true },
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

                // Mark this spec as active (spinning indicator)
                const specName = path.basename(targetDir);
                specExplorer.setActiveSpec(specName);

                // Handle workflow-enabled steps (default steps + any step name from workflow)
                if (cmd.isWorkflowStep) {
                    await executeWorkflowStep(
                        cmd.name,
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

    // Update step progress in .spec-context.json
    const normalized = normalizeWorkflowConfig(workflow);
    const workflowStepNames = (normalized.steps || []).map(s => s.name);
    updateStepProgress(targetDir, step, workflowStepNames).catch(err => {
        outputChannel.appendLine(`[SpecKit] Failed to update step progress: ${err}`);
    });

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

            const selection = await vscode.window.showQuickPick(
                customCommands.map(command => ({
                    label: command.label,
                    description: command.description,
                    command
                })),
                {
                    title: 'Run SpecKit Custom Command',
                    placeHolder: customCommands.length === 0
                        ? 'No custom commands configured — add speckit.customCommands in settings'
                        : 'Select a custom command'
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
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return undefined;
    }

    const specRelPath = isInsideSpecDirectory(filePath, workspaceFolder.uri.fsPath);
    if (specRelPath) {
        return path.join(workspaceFolder.uri.fsPath, specRelPath);
    }

    return undefined;
}
