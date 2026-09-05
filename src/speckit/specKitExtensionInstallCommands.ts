import * as vscode from 'vscode';
import { runInstallSpecKitExtension, openReadmeFallback, recordUpdateAttempt } from './specKitExtensionInstall';
import { cachedCompanionGap } from './companionVersionGap';
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
        vscode.commands.registerCommand('speckit.companion.installSpecKitExtension', async () => {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            // Remembered so a second offer of the same gap — the published extension is not newer after
            // all — can stop asking instead of running an update that changes nothing.
            if (root) {
                await recordUpdateAttempt(context, cachedCompanionGap(root, context.extensionPath));
            }
            await runInstallSpecKitExtension(root);
        }),
        // Surface-tagged install trigger for the CTA row and welcome button; records which surface converted.
        vscode.commands.registerCommand('speckit.companion.installNudge', (surface?: unknown) => {
            const known = coerceInstallPromptSurface(surface);
            if (known) {
                reportInstallPromptClicked(known);
            }
            void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
        }),
        vscode.commands.registerCommand('speckit.companion.openReadme', () => {
            openReadmeFallback();
        })
    );
}
