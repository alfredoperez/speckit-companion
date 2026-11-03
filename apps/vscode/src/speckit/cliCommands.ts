import * as vscode from 'vscode';
import { SpecKitDetector } from './detector';
import { getProjectRoot } from '../core/projectRoot';
import { resolveCompanionGap, type CompanionGap } from './companionVersionGap';
import { installedAgents, specifyVersion } from './specKitUpgrade';

function companionVersionText(gap: CompanionGap | undefined): string {
    if (gap?.state === 'outdated') return `${gap.installed} → ${gap.expected}`;
    return gap?.state === 'missing' ? 'not installed' : '';
}

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
            const root = getProjectRoot();
            const version = await specifyVersion();
            const agents = root ? installedAgents(root) : [];
            const gap = root ? resolveCompanionGap(root, context.extensionPath) : undefined;
            const pick = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(sync) Upgrade All',
                        description: 'The three steps below, in one terminal',
                        commandId: 'speckit.upgradeAll',
                    },
                    {
                        label: '$(cloud-download) 1 · Spec Kit CLI',
                        description: version?.cli ?? '',
                        detail: "Runs specify self upgrade; if that isn't available, the uv command spec-kit's install page gives.",
                        commandId: 'speckit.upgradeCli',
                    },
                    {
                        label: "$(refresh) 2 · This project's agents",
                        description: agents.join(', '),
                        detail: 'Runs specify integration upgrade for each agent, then re-adds Companion. Your constitution and specs are not touched.',
                        commandId: 'speckit.upgradeProject',
                    },
                    {
                        label: "$(extensions) 3 · Companion's spec-kit extension",
                        description: companionVersionText(gap),
                        detail: 'Installs or re-adds Companion for this project.',
                        commandId: 'speckit.companion.installSpecKitExtension',
                    },
                ],
                { title: 'Spec Kit updates', placeHolder: 'Each step runs the command spec-kit documents, in a terminal you can watch' }
            );
            if (pick) {
                await vscode.commands.executeCommand(pick.commandId);
            }
        })
    );
}
