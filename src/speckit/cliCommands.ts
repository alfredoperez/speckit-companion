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
        }),

        vscode.commands.registerCommand('speckit.upgrade', async () => {
            const pick = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(sync) Upgrade All',
                        description: "Refresh the spec-kit CLI and this project's scaffolding",
                        commandId: 'speckit.upgradeAll',
                    },
                    {
                        label: '$(refresh) Upgrade Project',
                        description: "Refresh this workspace's scaffolding for your AI provider",
                        commandId: 'speckit.upgradeProject',
                    },
                    {
                        label: '$(cloud-download) Upgrade CLI',
                        description: 'Install the latest spec-kit CLI globally',
                        commandId: 'speckit.upgradeCli',
                    },
                ],
                { title: 'SpecKit: Upgrade', placeHolder: 'Choose what to upgrade' }
            );
            if (pick) {
                await vscode.commands.executeCommand(pick.commandId);
            }
        })
    );
}
