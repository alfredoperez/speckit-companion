import * as vscode from 'vscode';
import { Commands } from '../../core/constants';
import { getProjectRoot } from '../../core/projectRoot';
import { coerceProcessExtensionId, runSpecifyExtensionAdd } from '../../speckit/processExtensions';

interface Refreshable {
    refresh(): void;
}

export function registerProcessCommands(
    context: vscode.ExtensionContext,
    panes: { bugs: Refreshable; ideas: Refreshable },
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(Commands.bugsRefresh, () => panes.bugs.refresh()),
        vscode.commands.registerCommand(Commands.ideasRefresh, () => panes.ideas.refresh()),
        vscode.commands.registerCommand(Commands.processesInstallExtension, (requested?: unknown) => {
            const id = coerceProcessExtensionId(requested);
            return id ? runSpecifyExtensionAdd(id, getProjectRoot()) : undefined;
        }),
    );
}
