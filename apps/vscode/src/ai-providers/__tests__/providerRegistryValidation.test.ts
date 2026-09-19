import { AIProviders } from '../../core/constants';
import { ProviderPaths } from '../aiProvider';
import { validateProviderConfig, ProviderRegistryError } from '../providerRegistry';

const VALID_CONFIG: ProviderPaths = {
    steeringFile: 'CLAUDE.md',
    globalSteeringFile: '.claude/CLAUDE.md',
    steeringDir: '.claude/steering',
    steeringPattern: '*.md',
    agentsDir: '.claude/agents',
    agentsPattern: '*.md',
    skillsDir: '.claude/skills',
    skillsPattern: '*/SKILL.md',
    mcpConfigPath: '.claude/settings.json',
    configDir: '.claude',
    supportsHooks: true,
    displayName: 'Claude Code',
    commandFormat: 'dash',
    quickPickIcon: '$(hubot)',
    quickPickDescription: 'Full feature support',
    supportsInteractivePermissions: true,
    autoApproveFlag: '--permission-mode bypassPermissions ',
};

describe('validateProviderConfig', () => {
    it('accepts a known-good config unchanged', () => {
        expect(validateProviderConfig(AIProviders.CLAUDE, VALID_CONFIG)).toBe(VALID_CONFIG);
    });

    it('rejects an empty displayName', () => {
        const bad = { ...VALID_CONFIG, displayName: '' };
        expect(() => validateProviderConfig(AIProviders.CLAUDE, bad)).toThrow(ProviderRegistryError);
        expect(() => validateProviderConfig(AIProviders.CLAUDE, bad)).toThrow(/displayName/);
    });

    it('rejects an invalid commandFormat', () => {
        // Cast through unknown — the whole point is to simulate a runtime mistake
        // that the TypeScript shape would normally prevent.
        const bad = { ...VALID_CONFIG, commandFormat: 'dotted' as unknown as 'dot' };
        expect(() => validateProviderConfig(AIProviders.CLAUDE, bad)).toThrow(/commandFormat/);
    });

    it('rejects an autoApproveFlag missing its trailing space', () => {
        // Historical bug: flag concatenates straight into the next arg.
        const bad = { ...VALID_CONFIG, autoApproveFlag: '--yolo' };
        expect(() => validateProviderConfig(AIProviders.COPILOT, bad)).toThrow(/autoApproveFlag/);
    });

    it('accepts an empty autoApproveFlag', () => {
        const ok = { ...VALID_CONFIG, autoApproveFlag: '' };
        expect(() => validateProviderConfig(AIProviders.CODEX, ok)).not.toThrow();
    });

    it('rejects a malformed quickPickIcon', () => {
        const bad = { ...VALID_CONFIG, quickPickIcon: 'hubot' };
        expect(() => validateProviderConfig(AIProviders.CLAUDE, bad)).toThrow(/quickPickIcon/);
    });

    it('rejects steeringDir without steeringPattern', () => {
        const bad = { ...VALID_CONFIG, steeringDir: '.foo/steering', steeringPattern: '' };
        expect(() => validateProviderConfig(AIProviders.CLAUDE, bad)).toThrow(/steeringPattern/);
    });

    it('accumulates multiple field errors in one throw', () => {
        const bad = {
            ...VALID_CONFIG,
            displayName: '',
            commandFormat: 'invalid' as unknown as 'dot',
            autoApproveFlag: '--no-space-trailing',
        };
        try {
            validateProviderConfig(AIProviders.CLAUDE, bad);
            fail('expected throw');
        } catch (e) {
            const msg = String(e);
            expect(msg).toMatch(/displayName/);
            expect(msg).toMatch(/commandFormat/);
            expect(msg).toMatch(/autoApproveFlag/);
        }
    });
});

describe('PROVIDER_PATHS (live)', () => {
    it('all shipped configs pass validation (smoke check that no production entry has rotted)', () => {
        // Importing forces the module-load validation to run; if it had failed
        // we couldn't get this far. Re-affirm by walking the export.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PROVIDER_PATHS } = require('../aiProvider');
        for (const [type, config] of Object.entries(PROVIDER_PATHS)) {
            expect(() => validateProviderConfig(type as never, config as ProviderPaths)).not.toThrow();
        }
    });
});
