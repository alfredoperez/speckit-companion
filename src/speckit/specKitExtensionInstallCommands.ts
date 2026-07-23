import * as vscode from 'vscode';
import { runInstallSpecKitExtension, openReadmeFallback } from './specKitExtensionInstall';
import { coerceInstallPromptSurface, reportInstallPromptClicked } from '../core/telemetry';
import { ConfigKeys } from '../core/constants';
import { CONTEXT_KEYS, setContextKey } from '../core/utils/contextKeys';

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
        // Surface-tagged install trigger used by the sidebar CTA row and the
        // empty-state welcome button so the install funnel records which surface converted.
        vscode.commands.registerCommand('speckit.companion.installNudge', (surface?: unknown) => {
            const known = coerceInstallPromptSurface(surface);
            if (known) {
                reportInstallPromptClicked(known);
            }
            void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
        }),
        // Dismiss the intrusive empty-state install nudge, remembered across sessions.
        vscode.commands.registerCommand('speckit.companion.dismissInstallNudge', async () => {
            await context.globalState.update(ConfigKeys.globalState.installNudgeDismissed, true);
            await setContextKey(CONTEXT_KEYS.companionInstallNudgeDismissed, true);
        }),
        vscode.commands.registerCommand('speckit.companion.openReadme', () => {
            openReadmeFallback();
        })
    );
}
