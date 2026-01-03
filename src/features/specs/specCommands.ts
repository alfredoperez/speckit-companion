import * as vscode from 'vscode';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { SpecExplorerProvider } from './specExplorerProvider';
import { SpecKitDetector } from '../../speckit/detector';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import { sanitizeShellInput } from '../../core/utils/sanitize';
import type { SpecTreeItem } from '../../core/types/config';

/**
 * Register SpecKit workflow commands (create, specify, plan, tasks, etc.)
 */
export function registerSpecKitCommands(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    specKitDetector: SpecKitDetector,
    outputChannel: vscode.OutputChannel
): void {
    // SpecKit Create - Create new spec folder and invoke specify
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

            const description = await vscode.window.showInputBox({
                title: 'Create New Spec',
                prompt: 'Describe the feature you want to build',
                placeHolder: 'Enter your feature description...',
                ignoreFocusOut: true
            });

            if (!description) {
                return;
            }

            // Sanitize user input to prevent command injection
            const sanitizedDescription = sanitizeShellInput(description);
            if (!sanitizedDescription) {
                vscode.window.showErrorMessage('Please enter a valid description.');
                return;
            }

            NotificationUtils.showAutoDismissNotification('Creating spec with SpecKit. Check the terminal for progress.');

            const prompt = `/speckit.specify ${sanitizedDescription}`;
            await getAIProvider().executeInTerminal(prompt, 'SpecKit - Creating Spec');
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

    // Watch specs/ directory
    const specsWatcher = vscode.workspace.createFileSystemWatcher('**/specs/**/*');
    specsWatcher.onDidCreate(() => specExplorer.refresh());
    specsWatcher.onDidDelete(() => specExplorer.refresh());
    specsWatcher.onDidChange(() => specExplorer.refresh());
    context.subscriptions.push(specsWatcher);
}

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
            vscode.commands.registerCommand(`speckit.${cmd.name}`, async (specDir?: string) => {
                outputChannel.appendLine(`[SpecKit] ${cmd.title} command triggered for: ${specDir}`);

                const targetDir = specDir || await getActiveSpecDir();
                if (!targetDir) {
                    vscode.window.showErrorMessage('No spec directory found. Create a spec first.');
                    return;
                }

                const prompt = `/speckit.${cmd.name} ${targetDir}`;
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
