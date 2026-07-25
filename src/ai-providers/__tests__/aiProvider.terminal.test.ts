import { providerDispatchesToTerminal, AIProviderType } from '../aiProvider';
import { AIProviders } from '../../core/constants';

describe('providerDispatchesToTerminal', () => {
    const EDITOR_PROVIDERS: AIProviderType[] = [
        AIProviders.IDE_CHAT,
        AIProviders.CLAUDE_VSCODE,
        AIProviders.WIBEY_VSCODE,
    ];

    it('classifies every AIProviders enum value', () => {
        const allValues = Object.values(AIProviders) as AIProviderType[];
        for (const type of allValues) {
            const expected = !EDITOR_PROVIDERS.includes(type);
            expect(providerDispatchesToTerminal(type)).toBe(expected);
        }
    });

    it('returns false for the three in-editor chat/panel providers', () => {
        for (const type of EDITOR_PROVIDERS) {
            expect(providerDispatchesToTerminal(type)).toBe(false);
        }
    });

    it('returns true for terminal-CLI providers', () => {
        for (const type of [
            AIProviders.CLAUDE,
            AIProviders.GEMINI,
            AIProviders.COPILOT,
            AIProviders.CODEX,
            AIProviders.QWEN,
            AIProviders.OPENCODE,
            AIProviders.WIBEY,
            AIProviders.ANTIGRAVITY,
        ] as AIProviderType[]) {
            expect(providerDispatchesToTerminal(type)).toBe(true);
        }
    });

    it('defaults an unknown provider value to terminal (neutral fallback)', () => {
        expect(providerDispatchesToTerminal('some-future-cli' as AIProviderType)).toBe(true);
    });
});
