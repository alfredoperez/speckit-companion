import * as vscode from 'vscode';
import { AIProviderFactory } from '../aiProviderFactory';
import { PROVIDER_PATHS } from '../aiProvider';
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
});
