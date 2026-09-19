import * as vscode from 'vscode';
import {
    RELEASE_URL,
    BY_NAME_INSTALL,
    USE_BY_NAME_INSTALL,
    CLI_PREREQ_COMMAND,
    buildInstallCommand,
    shouldShowInstallPrompt,
    isInstallPromptDismissed,
    dismissInstallPrompt,
    onDidDismissInstallPrompt,
    runInstallSpecKitExtension,
    noteUpdateDispatched,
    noteInstallLanded,
    updateAlreadyAttempted,
    __resetForceProbe,
} from './specKitExtensionInstall';

/** `promisify(exec)` calls `exec(cmd, options, cb)`, so the callback is always the last argument. */
const done = (args: unknown[]) => args[args.length - 1] as (e: unknown, r: unknown) => void;
const execMock = jest.fn((...args: unknown[]) =>
    done(args)(null, { stdout: 'Usage: specify extension add [OPTIONS]\n  --force\n', stderr: '' }));
jest.mock('child_process', () => ({ exec: (...args: unknown[]) => execMock(...args) }));

jest.mock('../features/settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));
jest.mock('./companionVersionGap', () => ({
    ...jest.requireActual('./companionVersionGap'),
    readInstalledCompanionVersion: jest.fn().mockReturnValue(undefined),
}));
import { clearInstallInFlight, isInstallInFlight } from './companionVersionGap';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';
import { readInstalledCompanionVersion } from './companionVersionGap';

const { createMockExtensionContext } = vscode as unknown as {
    createMockExtensionContext: (seed?: Record<string, unknown>) => { context: vscode.ExtensionContext; store: Map<string, unknown> };
};

describe('specKitExtensionInstall', () => {
    describe('buildInstallCommand', () => {
        it('installs from the release URL while the catalog form is off', () => {
            // Guard the launch-time invariant: until the catalog lists the extension,
            // install must go through the published release asset, not the by-name form.
            expect(USE_BY_NAME_INSTALL).toBe(false);
            const cmd = buildInstallCommand();
            expect(cmd).toBe(`specify extension add ${BY_NAME_INSTALL} --from ${RELEASE_URL}`);
            expect(cmd).toContain('--from https://github.com/alfredoperez/speckit-companion/releases/');
        });

        it('passes --force only for an update: a fresh install keeps the #420-safe form', () => {
            expect(buildInstallCommand()).not.toContain('--force');
            expect(buildInstallCommand({ force: false })).not.toContain('--force');
            expect(buildInstallCommand({ force: true })).toBe(`specify extension add ${BY_NAME_INSTALL} --from ${RELEASE_URL} --force`);
        });

        it('exposes the github-source CLI prereq (stock PyPI lacks `extension`)', () => {
            expect(CLI_PREREQ_COMMAND).toContain('git+https://github.com/github/spec-kit.git');
            expect(CLI_PREREQ_COMMAND).toContain('--force');
        });
    });

    describe('RELEASE_URL', () => {
        it('points at the stable rolling asset with no version string', () => {
            // The in-editor Install/Update must always pull the newest build. A version
            // string here makes "Update" a silent downgrade — so guard that none returns.
            expect(RELEASE_URL).toBe(
                'https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip'
            );
            expect(RELEASE_URL).not.toMatch(/speckit-ext-v\d/);
            expect(RELEASE_URL).not.toMatch(/companion-\d/);
        });
    });

    describe('shouldShowInstallPrompt', () => {
        it('asks to install when missing and the prompt is enabled', () => {
            expect(shouldShowInstallPrompt(true, { state: 'missing' })).toEqual({ kind: 'install' });
        });

        it('asks to update, naming both versions, when the install is behind this build', () => {
            expect(shouldShowInstallPrompt(true, { state: 'outdated', installed: '0.20.2', expected: '0.21.0' }))
                .toEqual({ kind: 'update', installed: '0.20.2', expected: '0.21.0' });
        });

        it('never shows when current — zero regression for existing users', () => {
            expect(shouldShowInstallPrompt(true, { state: 'current' })).toBeNull();
            expect(shouldShowInstallPrompt(false, { state: 'current' })).toBeNull();
        });

        it('never shows when disabled — explicit opt-out covers both variants', () => {
            expect(shouldShowInstallPrompt(false, { state: 'missing' })).toBeNull();
            expect(shouldShowInstallPrompt(false, { state: 'outdated', installed: '0.20.2', expected: '0.21.0' })).toBeNull();
        });
    });

    describe('isInstallPromptDismissed', () => {
        const memento = (values: Record<string, unknown>) => ({
            get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
        }) as unknown as vscode.Memento;

        it('the install banner honours its permanent flag', () => {
            expect(isInstallPromptDismissed(memento({ 'speckit.installBannerDismissed': true }), { kind: 'install' })).toBe(true);
            expect(isInstallPromptDismissed(memento({}), { kind: 'install' })).toBe(false);
        });

        it('the update banner is dismissed per expected version, so a later release asks again', () => {
            const update = { kind: 'update' as const, installed: '0.20.2', expected: '0.21.0' };
            expect(isInstallPromptDismissed(memento({ 'speckit.companionUpdateSkippedVersion': '0.21.0' }), update)).toBe(true);
            expect(isInstallPromptDismissed(memento({ 'speckit.companionUpdateSkippedVersion': '0.20.5' }), update)).toBe(false);
            expect(isInstallPromptDismissed(memento({ 'speckit.installBannerDismissed': true }), update)).toBe(false);
        });
    });

    describe('dismissInstallPrompt', () => {
        it('announces the dismissal so the status bar re-syncs without waiting for a file change', async () => {
            const { context } = createMockExtensionContext();
            const heard: unknown[] = [];
            const sub = onDidDismissInstallPrompt(() => heard.push(true));
            await dismissInstallPrompt(context, { kind: 'update', installed: '0.20.2', expected: '0.21.0' });
            sub.dispose();
            expect(heard).toHaveLength(1);
        });

        it('falls back to the install flag when a version-skewed webview sends no prompt', async () => {
            const { context, store } = createMockExtensionContext();
            await dismissInstallPrompt(context, undefined);
            expect(store.get('speckit.installBannerDismissed')).toBe(true);
        });

        it('writes the flag for the prompt the user closed, with no disk read', async () => {
            const { context, store } = createMockExtensionContext();
            await dismissInstallPrompt(context, { kind: 'update', installed: '0.20.2', expected: '0.21.0' });
            expect(store.get('speckit.companionUpdateSkippedVersion')).toBe('0.21.0');
            expect(store.has('speckit.installBannerDismissed')).toBe(false);
            await dismissInstallPrompt(context, { kind: 'install' });
            expect(store.get('speckit.installBannerDismissed')).toBe(true);
        });
    });

    describe('the attempted-update guard', () => {
        const gap = { state: 'outdated' as const, installed: '0.20.2', expected: '0.21.0' };

        it('stops asking once an update ran and left the version where it was', async () => {
            const { context } = createMockExtensionContext();
            expect(updateAlreadyAttempted(context, gap)).toBe(false);
            noteUpdateDispatched(gap);
            await noteInstallLanded(context, gap);
            expect(updateAlreadyAttempted(context, gap)).toBe(true);
            // A later release, or an update that actually landed, is a different pair and asks again.
            expect(updateAlreadyAttempted(context, { ...gap, expected: '0.22.0' })).toBe(false);
            expect(updateAlreadyAttempted(context, { state: 'current' })).toBe(false);
        });

        it('stays silent about an update that never landed — a failed install must not silence anything', async () => {
            const { context } = createMockExtensionContext();
            noteUpdateDispatched(gap);
            // No files moved, so `noteInstallLanded` is never reached; the next session asks again.
            expect(updateAlreadyAttempted(context, gap)).toBe(false);
        });

        it('forgets the dispatch once the update actually took', async () => {
            const { context } = createMockExtensionContext();
            noteUpdateDispatched(gap);
            await noteInstallLanded(context, { state: 'current' });
            await noteInstallLanded(context, gap);
            expect(updateAlreadyAttempted(context, gap)).toBe(false);
        });

        it('is remembered per project, so another repo with the same gap is still told', async () => {
            const a = createMockExtensionContext();
            const b = createMockExtensionContext();
            noteUpdateDispatched(gap);
            await noteInstallLanded(a.context, gap);
            expect(updateAlreadyAttempted(a.context, gap)).toBe(true);
            expect(updateAlreadyAttempted(b.context, gap)).toBe(false);
        });
    });

    describe('runInstallSpecKitExtension', () => {
        it('adds --force when the extension is already installed, so Update can overwrite it', async () => {
            const sendText = jest.fn();
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show: jest.fn(), sendText });
            (isCompanionInstalled as jest.Mock).mockReturnValueOnce(true);
            await runInstallSpecKitExtension('/work/project');
            expect(sendText.mock.calls.map(c => c[0])).toContain(buildInstallCommand({ force: true }));
        });

        it('adds --force when only the spec-kit registry still lists it, since that is what the CLI refuses on', async () => {
            const sendText = jest.fn();
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show: jest.fn(), sendText });
            (isCompanionInstalled as jest.Mock).mockReturnValueOnce(false);
            (readInstalledCompanionVersion as jest.Mock).mockReturnValueOnce('0.20.2');
            await runInstallSpecKitExtension('/work/project');
            expect(sendText.mock.calls.map(c => c[0])).toContain(buildInstallCommand({ force: true }));
        });

        it('keeps --force when the probe cannot reach the CLI, and does not remember that as an answer', async () => {
            const sendText = jest.fn();
            (vscode.window.createTerminal as jest.Mock)
                .mockReturnValueOnce({ show: jest.fn(), sendText })
                .mockReturnValueOnce({ show: jest.fn(), sendText });
            (isCompanionInstalled as jest.Mock).mockReturnValue(true);
            __resetForceProbe();
            const probesBefore = execMock.mock.calls.length;
            execMock.mockImplementationOnce((...args: unknown[]) =>
                done(args)(Object.assign(new Error('command not found: specify'), { stderr: 'command not found' }), null));
            await runInstallSpecKitExtension('/work/project');
            expect(sendText.mock.calls.map(c => c[0])).toContain(buildInstallCommand({ force: true }));
            // The next click asks again rather than carrying a guess for the session.
            await runInstallSpecKitExtension('/work/project');
            expect(execMock.mock.calls.length - probesBefore).toBe(2);
            __resetForceProbe();
            (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        });

        it('leaves --force off on a CLI whose `extension add` has no such option (issue #420)', async () => {
            const sendText = jest.fn();
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show: jest.fn(), sendText });
            (isCompanionInstalled as jest.Mock).mockReturnValueOnce(true);
            __resetForceProbe();
            execMock.mockImplementation((...args: unknown[]) =>
                done(args)(null, { stdout: 'Usage: specify extension add [OPTIONS] SOURCE\n  --from TEXT\n', stderr: '' }));
            await runInstallSpecKitExtension('/work/project');
            expect(sendText.mock.calls.map(c => c[0])).toContain(buildInstallCommand());
            __resetForceProbe();
        });

        it('reports an install in flight so a mid-install empty directory is not read as uninstalled', async () => {
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show: jest.fn(), sendText: jest.fn() });
            clearInstallInFlight();
            expect(isInstallInFlight()).toBe(false);
            await runInstallSpecKitExtension('/work/project');
            expect(isInstallInFlight()).toBe(true);
            clearInstallInFlight();
            expect(isInstallInFlight()).toBe(false);
        });

        it('opens a terminal scoped to the workspace via cwd, echoes the prereq, then runs the install', async () => {
            const sendText = jest.fn();
            const show = jest.fn();
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show, sendText });

            await runInstallSpecKitExtension('/work/project');

            expect(show).toHaveBeenCalled();
            // The workspace root is passed as the terminal's structured `cwd`, never
            // interpolated into a `cd "..."` shell string — a path with `"`/`` ` ``/`$`/`\`
            // can't break the quoting or inject shell.
            expect(vscode.window.createTerminal).toHaveBeenCalledWith(
                expect.objectContaining({ cwd: '/work/project' })
            );
            const sent = sendText.mock.calls.map(c => c[0] as string);
            expect(sent.some(line => line.startsWith('cd '))).toBe(false);
            // Prereq is echoed (printed, not auto-run) — a raw `#` comment is unreliable
            // in interactive zsh (INTERACTIVE_COMMENTS off), so echo is used instead.
            expect(sent.some(line => line.startsWith('echo "Prerequisite') && line.includes(CLI_PREREQ_COMMAND))).toBe(true);
            expect(sent.some(line => line.startsWith('#'))).toBe(false);
            expect(sent).toContain(buildInstallCommand());
        });

        it('omits cwd (no cd) when no workspace root is given', async () => {
            const sendText = jest.fn();
            const createTerminal = vscode.window.createTerminal as jest.Mock;
            createTerminal.mockReturnValueOnce({ show: jest.fn(), sendText });

            await runInstallSpecKitExtension(undefined);

            const calls = createTerminal.mock.calls;
            const options = calls[calls.length - 1][0];
            expect(options).not.toHaveProperty('cwd');
            const sent = sendText.mock.calls.map(c => c[0] as string);
            expect(sent.some(line => line.startsWith('cd '))).toBe(false);
            expect(sent).toContain(buildInstallCommand());
        });
    });
});
