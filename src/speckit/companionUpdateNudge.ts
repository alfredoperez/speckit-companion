import * as vscode from 'vscode';
import { ConfigKeys } from '../core/constants';
import { resolveCompanionGap, type CompanionGap } from './companionVersionGap';

const INSTALL_COMMAND = 'speckit.companion.installSpecKitExtension';

/** Inputs to the notification decision, pre-resolved so the predicate stays pure. */
export interface CompanionUpdateNudgeGateInput {
    gap: CompanionGap;
    notifiedFor: string | undefined;
    skippedVersion: string | undefined;
}

/** One notification per expected version: not after it has fired for this version, and not once the user skipped it. */
export function shouldShowCompanionUpdateNudge(input: CompanionUpdateNudgeGateInput): boolean {
    return (
        input.gap.state === 'outdated' &&
        input.notifiedFor !== input.gap.expected &&
        input.skippedVersion !== input.gap.expected
    );
}

/** On activation, tell the user once per version that the installed spec-kit half is behind. Never throws. */
export function maybeShowCompanionUpdateNudge(context: vscode.ExtensionContext, root: string): void {
    try {
        const gap = resolveCompanionGap(root, context.extensionPath);
        const show = shouldShowCompanionUpdateNudge({
            gap,
            notifiedFor: context.globalState.get<string>(ConfigKeys.globalState.companionUpdateNotifiedFor),
            skippedVersion: context.globalState.get<string>(ConfigKeys.globalState.companionUpdateSkippedVersion),
        });
        if (!show || gap.state !== 'outdated') {
            return;
        }
        const shown = vscode.window.showInformationMessage(
            `SpecKit commands are ${gap.installed}, this extension expects ${gap.expected}. Update the spec-kit extension to get the matching commands.`,
            'Update',
            'Skip this version'
        );
        void context.globalState.update(ConfigKeys.globalState.companionUpdateNotifiedFor, gap.expected);
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
export function createCompanionUpdateStatusBar(context: vscode.ExtensionContext): { sync: (root: string) => void } {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    item.command = INSTALL_COMMAND;
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    context.subscriptions.push(item);
    return {
        sync: (root: string): void => {
            const gap = resolveCompanionGap(root, context.extensionPath);
            const text = companionUpdateStatusBarText(gap);
            if (!text || gap.state !== 'outdated') {
                item.hide();
                return;
            }
            item.text = text;
            item.tooltip = `SpecKit commands are ${gap.installed}, this extension expects ${gap.expected}. Click to update the spec-kit extension.`;
            item.show();
        },
    };
}
