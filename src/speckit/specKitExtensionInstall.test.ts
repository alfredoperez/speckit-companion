import * as vscode from 'vscode';
import {
    RELEASE_URL,
    BY_NAME_INSTALL,
    USE_BY_NAME_INSTALL,
    CLI_PREREQ_COMMAND,
    buildInstallCommand,
    shouldShowInstallPrompt,
    runInstallSpecKitExtension,
} from './specKitExtensionInstall';

describe('specKitExtensionInstall', () => {
    describe('buildInstallCommand', () => {
        it('installs from the release URL with --force while the catalog form is off', () => {
            // Guard the launch-time invariant: until the catalog lists the extension,
            // install must go through the published release asset, not the by-name form.
            expect(USE_BY_NAME_INSTALL).toBe(false);
            const cmd = buildInstallCommand();
            expect(cmd).toBe(`specify extension add ${BY_NAME_INSTALL} --from ${RELEASE_URL} --force`);
            expect(cmd).toContain('--from https://github.com/alfredoperez/speckit-companion/releases/');
            expect(cmd).toContain('--force');
        });

        it('exposes the github-source CLI prereq (stock PyPI lacks `extension`)', () => {
            expect(CLI_PREREQ_COMMAND).toContain('git+https://github.com/github/spec-kit.git');
            expect(CLI_PREREQ_COMMAND).toContain('--force');
        });
    });

    describe('shouldShowInstallPrompt', () => {
        it('shows when missing and mode is on/beta', () => {
            expect(shouldShowInstallPrompt('on', false)).toBe(true);
            expect(shouldShowInstallPrompt('beta', false)).toBe(true);
        });

        it('never shows when installed — zero regression for existing users', () => {
            expect(shouldShowInstallPrompt('on', true)).toBe(false);
            expect(shouldShowInstallPrompt('beta', true)).toBe(false);
            expect(shouldShowInstallPrompt('off', true)).toBe(false);
        });

        it('never shows when mode is off — explicit opt-out', () => {
            expect(shouldShowInstallPrompt('off', false)).toBe(false);
        });
    });

    describe('runInstallSpecKitExtension', () => {
        it('opens a terminal, echoes the prereq, then runs the install command', () => {
            const sendText = jest.fn();
            const show = jest.fn();
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show, sendText });

            runInstallSpecKitExtension('/work/project');

            expect(show).toHaveBeenCalled();
            const sent = sendText.mock.calls.map(c => c[0] as string);
            expect(sent).toContain('cd "/work/project"');
            // Prereq is a comment (documents, does not auto-run an install of specify-cli).
            expect(sent.some(line => line.startsWith('# Prerequisite') && line.includes(CLI_PREREQ_COMMAND))).toBe(true);
            expect(sent).toContain(buildInstallCommand());
        });

        it('skips the cd when no workspace root is given', () => {
            const sendText = jest.fn();
            (vscode.window.createTerminal as jest.Mock).mockReturnValueOnce({ show: jest.fn(), sendText });

            runInstallSpecKitExtension(undefined);

            const sent = sendText.mock.calls.map(c => c[0] as string);
            expect(sent.some(line => line.startsWith('cd '))).toBe(false);
            expect(sent).toContain(buildInstallCommand());
        });
    });
});
