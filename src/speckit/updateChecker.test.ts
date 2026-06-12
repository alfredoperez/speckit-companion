import { UpdateChecker } from './updateChecker';

describe('UpdateChecker', () => {
    const buildContext = (currentVersion: string, skipVersion?: string) => {
        const store = new Map<string, unknown>();
        if (skipVersion) {
            store.set('speckit.skipVersion', skipVersion);
        }
        return {
            extension: { packageJSON: { version: currentVersion } },
            globalState: {
                get: (key: string, fallback?: unknown) => (store.has(key) ? store.get(key) : fallback),
                update: async (key: string, value: unknown) => {
                    store.set(key, value);
                },
            },
        } as any;
    };

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
        jest.restoreAllMocks();
        require('vscode').window.showInformationMessage.mockClear();
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
});
