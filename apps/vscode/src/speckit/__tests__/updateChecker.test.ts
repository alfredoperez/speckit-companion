import * as vscode from 'vscode';
import { UpdateChecker } from '../updateChecker';
import { notePublishedCompanionVersion, publishedCompanionVersion } from '../companionVersionGap';
const { createMockExtensionContext } = vscode as unknown as {
    createMockExtensionContext: (seed?: Record<string, unknown>) => { context: vscode.ExtensionContext; store: Map<string, unknown> };
};

describe('UpdateChecker', () => {
    const buildContext = (currentVersion: string, skipVersion?: string) => ({
        ...createMockExtensionContext(skipVersion ? { 'speckit.skipVersion': skipVersion } : {}).context,
        extension: { id: 'alfredoperez.speckit-companion', packageJSON: { version: currentVersion } },
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
        require('vscode').commands.executeCommand.mockReset();
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
            'Update',
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
            'Update',
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
    describe('the Update button', () => {
        const run = async (...answers: Array<string | undefined>) => {
            mockReleases([{ tag_name: 'v0.23.1' }]);
            const ask = jest.spyOn(require('vscode').window, 'showInformationMessage');
            answers.forEach(a => ask.mockResolvedValueOnce(a as any));
            await new UpdateChecker(buildContext('0.22.0'), buildOutputChannel()).checkForUpdates(true);
            await new Promise(r => setImmediate(r));
            return { ask, exec: require('vscode').commands.executeCommand as jest.Mock };
        };

        it('comes first, ahead of View Changelog and Skip', async () => {
            const { ask } = await run(undefined);
            expect(ask.mock.calls[0].slice(1)).toEqual(['Update', 'View Changelog', 'Skip']);
        });

        it('installs the newest version unpinned and reloads when the reload is accepted', async () => {
            const { exec } = await run('Update', 'Reload Window');
            expect(exec).toHaveBeenCalledWith('workbench.extensions.installExtension', 'alfredoperez.speckit-companion');
            expect(exec).toHaveBeenCalledWith('workbench.action.reloadWindow');
        });

        it('leaves the window alone when the reload is declined', async () => {
            const { exec } = await run('Update', undefined);
            expect(exec).not.toHaveBeenCalledWith('workbench.action.reloadWindow');
        });

        it('opens the extension page when the install fails', async () => {
            require('vscode').commands.executeCommand.mockImplementation(async (cmd: string) => {
                if (cmd === 'workbench.extensions.installExtension') { throw new Error('not found'); }
            });
            const { exec, ask } = await run('Update');
            expect(exec).toHaveBeenCalledWith('extension.open', 'alfredoperez.speckit-companion');
            expect(ask).toHaveBeenCalledTimes(1);
        });

        it('falls back to the Marketplace page when the editor cannot open the extension page', async () => {
            require('vscode').commands.executeCommand.mockImplementation(async () => { throw new Error('no such command'); });
            await run('Update');
            expect(String((require('vscode').env.openExternal as jest.Mock).mock.calls[0][0]))
                .toContain('itemName=alfredoperez.speckit-companion');
        });

        it('installs nothing when the notification is dismissed', async () => {
            const { exec } = await run(undefined);
            expect(exec).not.toHaveBeenCalled();
        });
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
            // Without the seed the warning is unreachable on almost every start.
            const { context } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.22.0' });

            new UpdateChecker(context, buildOutputChannel());

            expect(publishedCompanionVersion()).toBe('0.22.0');
        });

        it('ignores a stored value that is not a version rather than making it the yardstick', () => {
            const { context } = buildContextWithStore({ 'speckit.companionPublishedVersion': 'latest' });

            new UpdateChecker(context, buildOutputChannel());

            expect(publishedCompanionVersion()).toBeUndefined();
        });

        const mockReleasesAndTags = (
            releases: Array<{ tag_name: string; draft?: boolean; prerelease?: boolean }>,
            tagLookup: { status: number; body?: unknown } | 'network-error'
        ) => {
            global.fetch = jest.fn().mockImplementation(async (url: string) => {
                if (!url.includes('/releases/tags/')) {
                    return { ok: true, status: 200, json: async () => releases };
                }
                if (tagLookup === 'network-error') {
                    throw new Error('offline');
                }
                return { ok: tagLookup.status < 400, status: tagLookup.status, json: async () => tagLookup.body };
            }) as any;
        };
        const ext = (version: string, flags: object = {}) => ({ tag_name: `speckit-ext-v${version}`, ...flags });

        it('keeps the remembered version when it fell off the page but its release still exists', async () => {
            const { context, store } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.22.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }], { status: 200, body: ext('0.22.0') });

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBe('0.22.0');
        });

        it('keeps the remembered version when an older release is listed but the remembered one still exists', async () => {
            const { context, store } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.22.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }, ext('0.21.0')], { status: 200, body: ext('0.22.0') });

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBe('0.22.0');
        });

        it('falls back to the newest listed release when the remembered one was retracted', async () => {
            const { context, store } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.30.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }, ext('0.29.0')], { status: 404 });

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBe('0.29.0');
            expect(publishedCompanionVersion()).toBe('0.29.0');
            expect((global.fetch as jest.Mock).mock.calls.map(([url]) => String(url)))
                .toContain('https://api.github.com/repos/alfredoperez/speckit-companion/releases/tags/speckit-ext-v0.30.0');
        });

        it('forgets a retracted version when no spec-kit extension release is listed', async () => {
            const { context, store } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.30.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }], { status: 404 });

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBeUndefined();
        });

        it('treats a remembered release turned into a draft or prerelease as retracted', async () => {
            const { context, store } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.30.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }], { status: 200, body: ext('0.30.0', { prerelease: true }) });

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBeUndefined();
        });

        it.each([
            ['GitHub answers with a server error', { status: 500 }],
            ['the lookup is rate limited', { status: 403 }],
            ['the lookup cannot reach GitHub', 'network-error' as const],
            ['the answer is not the release asked for', { status: 200, body: [] }],
        ])('keeps the remembered version when %s', async (_name, tagLookup) => {
            const { context, store } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.30.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }], tagLookup);

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(store.get('speckit.companionPublishedVersion')).toBe('0.30.0');
        });

        it('does not look the release up when the check already found the remembered version', async () => {
            const { context } = buildContextWithStore({ 'speckit.companionPublishedVersion': '0.22.0' });
            mockReleasesAndTags([{ tag_name: 'v0.32.0' }, ext('0.22.0')], { status: 404 });

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect((global.fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes('/releases/tags/'))).toBe(false);
        });

        it('leaves the running session on the yardstick it started with', async () => {
            // The gap is resolved and the surfaces drawn before this check resolves.
            const { context } = buildContextWithStore();
            mockReleases([{ tag_name: 'v0.32.0' }, { tag_name: 'speckit-ext-v0.22.0' }]);

            await new UpdateChecker(context, buildOutputChannel()).checkForUpdates(true);

            expect(publishedCompanionVersion()).toBeUndefined();
        });
    });
});
