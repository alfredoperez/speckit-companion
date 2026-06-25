import * as vscode from 'vscode';
import { readInstallPromptEnabled, shouldShowInstallPrompt } from '../../../src/speckit/specKitExtensionInstall';

describe('readInstallPromptEnabled — gated only on its own prompt setting, not the beta', () => {
    const getConfigSpy = vscode.workspace.getConfiguration as jest.Mock;

    const configWith = (values: Record<string, unknown>) => ({
        get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
    });

    afterEach(() => {
        getConfigSpy.mockReset();
        getConfigSpy.mockReturnValue({ get: jest.fn().mockReturnValue(['specs']) });
    });

    it('returns true with the Companion workflow OFF and the prompt on — decoupled from beta', () => {
        getConfigSpy.mockReturnValue(
            configWith({ 'companion.speckitCompanionWorkflow': false, 'companion.installPrompt': true })
        );
        expect(readInstallPromptEnabled()).toBe(true);
    });

    it('returns true when the workflow setting is unset (beta off) and the prompt defaults on', () => {
        getConfigSpy.mockReturnValue(configWith({ 'companion.installPrompt': true }));
        expect(readInstallPromptEnabled()).toBe(true);
    });

    it('defaults to true when neither the workflow nor the prompt is set', () => {
        getConfigSpy.mockReturnValue(configWith({}));
        expect(readInstallPromptEnabled()).toBe(true);
    });

    it('returns false when the prompt is explicitly off, regardless of the workflow', () => {
        getConfigSpy.mockReturnValue(
            configWith({ 'companion.speckitCompanionWorkflow': true, 'companion.installPrompt': false })
        );
        expect(readInstallPromptEnabled()).toBe(false);
    });

    it('still false when the prompt is off even with the workflow off', () => {
        getConfigSpy.mockReturnValue(
            configWith({ 'companion.speckitCompanionWorkflow': false, 'companion.installPrompt': false })
        );
        expect(readInstallPromptEnabled()).toBe(false);
    });

    it('honors a legacy tri-state opt-out on the prompt key', () => {
        getConfigSpy.mockReturnValue(configWith({ 'companion.installPrompt': 'off' }));
        expect(readInstallPromptEnabled()).toBe(false);
    });
});

describe('shouldShowInstallPrompt', () => {
    it('shows only when enabled and not installed', () => {
        expect(shouldShowInstallPrompt(true, false)).toBe(true);
        expect(shouldShowInstallPrompt(true, true)).toBe(false);
        expect(shouldShowInstallPrompt(false, false)).toBe(false);
    });
});
