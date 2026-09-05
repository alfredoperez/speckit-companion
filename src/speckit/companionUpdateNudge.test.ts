import * as vscode from 'vscode';
import {
    companionUpdateStatusBarText,
    createCompanionUpdateStatusBar,
    maybeShowCompanionUpdateNudge,
    shouldShowCompanionUpdateNudge,
} from './companionUpdateNudge';
import type { CompanionGap } from './companionVersionGap';

jest.mock('./specKitExtensionInstall', () => ({
    readInstallPromptEnabled: jest.fn().mockReturnValue(true),
}));

import { readInstallPromptEnabled } from './specKitExtensionInstall';
const { createMockExtensionContext } = vscode as unknown as {
    createMockExtensionContext: (seed?: Record<string, unknown>) => { context: vscode.ExtensionContext; store: Map<string, unknown> };
};

const outdated: CompanionGap = { state: 'outdated', installed: '0.20.2', expected: '0.21.0' };
const on = { enabled: true, notifiedFor: undefined, skippedVersion: undefined };

function makeContext(): { context: vscode.ExtensionContext; store: Map<string, unknown> } {
    const { context, store } = createMockExtensionContext();
    return { context: context, store };
}

describe('companion update nudge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (readInstallPromptEnabled as jest.Mock).mockReturnValue(true);
    });

    describe('shouldShowCompanionUpdateNudge', () => {
        it('fires for an out-of-date install the user has neither seen nor skipped', () => {
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: outdated })).toBe(true);
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: outdated, notifiedFor: '0.20.5', skippedVersion: '0.20.5' })).toBe(true);
        });

        it('stays quiet once notified or skipped for this version, when opted out, and for missing or current installs', () => {
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: outdated, notifiedFor: '0.21.0' })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: outdated, skippedVersion: '0.21.0' })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: outdated, enabled: false })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: { state: 'missing' } })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ ...on, gap: { state: 'current' } })).toBe(false);
        });
    });

    describe('maybeShowCompanionUpdateNudge', () => {
        it('shows once per expected version, marks it seen the moment it appears, then remembers a skip', async () => {
            const show = vscode.window.showInformationMessage as jest.Mock;
            show.mockResolvedValue('Skip this version');
            const { context, store } = makeContext();

            maybeShowCompanionUpdateNudge(context, outdated);
            expect(show).toHaveBeenCalledTimes(1);
            expect(show.mock.calls[0][0]).toContain('0.20.2');
            expect(show.mock.calls[0][0]).toContain('0.21.0');
            expect(store.get('speckit.companionUpdateNotifiedFor')).toBe('0.21.0');
            await Promise.resolve();
            expect(store.get('speckit.companionUpdateSkippedVersion')).toBe('0.21.0');

            maybeShowCompanionUpdateNudge(context, outdated);
            expect(show).toHaveBeenCalledTimes(1);
        });

        it('Update runs the install command', async () => {
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Update');
            maybeShowCompanionUpdateNudge(makeContext().context, outdated);
            await Promise.resolve();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
        });

        it('an ignored toast counts as seen but leaves the banner and the status bar alone', async () => {
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);
            const { context, store } = makeContext();
            maybeShowCompanionUpdateNudge(context, outdated);
            await Promise.resolve();
            expect(store.get('speckit.companionUpdateNotifiedFor')).toBe('0.21.0');
            expect(store.has('speckit.companionUpdateSkippedVersion')).toBe(false);
        });

        it('shows nothing for a current install or when the install prompt is turned off', () => {
            maybeShowCompanionUpdateNudge(makeContext().context, { state: 'current' });
            (readInstallPromptEnabled as jest.Mock).mockReturnValue(false);
            maybeShowCompanionUpdateNudge(makeContext().context, outdated);
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
    });

    describe('status bar', () => {
        it('has text only while out of date', () => {
            expect(companionUpdateStatusBarText(outdated)).toBe('$(arrow-circle-up) SpecKit commands out of date');
            expect(companionUpdateStatusBarText({ state: 'missing' })).toBeNull();
            expect(companionUpdateStatusBarText({ state: 'current' })).toBeNull();
        });

        it('shows on a gap, hides once the versions match, and stays hidden when opted out or skipped', () => {
            const { context, store } = makeContext();
            const bar = createCompanionUpdateStatusBar(context);
            const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
            expect(item.command).toBe('speckit.companion.installSpecKitExtension');
            expect(item.backgroundColor.id).toBe('statusBarItem.warningBackground');

            bar.sync(outdated);
            expect(item.show).toHaveBeenCalledTimes(1);
            expect(item.text).toBe('$(arrow-circle-up) SpecKit commands out of date');
            expect(item.tooltip).toContain('SpecKit commands are 0.20.2, this extension expects 0.21.0.');

            bar.sync({ state: 'current' });
            expect(item.hide).toHaveBeenCalledTimes(1);

            (readInstallPromptEnabled as jest.Mock).mockReturnValue(false);
            bar.sync(outdated);
            expect(item.show).toHaveBeenCalledTimes(1);
            expect(item.hide).toHaveBeenCalledTimes(2);

            (readInstallPromptEnabled as jest.Mock).mockReturnValue(true);
            store.set('speckit.companionUpdateSkippedVersion', '0.21.0');
            bar.sync(outdated);
            expect(item.show).toHaveBeenCalledTimes(1);
            expect(item.hide).toHaveBeenCalledTimes(3);
        });
    });
});
