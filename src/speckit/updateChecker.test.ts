import * as vscode from 'vscode';
import { UpdateChecker } from './updateChecker';
import { notePublishedCompanionVersion, publishedCompanionVersion } from './companionVersionGap';
const { createMockExtensionContext } = vscode as unknown as {
    createMockExtensionContext: (seed?: Record<string, unknown>) => { context: vscode.ExtensionContext; store: Map<string, unknown> };
};

describe('UpdateChecker', () => {
    const buildContext = (currentVersion: string, skipVersion?: string) => ({
        ...createMockExtensionContext(skipVersion ? { 'speckit.skipVersion': skipVersion } : {}).context,
        extension: { packageJSON: { version: currentVersion } },
    } as any);

    const buildOutputChannel = () => ({ appendLine: jest.fn() } as any);

    const mockReleases = (
        releases: Array<{ tag_name: string; draft?: boolean; prerelease?: boolean }>
    ) => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => releases,
        }) as any;
    };

    afterEach(() => {
        notePublishedCompanionVersion(undefined);
        jest.restoreAllMocks();
        require('vscode').window.showInformationMessage.mockClear();
        require('vscode').env.openExternal.mockClear();
        delete (global as any).fetch;
    });

    it('reads the current version from the extension itself, not a hardcoded id', async () => {
        const context = buildContext('0.22.0');
        const output = buildOutputChannel();
        mockReleases([{ tag_name: 'v0.22.0' }]);
        const showSpy = jest.spyOn(require('vscode').window, 'showInformationMessage');

        await new UpdateChecker(context, output).checkForUpdates(true);

        expect(output.appendLine).toHaveBeenCalledWith(
            expect.stringContaining('Checking for updates... (current: 0.22.0)')
        );
        expect(showSpy).not.toHaveBeenCalled();
    });

    it('notifies when a newer v* release exists', async () => {
        const context = buildContext('0.22.0');
        mockReleases([{ tag_name: 'v0.23.0' }, { tag_name: 'v0.22.0' }]);
        const showSpy = jest
            .spyOn(require('vscode').window, 'showInformationMessage')
            .mockResolvedValue(undefined as any);

        await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

        expect(showSpy).toHaveBeenCalledWith(
            expect.stringContaining('0.23.0'),
            'View Changelog',
            'Skip'
        );
    });

    it('ignores speckit-ext-v* releases when picking the latest', async () => {
        const context = buildContext('0.22.0');
        // A newer-by-date spec-kit release must NOT trigger a GUI update notification.
        mockReleases([{ tag_name: 'speckit-ext-v9.9.9' }, { tag_name: 'v0.22.0' }]);
        const showSpy = jest
            .spyOn(require('vscode').window, 'showInformationMessage')
            .mockResolvedValue(undefined as any);

        await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

        expect(showSpy).not.toHaveBeenCalled();
    });

    it('ignores prerelease and draft v* releases', async () => {
        const context = buildContext('0.22.0');
        // /releases (unlike /releases/latest) surfaces unpublished builds — they must not nag.
        mockReleases([
            { tag_name: 'v0.24.0', prerelease: true },
            { tag_name: 'v0.25.0', draft: true },
            { tag_name: 'v0.22.0' },
        ]);
        const showSpy = jest
            .spyOn(require('vscode').window, 'showInformationMessage')
            .mockResolvedValue(undefined as any);

        await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

        expect(showSpy).not.toHaveBeenCalled();
    });

    it('selects the highest v* version, not the first in the list', async () => {
        const context = buildContext('0.22.0');
        mockReleases([
            { tag_name: 'v0.22.5' },
            { tag_name: 'v0.23.1' },
            { tag_name: 'speckit-ext-v1.0.0' },
            { tag_name: 'v0.23.0' },
        ]);
        const showSpy = jest
            .spyOn(require('vscode').window, 'showInformationMessage')
            .mockResolvedValue(undefined as any);

        await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

        expect(showSpy).toHaveBeenCalledWith(
            expect.stringContaining('0.23.1'),
            'View Changelog',
            'Skip'
        );
    });
    it('opens the offered version\'s own release, not the shared latest lookup', async () => {
        const context = buildContext('0.22.0');
        // A spec-kit release published more recently would win /releases/latest.
        mockReleases([{ tag_name: 'speckit-ext-v1.0.0' }, { tag_name: 'v0.23.1' }]);
        jest.spyOn(require('vscode').window, 'showInformationMessage')
            .mockResolvedValue('View Changelog' as any);
        const openSpy = require('vscode').env.openExternal as jest.Mock;

        await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);
        await new Promise(r => setImmediate(r));

        expect(openSpy).toHaveBeenCalledTimes(1);
        const opened = String(openSpy.mock.calls[0][0]);
        expect(opened).toContain('/releases/tag/v0.23.1');
        expect(opened).not.toContain('/releases/latest');
    });
    it('opens nothing when the user skips', async () => {
        const context = buildContext('0.22.0');
        mockReleases([{ tag_name: 'v0.23.1' }]);
        jest.spyOn(require('vscode').window, 'showInformationMessage')
            .mockResolvedValue('Skip' as any);

        await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);
        await new Promise(r => setImmediate(r));

        expect(require('vscode').env.openExternal).not.toHaveBeenCalled();
    });
    describe('the published spec-kit extension version', () => {
        const buildContextWithStore = (seed: Record<string, unknown> = {}) => {
            const mock = createMockExtensionContext(seed);
            return {
                context: { ...mock.context, extension: { packageJSON: { version: '0.32.0' } } } as any,
                store: mock.store,
            };
        };

        it('stores what a check learns, so the next window does not need the network', async () => {
            const { context, store } = buildContextWithStore();
            mockReleases([{ tag_name: 'v0.32.0' }, { tag_name: 'speckit-ext-v0.22.0' }]);

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBe('0.22.0');
        });

        it('seeds itself from that store at construction, before anything asks for the gap', () => {
            // This is the whole defect: the check runs at most once a day and resolves after activation has
            // decided whether to warn, so without the seed the warning is unreachable on almost every start.
            const { context } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.22.0' });

            new UpdateChecker(context, buildOutputChannel());

            expect(publishedCompanionVersion()).toBe('0.22.0');
        });

        it('ignores a stored value that is not a version rather than making it the yardstick', () => {
            const { context } = buildContextWithStore({ 'speckit.companionPublishedVersion': 'latest' });

            new UpdateChecker(context, buildOutputChannel());

            expect(publishedCompanionVersion()).toBeUndefined();
        });

        it('stores nothing when the releases list carries no spec-kit extension tag', async () => {
            const { context, store } = buildContextWithStore();
            mockReleases([{ tag_name: 'v0.32.0' }]);

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBeUndefined();
        });
    });
});
