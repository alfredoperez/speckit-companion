import * as vscode from 'vscode';
import { AIProviderFactory } from '../aiProviderFactory';
import { PROVIDER_PATHS, getConfiguredProviderType } from '../aiProvider';
import { getPermissionFlagForProvider } from '../permissionValidation';
import { AIProviders } from '../../core/constants';

describe('Provider registry', () => {
    function mockPermissionMode(value: 'interactive' | 'auto-approve') {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'permissionMode') return value;
                return defaultValue;
            }),
        });
    }

    function mockConfiguredProvider(value: string) {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) =>
                key === 'aiProvider' ? value : defaultValue
            ),
        });
    }

    describe('AIProviderFactory.getSupportedProviders', () => {
        it('returns one entry per PROVIDER_PATHS key', () => {
            const supported = AIProviderFactory.getSupportedProviders();
            const expectedTypes = Object.keys(PROVIDER_PATHS).sort();
            expect(supported.map(p => p.type).sort()).toEqual(expectedTypes);
        });

        it('includes opencode after registry expansion', () => {
            const types = AIProviderFactory.getSupportedProviders().map(p => p.type);
            expect(types).toContain(AIProviders.OPENCODE);
        });
    });

    describe('getPermissionFlagForProvider', () => {
        it('returns the auto-approve flag for Copilot when mode is auto-approve', () => {
            mockPermissionMode('auto-approve');
            expect(getPermissionFlagForProvider(AIProviders.COPILOT)).toBe('--yolo ');
        });

        it('forces auto-approve for Copilot even when mode is interactive (Copilot CLI cannot surface prompts in -p mode)', () => {
            mockPermissionMode('interactive');
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            expect(getPermissionFlagForProvider(AIProviders.COPILOT)).toBe('--yolo ');
            warn.mockRestore();
        });

        it('returns empty string for providers without an auto-approve flag (Gemini, Codex)', () => {
            mockPermissionMode('auto-approve');
            expect(getPermissionFlagForProvider(AIProviders.GEMINI)).toBe('');
            expect(getPermissionFlagForProvider(AIProviders.CODEX)).toBe('');
        });

        it('returns Claude bypass flag in auto-approve mode', () => {
            mockPermissionMode('auto-approve');
            expect(getPermissionFlagForProvider(AIProviders.CLAUDE)).toBe('--permission-mode bypassPermissions ');
        });
    });

    describe('getConfiguredProviderType', () => {
        it('returns the configured provider when it is a known key', () => {
            mockConfiguredProvider(AIProviders.CLAUDE_VSCODE);
            expect(getConfiguredProviderType()).toBe(AIProviders.CLAUDE_VSCODE);
        });

        it('falls back to Claude for a stale or unknown provider value', () => {
            mockConfiguredProvider('claude-panel'); // renamed away — must not crash
            expect(getConfiguredProviderType()).toBe(AIProviders.CLAUDE);
        });
    });
});
