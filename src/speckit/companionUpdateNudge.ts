import * as vscode from 'vscode';
import { ConfigKeys } from '../core/constants';
import { updateBannerText } from '../protocol/viewer';
import type { CompanionGap } from './companionVersionGap';
import { readInstallPromptEnabled } from './specKitExtensionInstall';

const INSTALL_COMMAND = 'speckit.companion.installSpecKitExtension';

/** Inputs to the notification decision, pre-resolved so the predicate stays pure. */
export interface CompanionUpdateNudgeGateInput {
    enabled: boolean;
    gap: CompanionGap;
    notifiedFor: string | undefined;
    skippedVersion: string | undefined;
}

/** One notification per expected version: not when opted out, not after it has fired for this version, and not once the user skipped it. */
export function shouldShowCompanionUpdateNudge(input: CompanionUpdateNudgeGateInput): boolean {
    return (
        input.enabled &&
        input.gap.state === 'outdated' &&
        input.notifiedFor !== input.gap.expected &&
        input.skippedVersion !== input.gap.expected
    );
}

/** On activation, tell the user once per version that the installed spec-kit half is behind. Never throws. */
export function maybeShowCompanionUpdateNudge(context: vscode.ExtensionContext, gap: CompanionGap): void {
    try {
        const show = shouldShowCompanionUpdateNudge({
            enabled: readInstallPromptEnabled(),
            gap,
            notifiedFor: context.globalState.get<string>(ConfigKeys.globalState.companionUpdateNotifiedFor),
            skippedVersion: context.globalState.get<string>(ConfigKeys.globalState.companionUpdateSkippedVersion),
        });
        if (!show || gap.state !== 'outdated') {
            return;
        }
        // Marked seen as soon as it is on screen: a toast with buttons stays pending until the user answers or
        // closes it, so waiting for a choice means a user who just keeps working sees it again every activation.
        void context.globalState.update(ConfigKeys.globalState.companionUpdateNotifiedFor, gap.expected);
        const shown = vscode.window.showInformationMessage(
            `${updateBannerText(gap.installed, gap.expected)} Update the spec-kit extension to get the matching commands.`,
            'Update',
            'Skip this version'
        );
        void shown.then(choice => {
            if (choice === 'Update') {
                void vscode.commands.executeCommand(INSTALL_COMMAND);
            } else if (choice === 'Skip this version') {
                void context.globalState.update(ConfigKeys.globalState.companionUpdateSkippedVersion, gap.expected);
            }
        });
    } catch {
        /* the nudge must never block or fail activation */
    }
}

/** Status-bar text for a gap, or `null` when the item should be hidden. */
export function companionUpdateStatusBarText(gap: CompanionGap): string | null {
    return gap.state === 'outdated' ? '$(arrow-circle-up) SpecKit commands out of date' : null;
}

/** A warning status-bar item that is visible only while the installed spec-kit half is behind; click runs the update. */
export function createCompanionUpdateStatusBar(context: vscode.ExtensionContext): { sync: (gap: CompanionGap) => void } {
    const skipped = (): string | undefined =>
        context.globalState.get<string>(ConfigKeys.globalState.companionUpdateSkippedVersion);
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    item.command = INSTALL_COMMAND;
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    context.subscriptions.push(item);
    return {
        sync: (gap: CompanionGap): void => {
            const text = companionUpdateStatusBarText(gap);
            if (!text || gap.state !== 'outdated' || !readInstallPromptEnabled() || skipped() === gap.expected) {
                item.hide();
                return;
            }
            item.text = text;
            item.tooltip = `${updateBannerText(gap.installed, gap.expected)} Click to update the spec-kit extension.`;
            item.show();
        },
    };
}
