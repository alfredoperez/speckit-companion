import * as vscode from 'vscode';
import {
    companionUpdateStatusBarText,
    createCompanionUpdateStatusBar,
    maybeShowCompanionUpdateNudge,
    shouldShowCompanionUpdateNudge,
} from './companionUpdateNudge';
import type { CompanionGap } from './companionVersionGap';

jest.mock('./companionVersionGap', () => ({
    resolveCompanionGap: jest.fn(),
}));

import { resolveCompanionGap } from './companionVersionGap';

const outdated: CompanionGap = { state: 'outdated', installed: '0.20.2', expected: '0.21.0' };

function makeContext(): { context: vscode.ExtensionContext; store: Map<string, unknown> } {
    const store = new Map<string, unknown>();
    const context = {
        extensionPath: '/ext',
        subscriptions: [],
        globalState: {
            get: (k: string, d?: unknown) => (store.has(k) ? store.get(k) : d),
            update: async (k: string, v: unknown) => { store.set(k, v); },
        },
    } as unknown as vscode.ExtensionContext;
    return { context, store };
}

describe('companion update nudge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('shouldShowCompanionUpdateNudge', () => {
        it('fires for an out-of-date install the user has neither seen nor skipped', () => {
            expect(shouldShowCompanionUpdateNudge({ gap: outdated, notifiedFor: undefined, skippedVersion: undefined })).toBe(true);
            expect(shouldShowCompanionUpdateNudge({ gap: outdated, notifiedFor: '0.20.5', skippedVersion: '0.20.5' })).toBe(true);
        });

        it('stays quiet once notified or skipped for this version, and for missing or current installs', () => {
            expect(shouldShowCompanionUpdateNudge({ gap: outdated, notifiedFor: '0.21.0', skippedVersion: undefined })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ gap: outdated, notifiedFor: undefined, skippedVersion: '0.21.0' })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ gap: { state: 'missing' }, notifiedFor: undefined, skippedVersion: undefined })).toBe(false);
            expect(shouldShowCompanionUpdateNudge({ gap: { state: 'current' }, notifiedFor: undefined, skippedVersion: undefined })).toBe(false);
        });
    });

    describe('maybeShowCompanionUpdateNudge', () => {
        it('shows once per expected version, then remembers a skip', async () => {
            (resolveCompanionGap as jest.Mock).mockReturnValue(outdated);
            const show = vscode.window.showInformationMessage as jest.Mock;
            show.mockResolvedValue('Skip this version');
            const { context, store } = makeContext();

            maybeShowCompanionUpdateNudge(context, '/ws');
            expect(show).toHaveBeenCalledTimes(1);
            expect(show.mock.calls[0][0]).toContain('0.20.2');
            expect(show.mock.calls[0][0]).toContain('0.21.0');
            expect(store.get('speckit.companionUpdateNotifiedFor')).toBe('0.21.0');
            await Promise.resolve();
            expect(store.get('speckit.companionUpdateSkippedVersion')).toBe('0.21.0');

            maybeShowCompanionUpdateNudge(context, '/ws');
            expect(show).toHaveBeenCalledTimes(1);
        });

        it('Update runs the install command', async () => {
            (resolveCompanionGap as jest.Mock).mockReturnValue(outdated);
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Update');
            const { context } = makeContext();
            maybeShowCompanionUpdateNudge(context, '/ws');
            await Promise.resolve();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
        });

        it('shows nothing for a current install', () => {
            (resolveCompanionGap as jest.Mock).mockReturnValue({ state: 'current' });
            maybeShowCompanionUpdateNudge(makeContext().context, '/ws');
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
    });

    describe('status bar', () => {
        it('has text only while out of date', () => {
            expect(companionUpdateStatusBarText(outdated)).toBe('$(arrow-circle-up) SpecKit commands out of date');
            expect(companionUpdateStatusBarText({ state: 'missing' })).toBeNull();
            expect(companionUpdateStatusBarText({ state: 'current' })).toBeNull();
        });

        it('shows on a gap and hides again once the versions match', () => {
            const { context } = makeContext();
            const bar = createCompanionUpdateStatusBar(context);
            const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
            expect(item.command).toBe('speckit.companion.installSpecKitExtension');
            expect(item.backgroundColor.id).toBe('statusBarItem.warningBackground');

            (resolveCompanionGap as jest.Mock).mockReturnValue(outdated);
            bar.sync('/ws');
            expect(item.show).toHaveBeenCalledTimes(1);
            expect(item.text).toBe('$(arrow-circle-up) SpecKit commands out of date');

            (resolveCompanionGap as jest.Mock).mockReturnValue({ state: 'current' });
            bar.sync('/ws');
            expect(item.hide).toHaveBeenCalledTimes(1);
        });
    });
});
