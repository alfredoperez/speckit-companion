import * as vscode from 'vscode';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { SpecExplorerProvider } from './specExplorerProvider';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import type { CustomCommandConfig, SpecTreeItem } from '../../core/types/config';
import { Commands, ConfigKeys, WorkflowSteps } from '../../core/constants';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import { buildPrompt } from '../../ai-providers/promptBuilder';
import { isInsideSpecDirectory, getFileWatcherPatterns } from '../../core/specDirectoryResolver';
import {
    getOrSelectWorkflow,
    resolveStepCommand,
    executeCheckpointsForTrigger,
    normalizeWorkflowConfig,
    WorkflowStep,
    WorkflowConfig,
} from '../workflows';
import { updateStepProgress } from './specContextManager';
import { startStep, setStatus, reactivate } from './stepLifecycle';
import { updateSelectionContextKeys } from './selectionContextKeys';
import { track as trackTerminal } from './terminalStepTracker';
import type { StepName } from '../../core/types/specContext';

function toWorkspaceRelative(absOrRel: string): string {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!ws) return absOrRel;
    const rel = path.relative(ws, absOrRel);
    return rel && !rel.startsWith('..') ? rel : absOrRel;
}

const LIFECYCLE_STEPS: ReadonlySet<string> = new Set([
    'specify',
    'plan',
    'tasks',
    'implement',
    'clarify',
    'analyze',
]);

/**
 * Register SpecKit workflow commands (create, specify, plan, tasks, etc.)
 */
export function registerSpecKitCommands(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    outputChannel: vscode.OutputChannel,
    specsTreeView?: vscode.TreeView<any>
): void {
    function resolveTargets(item: SpecTreeItem | undefined, items: SpecTreeItem[] | undefined): SpecTreeItem[] {
        if (items && items.length > 0) return items;
        if (item) return [item];
        const selection = (specsTreeView?.selection || []) as SpecTreeItem[];
        return selection.filter(s => (s as any)?.contextValue === 'spec');
    }

    function pluralize(count: number, singular: string, plural: string): string {
        return count === 1 ? `1 spec ${singular}` : `${count} specs ${plural}`;
    }
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

    // Toggle collapse/expand all specs — single button in the view title bar.
    // Two menu entries (collapse / expand) swap icons via the
    // speckit.specs.allCollapsed context key; both forward to the same toggle
    // handler so state stays in sync.
    //
    // Both directions flip the provider flag and refresh. The provider encodes
    // the flag into the spec-item id on each emit, so VS Code treats the items
    // as fresh and honors the emitted collapsibleState. Group items keep stable
    // ids so their expansion state is untouched by the toggle.
    const toggleCollapseAllHandler = async () => {
        specExplorer.expandAllSpecs = !specExplorer.expandAllSpecs;
        await vscode.commands.executeCommand(
            'setContext',
            'speckit.specs.allCollapsed',
            !specExplorer.expandAllSpecs
        );
        specExplorer.refresh();
    };
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.specs.toggleCollapseAll', toggleCollapseAllHandler),
        vscode.commands.registerCommand('speckit.specs.collapseAll', toggleCollapseAllHandler),
        vscode.commands.registerCommand('speckit.specs.expandAll', toggleCollapseAllHandler)
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

    function specDirFor(item: SpecTreeItem, wsPath: string): string {
        const relativePath = (item as SpecTreeItem).specPath || `specs/${item.label}`;
        return path.join(wsPath, relativePath);
    }

    async function runBulkStatusChange(
        item: SpecTreeItem | undefined,
        items: SpecTreeItem[] | undefined,
        apply: (specDir: string) => Promise<void>,
        singular: string,
        plural: string
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;
        const targets = resolveTargets(item, items);
        updateSelectionContextKeys(targets as any);
        if (targets.length === 0) return;
        await Promise.all(targets.map(t => apply(specDirFor(t, workspaceFolder.uri.fsPath))));
        specExplorer.refresh();
        NotificationUtils.showAutoDismissNotification(pluralize(targets.length, singular, plural));
    }

    // Mark as Completed
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.markCompleted', async (item: SpecTreeItem, items?: SpecTreeItem[]) => {
            await runBulkStatusChange(
                item,
                items,
                specDir => setStatus(specDir, 'completed'),
                'marked as completed',
                'marked as completed'
            );
        })
    );

    // Archive spec
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.archive', async (item: SpecTreeItem, items?: SpecTreeItem[]) => {
            await runBulkStatusChange(
                item,
                items,
                specDir => setStatus(specDir, 'archived'),
                'archived',
                'archived'
            );
        })
    );

    // Reactivate (Move to Active)
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.reactivate', async (item: SpecTreeItem, items?: SpecTreeItem[]) => {
            await runBulkStatusChange(
                item,
                items,
                specDir => reactivate(specDir),
                'moved to active',
                'moved to active'
            );
        })
    );

    // Watch configured spec directories with a shared 300ms debounce — long
    // enough to coalesce bursts of writes (editors fire write→rename→cleanup
    // within ~50ms) so the tree doesn't flicker, short enough that refreshes
    // feel instant.
    const watcherPatterns = getFileWatcherPatterns();
    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = () => {
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => specExplorer.refresh(), 300);
    };
    for (const pattern of watcherPatterns.specs) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidCreate(debouncedRefresh);
        watcher.onDidDelete(debouncedRefresh);
        watcher.onDidChange(debouncedRefresh);
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
const DEFAULT_WORKFLOW_STEP_NAMES = [WorkflowSteps.SPECIFY, WorkflowSteps.PLAN, WorkflowSteps.TASKS, WorkflowSteps.IMPLEMENT];

/**
 * Register phase-specific commands (specify, plan, tasks, implement, etc.)
 */
function registerPhaseCommands(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    outputChannel: vscode.OutputChannel
): void {
    const phaseCommands = [
        { name: WorkflowSteps.SPECIFY, title: 'Specify', isWorkflowStep: true },
        { name: WorkflowSteps.PLAN, title: 'Plan', isWorkflowStep: true },
        { name: WorkflowSteps.TASKS, title: 'Tasks', isWorkflowStep: true },
        { name: WorkflowSteps.IMPLEMENT, title: 'Implement', isWorkflowStep: true },
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
                const formattedCmd = formatCommandForProvider(`speckit.${cmd.name}`);
                let prompt = `/${formattedCmd} ${targetDir}`;
                if (refinementContext) {
                    prompt += refinementContext;
                }
                if (LIFECYCLE_STEPS.has(cmd.name)) {
                    await startStep(targetDir, cmd.name as StepName, 'extension');
                }
                const wrapped = buildPrompt({
                    command: prompt,
                    step: cmd.name,
                    specDir: toWorkspaceRelative(targetDir),
                });
                const terminal = await getAIProvider().executeInTerminal(wrapped, `SpecKit - ${cmd.title}`);
                if (LIFECYCLE_STEPS.has(cmd.name)) {
                    trackTerminal(terminal, targetDir, cmd.name as StepName);
                }
            })
        );
    }

    // Constitution command (no spec directory required)
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.constitution', async () => {
            outputChannel.appendLine(`[SpecKit] Constitution command triggered`);

            const prompt = `/${formatCommandForProvider('speckit.constitution')}`;
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

    // Build and execute the prompt (format command for current provider)
    const formatted = formatCommandForProvider(command);
    let prompt = `/${formatted} ${targetDir}`;
    if (refinementContext) {
        prompt += refinementContext;
    }

    if (LIFECYCLE_STEPS.has(step)) {
        await startStep(targetDir, step as StepName, 'extension');
    }
    const wrapped = buildPrompt({
        command: prompt,
        step,
        specDir: toWorkspaceRelative(targetDir),
    });
    const terminal = await getAIProvider().executeInTerminal(wrapped, `SpecKit - ${title}`);
    if (LIFECYCLE_STEPS.has(step)) {
        trackTerminal(terminal, targetDir, step as StepName);
    }

    // Execute checkpoints after implement step
    if (step === WorkflowSteps.IMPLEMENT) {
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
