import * as vscode from 'vscode';
import { readInstallPromptEnabled, shouldShowInstallPrompt } from '../../../src/speckit/specKitExtensionInstall';

describe('readInstallPromptEnabled — gated on the Companion workflow', () => {
    const getConfigSpy = vscode.workspace.getConfiguration as jest.Mock;

    const configWith = (values: Record<string, unknown>) => ({
        get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
    });

    afterEach(() => {
        getConfigSpy.mockReset();
        getConfigSpy.mockReturnValue({ get: jest.fn().mockReturnValue(['specs']) });
    });

    it('returns false when the Companion workflow is off, even if the prompt is on', () => {
        getConfigSpy.mockReturnValue(
            configWith({ 'companion.speckitCompanionWorkflow': false, 'companion.installPrompt': true })
        );
        expect(readInstallPromptEnabled()).toBe(false);
    });

    it('returns false when the workflow setting is unset (defaults off)', () => {
        getConfigSpy.mockReturnValue(configWith({ 'companion.installPrompt': true }));
        expect(readInstallPromptEnabled()).toBe(false);
    });

    it('returns true when the workflow is on and the prompt is on (default)', () => {
        getConfigSpy.mockReturnValue(configWith({ 'companion.speckitCompanionWorkflow': true }));
        expect(readInstallPromptEnabled()).toBe(true);
    });

    it('returns false when the workflow is on but the prompt is explicitly off', () => {
        getConfigSpy.mockReturnValue(
            configWith({ 'companion.speckitCompanionWorkflow': true, 'companion.installPrompt': false })
        );
        expect(readInstallPromptEnabled()).toBe(false);
    });

    it('honors a legacy tri-state opt-in on the workflow key', () => {
        getConfigSpy.mockReturnValue(configWith({ 'companion.speckitCompanionWorkflow': 'on' }));
        expect(readInstallPromptEnabled()).toBe(true);
    });
});

describe('shouldShowInstallPrompt', () => {
    it('shows only when enabled and not installed', () => {
        expect(shouldShowInstallPrompt(true, false)).toBe(true);
        expect(shouldShowInstallPrompt(true, true)).toBe(false);
        expect(shouldShowInstallPrompt(false, false)).toBe(false);
    });
});
