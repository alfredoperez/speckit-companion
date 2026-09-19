import { AIProviders } from '../../core/constants';
import { PROVIDER_PATHS, getConfiguredProviderType } from '../aiProvider';
import { AIProviderFactory } from '../aiProviderFactory';
import { AntigravityCliProvider } from '../antigravityCliProvider';

describe('Antigravity provider', () => {
    it('is a registered provider with a validated PROVIDER_PATHS entry', () => {
        const entry = PROVIDER_PATHS[AIProviders.ANTIGRAVITY];
        expect(entry).toBeDefined();
        expect(entry.displayName).toBe('Antigravity');
        expect(entry.commandFormat).toBe('dash');
    });

    it('dispatches the `agy` binary interactively (-i), not the non-existent `antigravity` CLI', () => {
        const outputChannel = { appendLine: jest.fn() } as any;
        const provider = new AntigravityCliProvider({} as any, outputChannel) as any;
        expect(provider.cliBinary).toBe('agy');
        expect(provider.cliPromptFlag()).toBe('-i ');
        expect(provider.installHint.installCommand).toContain('antigravity.google/cli/install.sh');
    });

    it('resolves the antigravity setting value to AntigravityCliProvider', () => {
        AIProviderFactory.clearCache();
        const outputChannel = { appendLine: jest.fn() } as any;
        const provider = AIProviderFactory.getProviderByType(
            AIProviders.ANTIGRAVITY,
            {} as any,
            outputChannel,
        );
        expect(provider).toBeInstanceOf(AntigravityCliProvider);
        expect(provider.type).toBe('antigravity');
        expect(outputChannel.appendLine).not.toHaveBeenCalledWith(
            expect.stringContaining('Unknown provider type'),
        );
    });

    it('is accepted as a configured provider type (no fallback to Claude)', () => {
        const config = require('vscode').workspace.getConfiguration('speckit');
        const original = config.get;
        config.get = jest.fn((key: string, def: unknown) =>
            key === 'aiProvider' ? 'antigravity' : def,
        );
        try {
            expect(getConfiguredProviderType()).toBe('antigravity');
        } finally {
            config.get = original;
        }
    });
});
