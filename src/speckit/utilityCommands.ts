import * as vscode from 'vscode';
import { HooksExplorerProvider } from '../features/hooks/hooksExplorerProvider';
import { MCPExplorerProvider } from '../features/mcp/mcpExplorerProvider';
import { UpdateChecker } from './updateChecker';

/**
 * Register utility commands (hooks, MCP, settings, updates)
 */
export function registerUtilityCommands(
    context: vscode.ExtensionContext,
    hooksExplorer: HooksExplorerProvider,
    mcpExplorer: MCPExplorerProvider,
    updateChecker: UpdateChecker,
    outputChannel: vscode.OutputChannel
): void {
    // Hooks commands
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.hooks.refresh', () => {
            hooksExplorer.refresh();
        })
    );

    // MCP commands
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.mcp.refresh', () => {
            mcpExplorer.refresh();
        })
    );

    // Update checker command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.checkForUpdates', async () => {
            outputChannel.appendLine('Manual update check requested');
            await updateChecker.checkForUpdates(true);
        })
    );

    // Settings command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.settings.open', async () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'speckit');
        })
    );
}
