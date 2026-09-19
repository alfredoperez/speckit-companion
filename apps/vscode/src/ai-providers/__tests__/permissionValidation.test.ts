import { AIProviders } from '../../core/constants';

/**
 * Loads a fresh `permissionValidation` module (so the module-private
 * `firedOverrideForProvider` Set starts empty) wired up to the freshly
 * loaded `vscode` mock with `permissionMode` returning `value`.
 */
function loadModuleWithMode(value: 'interactive' | 'auto-approve') {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
            if (key === 'permissionMode') return value;
            return defaultValue;
        }),
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../permissionValidation') as typeof import('../permissionValidation');
}

describe('getPermissionFlagForProvider — interactive override', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('forces auto-approve for Copilot in interactive mode (the core fix)', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('interactive');
        expect(getPermissionFlagForProvider(AIProviders.COPILOT)).toBe('--yolo ');
    });

    it('returns empty string for Claude in interactive mode (supportsInteractivePermissions: true)', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('interactive');
        expect(getPermissionFlagForProvider(AIProviders.CLAUDE)).toBe('');
    });

    it('returns empty string for Qwen in interactive mode (supportsInteractivePermissions: true; sanity check that override is gated)', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('interactive');
        expect(getPermissionFlagForProvider(AIProviders.QWEN)).toBe('');
    });

    it('returns empty string for Gemini in interactive mode (no autoApproveFlag — override does not apply)', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('interactive');
        expect(getPermissionFlagForProvider(AIProviders.GEMINI)).toBe('');
    });

    it('returns the auto-approve flag for Copilot in auto-approve mode (regression)', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('auto-approve');
        expect(getPermissionFlagForProvider(AIProviders.COPILOT)).toBe('--yolo ');
    });

    it('returns the bypass flag for Claude in auto-approve mode (regression)', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('auto-approve');
        expect(getPermissionFlagForProvider(AIProviders.CLAUDE)).toBe('--permission-mode bypassPermissions ');
    });

    it('warns exactly once per provider when forcing auto-approve in interactive mode', () => {
        const { getPermissionFlagForProvider } = loadModuleWithMode('interactive');

        getPermissionFlagForProvider(AIProviders.COPILOT);
        getPermissionFlagForProvider(AIProviders.COPILOT);

        expect(warnSpy).toHaveBeenCalledTimes(1);
    });
});
