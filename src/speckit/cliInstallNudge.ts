import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigKeys } from '../core/constants';
import { AIProviderType, providerDispatchesToTerminal } from '../ai-providers/aiProvider';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';
import { reportInstallPromptShown } from '../core/telemetry';

/** Inputs to the render decision — all pre-resolved so the predicate stays pure. */
export interface CliInstallNudgeGateInput {
    specKitDetected: boolean;
    companionInstalled: boolean;
    dismissed: boolean;
    providerDispatchesToTerminal: boolean;
    alreadyShownThisSession: boolean;
}

/**
 * Whether the CLI install hint should render. True only when spec-kit is
 * detected, the companion extension is absent, the shared dismissal is unset,
 * the provider dispatches to a terminal, and it has not shown this session.
 * Both the wrapper below and the tests call this exact function — no gate is
 * re-derived inline.
 */
export function shouldShowCliInstallNudge(input: CliInstallNudgeGateInput): boolean {
    return (
        input.specKitDetected &&
        !input.companionInstalled &&
        !input.dismissed &&
        input.providerDispatchesToTerminal &&
        !input.alreadyShownThisSession
    );
}

// Once per session: the hint is a quiet reminder, not a per-dispatch banner.
let shownThisSession = false;

/** Reset the per-session guard. Test-only — never called in production. */
export function __resetCliInstallNudgeSession(): void {
    shownThisSession = false;
}

/**
 * Resolve the gate inputs and, when the hint should render, show a single
 * non-blocking install notification tagged to the `terminal` surface. Reuses the
 * #543 install command and the shared `installNudgeDismissed` dismissal — no
 * parallel system. Never throws: any failure is swallowed so the dispatched
 * command always proceeds.
 */
export function maybeShowCliInstallNudge(
    context: vscode.ExtensionContext,
    root: string | undefined,
    providerType: AIProviderType
): void {
    try {
        if (!root) {
            return;
        }
        const dismissed = context.globalState.get<boolean>(
            ConfigKeys.globalState.installNudgeDismissed,
            false
        );
        const input: CliInstallNudgeGateInput = {
            specKitDetected: fs.existsSync(path.join(root, '.specify')),
            companionInstalled: isCompanionInstalled(root),
            dismissed,
            providerDispatchesToTerminal: providerDispatchesToTerminal(providerType),
            alreadyShownThisSession: shownThisSession,
        };
        if (!shouldShowCliInstallNudge(input)) {
            return;
        }
        // Burn the session slot and report the show under the SAME gate the hint renders on.
        shownThisSession = true;
        reportInstallPromptShown('terminal');
        void vscode.window
            .showInformationMessage(
                'Running spec-kit in the terminal — install the SpecKit Companion extension to unlock the richer Companion pipeline (status, resume, mark-complete).',
                'Install',
                "Don't show again"
            )
            .then(choice => {
                if (choice === 'Install') {
                    void vscode.commands.executeCommand('speckit.companion.installNudge', 'terminal');
                } else if (choice === "Don't show again") {
                    void vscode.commands.executeCommand('speckit.companion.dismissInstallNudge');
                }
            });
    } catch {
        /* the nudge must never block or fail the dispatched command */
    }
}
