import * as vscode from 'vscode';
import { Commands } from '../../core/constants';
import { getProjectRoot } from '../../core/projectRoot';
import { processExtensionInfo, type ProcessExtensionId } from '../../speckit/processExtensions';
import type { ProcessCreateKind } from '../../protocol/processCreate';

const INSTALL = 'Install';
const TURN_ON = 'Turn it on';

const NEEDS: Record<ProcessCreateKind, { id: ProcessExtensionId; message: string }> = {
    bug: { id: 'bug', message: "Starting a bug needs Spec Kit's bug extension." },
    idea: { id: 'assess', message: "Assessing an idea needs Spec Kit's assess extension." },
};

export function registerProcessCreateCommands(
    context: vscode.ExtensionContext,
    provider: { show(kind: ProcessCreateKind): void },
): void {
    const open = async (kind: ProcessCreateKind): Promise<void> => {
        const root = getProjectRoot();
        if (!root) {
            void vscode.window.showErrorMessage('Open a project folder to start a bug or an idea.');
            return;
        }
        const { id, message } = NEEDS[kind];
        const extension = processExtensionInfo(root, id);
        if (extension.state === 'absent') {
            if (await vscode.window.showWarningMessage(message, INSTALL) === INSTALL) {
                await vscode.commands.executeCommand(Commands.processesInstallExtension, id);
            }
            return;
        }
        if (extension.disabled) {
            if (await vscode.window.showWarningMessage(`${message} It is turned off.`, TURN_ON) === TURN_ON) {
                await vscode.commands.executeCommand(Commands.processesEnableExtension, id);
            }
            return;
        }
        provider.show(kind);
    };

    context.subscriptions.push(
        vscode.commands.registerCommand(Commands.bugsCreate, () => open('bug')),
        vscode.commands.registerCommand(Commands.ideasCreate, () => open('idea')),
    );
}
