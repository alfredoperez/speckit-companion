import * as vscode from 'vscode';

// Mock the VS Code config to control getWorkflows() behavior
const mockGetConfig = jest.fn();
(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: mockGetConfig,
});

import {
    getWorkflowCommands,
    getWorkflows,
    isWorkflowSupportedForProvider,
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
            { name: 'auto', title: 'Auto Mode', command: '/sdd:auto', step: 'specify' },
        ];
        mockGetConfig.mockReturnValue([
            { name: 'sdd', steps: [{ name: 'specify', command: 'sdd.specify' }], commands },
        ]);

        const result = getWorkflowCommands('sdd');

        expect(result).toEqual(commands);
    });

    it('should return empty array when workflow has no commands', () => {
        mockGetConfig.mockReturnValue([
            { name: 'sdd', steps: [{ name: 'specify', command: 'sdd.specify' }] },
        ]);

        const result = getWorkflowCommands('sdd');

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
        const wf = { name: 'sdd', supportedAiProviders: ['claude'] };
        expect(isWorkflowSupportedForProvider(wf, 'claude')).toBe(true);
        expect(isWorkflowSupportedForProvider(wf, 'copilot')).toBe(false);
    });

    it('treats claude and claude-vscode as distinct ids', () => {
        const wf = { name: 'sdd', supportedAiProviders: ['claude'] };
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
            { name: 'sdd', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'sdd.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).not.toContain('sdd');
    });

    it('shows a claude-only workflow under claude', () => {
        mockConfig('claude', [
            { name: 'sdd', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'sdd.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('sdd');
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
            { name: 'sdd', supportedAiProviders: ['claude'], steps: [{ name: 'specify', command: 'sdd.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).toContain('speckit');
        expect(names).not.toContain('sdd');
    });

    it('hides a workflow whose only declared provider id is unknown', () => {
        mockConfig('claude', [
            { name: 'broken', supportedAiProviders: ['bogus'], steps: [{ name: 'specify', command: 'x.specify' }] },
        ]);

        const names = getWorkflows().map(w => w.name);

        expect(names).not.toContain('broken');
    });
});

describe('validateWorkflow supportedAiProviders', () => {
    it('accepts a valid array of known provider ids', () => {
        const result = validateWorkflow({ name: 'sdd', supportedAiProviders: ['claude', 'claude-vscode'] });
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('errors when supportedAiProviders is not an array', () => {
        const result = validateWorkflow({ name: 'sdd', supportedAiProviders: 'claude' as unknown as string[] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('supportedAiProviders'))).toBe(true);
    });

    it('warns but stays valid on an unknown provider id', () => {
        const result = validateWorkflow({ name: 'sdd', supportedAiProviders: ['bogus'] });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('bogus'))).toBe(true);
    });
});
