import * as vscode from 'vscode';
import { SpecKitDetector } from './detector';

/**
 * Register CLI-related commands (install, init, upgrade)
 */
export function registerCliCommands(
    context: vscode.ExtensionContext,
    specKitDetector: SpecKitDetector
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.installCli', async () => {
            await specKitDetector.installCli();
        }),

        vscode.commands.registerCommand('speckit.initWorkspace', async () => {
            await specKitDetector.initializeWorkspace();
        }),

        vscode.commands.registerCommand('speckit.upgradeCli', async () => {
            await specKitDetector.upgradeCli();
        }),

        vscode.commands.registerCommand('speckit.upgradeProject', async () => {
            await specKitDetector.upgradeProject();
        }),

        vscode.commands.registerCommand('speckit.upgradeAll', async () => {
            await specKitDetector.upgradeAll();
        })
    );
}
