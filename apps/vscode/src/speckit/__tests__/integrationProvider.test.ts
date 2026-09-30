import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseIntegrationAgent, applyIntegrationProvider } from '../integrationProvider';
import { getConfiguredProviderType, setIntegrationProviderOverride } from '../../ai-providers/aiProvider';

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn(),
}));

const { createMockExtensionContext } = vscode as unknown as {
    createMockExtensionContext: () => { context: vscode.ExtensionContext; workspaceStore: Map<string, unknown> };
};

const mockRead = fs.readFileSync as unknown as jest.Mock;
const showInfo = vscode.window.showInformationMessage as jest.Mock;

// Shape written by `specify init --here --integration copilot` (spec-kit 1.0.10.dev0).
const COPILOT_FILE = JSON.stringify({
    version: '1.0.10.dev0',
    integration_state_schema: 1,
    installed_integrations: ['copilot'],
    integration_settings: { copilot: { script: 'sh', invoke_separator: '-' } },
    integration: 'copilot',
    default_integration: 'copilot',
});

function setProvider(value: string): void {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn(() => value),
        inspect: jest.fn(),
    });
}

function setFile(text: string | Error): void {
    mockRead.mockImplementation(() => {
        if (text instanceof Error) { throw text; }
        return text;
    });
}

const channel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;

describe('parseIntegrationAgent', () => {
    it('reads the default integration from a real integration.json', () => {
        expect(parseIntegrationAgent(COPILOT_FILE)).toBe('copilot');
    });

    it('prefers default_integration over integration when a project has several installed', () => {
        const text = JSON.stringify({ installed_integrations: ['claude', 'codex'], integration: 'claude', default_integration: 'codex' });
        expect(parseIntegrationAgent(text)).toBe('codex');
    });

    it('falls back to integration for a file without default_integration', () => {
        expect(parseIntegrationAgent(JSON.stringify({ integration: 'gemini' }))).toBe('gemini');
    });

    it('returns undefined for malformed, empty or non-string values', () => {
        expect(parseIntegrationAgent('{ not json')).toBeUndefined();
        expect(parseIntegrationAgent('null')).toBeUndefined();
        expect(parseIntegrationAgent('[]')).toBeUndefined();
        expect(parseIntegrationAgent(JSON.stringify({ default_integration: '', integration: 7 }))).toBeUndefined();
    });
});

describe('applyIntegrationProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setIntegrationProviderOverride(undefined);
        showInfo.mockResolvedValue(undefined);
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/project' } }];
    });

    afterAll(() => {
        setIntegrationProviderOverride(undefined);
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    it('uses the integration agent\'s provider and says so when the setting disagrees', () => {
        setProvider('claude');
        setFile(COPILOT_FILE);
        const { context } = createMockExtensionContext();

        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('copilot');
        expect(showInfo).toHaveBeenCalledTimes(1);
        expect(showInfo.mock.calls[0][0]).toContain('integration is copilot');
        expect(showInfo.mock.calls[0][0]).toContain('Claude Code');
    });

    it('does nothing when the integration matches the setting', () => {
        setProvider('copilot');
        setFile(COPILOT_FILE);
        const { context } = createMockExtensionContext();

        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('copilot');
        expect(showInfo).not.toHaveBeenCalled();
    });

    it('does nothing when there is no integration.json', () => {
        setProvider('claude');
        setFile(Object.assign(new Error('missing'), { code: 'ENOENT' }));
        const { context } = createMockExtensionContext();

        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('claude');
        expect(showInfo).not.toHaveBeenCalled();
    });

    it('keeps the setting and logs when the file cannot be read for another reason', () => {
        setProvider('claude');
        setFile(Object.assign(new Error('denied'), { code: 'EACCES' }));
        const { context } = createMockExtensionContext();

        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('claude');
        expect(channel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Could not read'));
    });

    it('keeps the setting for an agent that has no direct provider', () => {
        setProvider('claude');
        setFile(JSON.stringify({ integration: 'cursor-agent', default_integration: 'cursor-agent' }));
        const { context } = createMockExtensionContext();

        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('claude');
        expect(showInfo).not.toHaveBeenCalled();
    });

    it('does nothing with no folder open', () => {
        (vscode.workspace as any).workspaceFolders = undefined;
        setProvider('claude');
        setFile(COPILOT_FILE);
        const { context } = createMockExtensionContext();

        applyIntegrationProvider(context, channel);

        expect(mockRead).not.toHaveBeenCalled();
        expect(getConfiguredProviderType()).toBe('claude');
    });

    it('goes back to the setting and stays quiet next time once the user chooses Keep', async () => {
        setProvider('claude');
        setFile(COPILOT_FILE);
        const { context, workspaceStore } = createMockExtensionContext();
        showInfo.mockResolvedValue('Keep Claude Code');

        applyIntegrationProvider(context, channel);
        await new Promise(resolve => setImmediate(resolve));

        expect(getConfiguredProviderType()).toBe('claude');
        expect(workspaceStore.size).toBe(1);

        showInfo.mockClear();
        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('claude');
        expect(showInfo).not.toHaveBeenCalled();
    });

    it('asks again when the integration changes after a Keep', async () => {
        setProvider('claude');
        setFile(COPILOT_FILE);
        const { context } = createMockExtensionContext();
        showInfo.mockResolvedValue('Keep Claude Code');
        applyIntegrationProvider(context, channel);
        await new Promise(resolve => setImmediate(resolve));

        showInfo.mockResolvedValue(undefined);
        setFile(JSON.stringify({ integration: 'codex', default_integration: 'codex' }));
        applyIntegrationProvider(context, channel);

        expect(getConfiguredProviderType()).toBe('codex');
        expect(showInfo).toHaveBeenCalledTimes(2);
    });
});
