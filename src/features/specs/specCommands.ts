import * as vscode from 'vscode';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { SpecExplorerProvider } from './specExplorerProvider';
import { SpecKitDetector } from '../../speckit/detector';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import type { CustomCommandConfig, SpecTreeItem } from '../../core/types/config';
import { Commands, ConfigKeys } from '../../core/constants';

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
 * Register phase-specific commands (specify, plan, tasks, implement, etc.)
 */
function registerPhaseCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    const phaseCommands = [
        { name: 'specify', title: 'Specify' },
        { name: 'plan', title: 'Plan' },
        { name: 'tasks', title: 'Tasks' },
        { name: 'implement', title: 'Implement' },
        { name: 'clarify', title: 'Clarify' },
        { name: 'analyze', title: 'Analyze' },
        { name: 'checklist', title: 'Checklist' },
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
