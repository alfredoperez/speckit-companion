import * as vscode from 'vscode';

// Mock the VS Code config to control getWorkflows() behavior
const mockGetConfig = jest.fn();
(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: mockGetConfig,
});

// The Companion option is offered to the picker only when the spec-kit extension
// is installed on disk — mock that probe so selectability is deterministic.
jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn(),
}));
import { isCompanionInstalled } from '../../settings/companionPresetReconciler';

import {
    buildWorkflowChoices,
    getWorkflowCommands,
    getWorkflows,
    getWorkflow,
    isWorkflowSupportedForProvider,
    resolveStepCommand,
    validateWorkflow,
} from '../workflowManager';

/**
 * Make the shared config mock key-aware so getWorkflows() can read both
 * `customWorkflows` and `aiProvider` (the latter via getConfiguredProviderType).
 */
function mockConfig(provider: string, customWorkflows: unknown[]): void {
    mockGetConfig.mockImplementation((key: string, def?: unknown) => {
        if (key === 'aiProvider') {
            return provider;
        }
        if (key === 'customWorkflows') {
            return customWorkflows;
        }
        return def;
    });
}

describe('getWorkflowCommands', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetConfig.mockReturnValue([]);
    });

    it('should return commands array from a custom workflow', () => {
        const commands = [
            { name: 'auto', title: 'Auto Mode', command: '/my-custom-flow:auto', step: 'specify' },
        ];
        mockGetConfig.mockReturnValue([
            { name: 'my-custom-flow', steps: [{ name: 'specify', command: 'my-custom-flow.specify' }], commands },
        ]);

        const result = getWorkflowCommands('my-custom-flow');

        expect(result).toEqual(commands);
    });

    it('should return empty array when workflow has no commands', () => {
        mockGetConfig.mockReturnValue([
            { name: 'my-custom-flow', steps: [{ name: 'specify', command: 'my-custom-flow.specify' }] },
        ]);

        const result = getWorkflowCommands('my-custom-flow');

        expect(result).toEqual([]);
    });

    it('should return empty array when workflow is not found', () => {
        mockGetConfig.mockReturnValue([]);

        const result = getWorkflowCommands('nonexistent');

        expect(result).toEqual([]);
    });

    it('should return empty array for the default workflow (no commands)', () => {
        mockGetConfig.mockReturnValue([]);

        const result = getWorkflowCommands('speckit');

        expect(result).toEqual([]);
    });
});

describe('isWorkflowSupportedForProvider', () => {
    it('supports every provider when supportedAiProviders is omitted', () => {
        expect(isWorkflowSupportedForProvider({ name: 'wf' }, 'copilot')).toBe(true);
    });

    it('supports every provider when supportedAiProviders is empty', () => {
        expect(isWorkflowSupportedForProvider({ name: 'wf', supportedAiProviders: [] }, 'gemini')).toBe(true);
    });

    it('supports only the declared providers', () => {
        const wf = { name: 'my-custom-flow', supportedAiProviders: ['claude'] };
        expect(isWorkflowSupportedForProvider(wf, 'claude')).toBe(true);
        expect(isWorkflowSupportedForProvider(wf, 'copilot')).toBe(false);
    });

    it('treats claude and claude-vscode as distinct ids', () => {
        const wf = { name: 'my-custom-flow', supportedAiProviders: ['claude'] };
        expect(isWorkflowSupportedForProvider(wf, 'claude-vscode')).toBe(false);
    });

    it('never matches an unknown provider id', () => {
        const wf = { name: 'wf', supportedAiProviders: ['bogus'] };
        expect(isWorkflowSupportedForProvider(wf, 'claude')).toBe(false);
    });
});

describe('getWorkflows provider filtering', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('hides a claude-only workflow under a non-claude provider', () => {
        mockConfig('copilot', [
            { name: 'my-custom-flow', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'my-custom-flow.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).not.toContain('my-custom-flow');
    });

    it('shows a claude-only workflow under claude', () => {
        mockConfig('claude', [
            { name: 'my-custom-flow', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'my-custom-flow.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('my-custom-flow');
    });

    it('shows workflows with no declaration under any provider', () => {
        mockConfig('gemini', [
            { name: 'generic', steps: [{ name: 'specify', command: 'x.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('generic');
    });

    it('treats an empty supportedAiProviders as all providers', () => {
        mockConfig('qwen', [
            { name: 'anywhere', supportedAiProviders: [], steps: [{ name: 'specify', command: 'x.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('anywhere');
    });

    it('always includes the default speckit workflow even when nothing else matches', () => {
        mockConfig('codex', [
            { name: 'my-custom-flow', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'my-custom-flow.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('speckit');
        expect(names).not.toContain('my-custom-flow');
    });

    it('hides a workflow whose only declared provider id is unknown', () => {
        mockConfig('claude', [
            { name: 'broken', supportedAiProviders: ['bogus'], steps: [{ name: 'specify', command: 'x.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).not.toContain('broken');
    });
});

describe('Companion is offered to the picker with no beta setting (gate removed)', () => {
    const originalFolders = vscode.workspace.workspaceFolders;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
            { uri: { fsPath: '/root' } },
        ];
    });

    afterEach(() => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = originalFolders;
    });

    it('offers Companion whenever the extension is installed, with no setting enabled', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', []);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('speckit');
        expect(names).toContain('companion');
    });

    it('hides Companion from the picker when the extension is not installed', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        mockConfig('claude', []);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('speckit');
        expect(names).not.toContain('companion');
    });

    it('resolves an existing companion spec even when the extension is not installed', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        mockConfig('claude', []);

        expect(getWorkflow('companion')?.name).toBe('companion');
    });
});

describe('buildWorkflowChoices — the one pick-surface builder (FR-007)', () => {
    const ROOT = '/root';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('always offers exactly the two built-ins when no custom workflows exist', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', []);

        const choices = buildWorkflowChoices(ROOT, 'claude');

        expect(choices.map(c => c.name)).toEqual(['speckit', 'companion']);
    });

    it('keeps Companion present even when the spec-kit extension is not installed (install-to-enable)', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        mockConfig('claude', []);

        const companion = buildWorkflowChoices(ROOT, 'claude').find(c => c.name === 'companion');

        expect(companion).toBeDefined();
        expect(companion!.installed).toBe(false);
        expect(companion!.displayName).toBe('SpecKit Companion');
    });

    it('reports Companion installed through the shared isCompanionSelectable predicate', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', []);

        const companion = buildWorkflowChoices(ROOT, 'claude').find(c => c.name === 'companion');

        expect(companion!.installed).toBe(true);
        expect(isCompanionInstalled).toHaveBeenCalledWith(ROOT);
    });

    it("carries Companion's proof line as its description, verbatim", () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', []);

        const companion = buildWorkflowChoices(ROOT, 'claude').find(c => c.name === 'companion');

        expect(companion!.description).toBe('specs 60–68% leaner, same correctness');
        expect(companion!.supportsAuto).toBe(true);
    });

    it('gives every choice a description and an installed flag', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', [
            { name: 'my-flow', description: 'My flow', steps: [{ name: 'discuss', command: 'my.discuss' }] },
        ]);

        for (const choice of buildWorkflowChoices(ROOT, 'claude')) {
            expect(typeof choice.description).toBe('string');
            expect(typeof choice.installed).toBe('boolean');
        }
    });

    it('applies canonical validation: an invalid custom workflow is skipped', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', [
            { name: 'Invalid Name!', steps: [{ name: 'specify', command: 'x.specify' }] },
        ]);

        const names = buildWorkflowChoices(ROOT, 'claude').map(c => c.name);

        expect(names).toEqual(['speckit', 'companion']);
    });

    it('applies canonical reserved-name and dedupe rules', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', [
            { name: 'companion', steps: [{ name: 'specify', command: 'shadow.specify' }] },
            { name: 'default', steps: [{ name: 'specify', command: 'shadow.specify' }] },
            { name: 'my-flow', steps: [{ name: 'specify', command: 'my.specify' }] },
            { name: 'my-flow', steps: [{ name: 'specify', command: 'dup.specify' }] },
        ]);

        const choices = buildWorkflowChoices(ROOT, 'claude');

        expect(choices.map(c => c.name)).toEqual(['speckit', 'companion', 'my-flow']);
        expect(choices.find(c => c.name === 'my-flow')!.entryCommand).toBe('my.specify');
    });

    it('applies the provider filter to custom workflows', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', [
            { name: 'gemini-only', supportedAiProviders: ['gemini'], steps: [{ name: 'specify', command: 'g.specify' }] },
        ]);

        const names = buildWorkflowChoices(ROOT, 'claude').map(c => c.name);

        expect(names).not.toContain('gemini-only');
    });

    it("resolves a custom workflow's entry command from its first navigable step", () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        mockConfig('claude', [
            {
                name: 'discuss-first',
                steps: [
                    { name: 'discuss', command: 'discuss-first.discuss' },
                    { name: 'plan', command: 'discuss-first.plan' },
                ],
                commands: [
                    { name: 'quick', title: 'Quick', command: '/discuss-first:quick', step: 'discuss' },
                ],
            },
        ]);

        const custom = buildWorkflowChoices(ROOT, 'claude').find(c => c.name === 'discuss-first');

        expect(custom!.entryCommand).toBe('discuss-first.discuss');
        expect(custom!.installed).toBe(true);
        expect(custom!.specifyCommands).toEqual([
            { name: 'quick', title: 'Quick', command: '/discuss-first:quick', tooltip: undefined },
        ]);
    });
});

describe('validateWorkflow supportedAiProviders', () => {
    it('accepts a valid array of known provider ids', () => {
        const result = validateWorkflow({ name: 'my-custom-flow', supportedAiProviders: ['claude', 'claude-vscode'] });
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('errors when supportedAiProviders is not an array', () => {
        const result = validateWorkflow({ name: 'my-custom-flow', supportedAiProviders: 'claude' as unknown as string[] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('supportedAiProviders'))).toBe(true);
    });

    it('warns but stays valid on an unknown provider id', () => {
        const result = validateWorkflow({ name: 'my-custom-flow', supportedAiProviders: ['bogus'] });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('bogus'))).toBe(true);
    });
});

describe('getWorkflow resolves regardless of active provider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('still resolves a claude-only workflow under a non-claude provider', () => {
        // The picker hides it (getWorkflows filters), but an existing spec that
        // already selected it must keep its real steps.
        mockConfig('ide-chat', [
            { name: 'my-custom-flow', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'my-custom-flow:specify' }] },
        ]);

        expect(getWorkflows().map(w => w.name)).not.toContain('my-custom-flow'); // hidden from selection
        expect(getWorkflow('my-custom-flow')?.name).toBe('my-custom-flow');       // but still resolvable
    });

    it('a spec stored as workflow=companion advances on the companion commands, not the stock twins (#548)', () => {
        // A companion-stored spec must resolve the companion commands, not the stock twins.
        mockConfig('claude', []);
        const wf = getWorkflow('companion');
        expect(wf?.name).toBe('companion');
        const cmd = (step: string) => wf?.steps?.find(s => s.name === step)?.command;
        expect(cmd('plan')).toBe('speckit.companion.plan');
        expect(cmd('tasks')).toBe('speckit.companion.tasks');
        expect(cmd('implement')).toBe('speckit.companion.implement');
    });
});

describe('resolveStepCommand strips a leading slash (issue #419)', () => {
    const workflow = (command: string) => ({
        name: 'slash-flow',
        steps: [{ name: 'discuss', command }],
    });

    it('returns the bare command when the config wrote a leading slash', () => {
        expect(resolveStepCommand(workflow('/to-spec') as never, 'discuss' as never)).toBe('to-spec');
    });

    it('leaves a slash-free command untouched', () => {
        expect(resolveStepCommand(workflow('to-spec') as never, 'discuss' as never)).toBe('to-spec');
    });

    it('normalizes slash and no-slash to the same value', () => {
        expect(resolveStepCommand(workflow('/speckit.specify') as never, 'discuss' as never))
            .toBe(resolveStepCommand(workflow('speckit.specify') as never, 'discuss' as never));
    });
});
