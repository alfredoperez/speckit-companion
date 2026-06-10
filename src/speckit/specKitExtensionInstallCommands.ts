import * as vscode from 'vscode';
import { runInstallSpecKitExtension, openReadmeFallback } from './specKitExtensionInstall';

/**
 * Register the one-click install/update command for the companion spec-kit
 * extension and the README-fallback opener. Both are reused by every install
 * surface (Create-Spec banner, Activity banner, sidebar affordance, upgrade menu).
 */
export function registerSpecKitExtensionInstallCommands(
    context: vscode.ExtensionContext
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.companion.installSpecKitExtension', () => {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            runInstallSpecKitExtension(root);
        }),
        vscode.commands.registerCommand('speckit.companion.openReadme', () => {
            openReadmeFallback();
        })
    );
}
