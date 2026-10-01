import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseIntegrationAgent, suggestIntegrationProvider } from '../integrationProvider';
import { getConfiguredProviderType } from '../../ai-providers/aiProvider';

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

const update = jest.fn();
let inspected: { globalValue?: string; workspaceValue?: string } | undefined;

function setProvider(value: string): void {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn(() => value),
        inspect: jest.fn(() => inspected),
        update,
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

describe('suggestIntegrationProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        showInfo.mockReset();
        showInfo.mockResolvedValue(undefined);
        update.mockReset();
        update.mockResolvedValue(undefined);
        inspected = undefined;
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/project' } }];
    });

    afterAll(() => {
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    describe('when the project was set up for a different assistant', () => {
        it('shows one message that names both and offers Switch and Keep', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(showInfo).toHaveBeenCalledTimes(1);
            const [message, ...buttons] = showInfo.mock.calls[0];
            expect(message).toContain('GitHub Copilot');
            expect(message).toContain('Claude Code');
            expect(buttons).toEqual([expect.stringMatching(/^Switch to GitHub Copilot/), 'Keep Claude Code']);
        });

        it('never changes the provider without a click', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();
            showInfo.mockReturnValue(new Promise(() => undefined));

            void suggestIntegrationProvider(context, channel);
            await new Promise(resolve => setImmediate(resolve));

            expect(showInfo).toHaveBeenCalledTimes(1);
            expect(update).not.toHaveBeenCalled();
            expect(getConfiguredProviderType()).toBe('claude');
        });
    });

    describe('when the user picks Switch', () => {
        it('writes the suggested provider to the global setting', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context, workspaceStore } = createMockExtensionContext();
            showInfo.mockImplementation(async (_message: string, switchLabel: string) => switchLabel);

            await suggestIntegrationProvider(context, channel);

            expect(update).toHaveBeenCalledWith('aiProvider', 'copilot', vscode.ConfigurationTarget.Global);
            expect(workspaceStore.size).toBe(0);
        });

        it('writes the workspace setting when that is the one in charge', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            inspected = { globalValue: 'gemini', workspaceValue: 'claude' };
            const { context } = createMockExtensionContext();
            showInfo.mockImplementation(async (_message: string, switchLabel: string) => switchLabel);

            await suggestIntegrationProvider(context, channel);

            expect(update).toHaveBeenCalledWith('aiProvider', 'copilot', vscode.ConfigurationTarget.Workspace);
        });

        it('logs instead of throwing when the setting cannot be written', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();
            showInfo.mockImplementation(async (_message: string, switchLabel: string) => switchLabel);
            update.mockRejectedValue(new Error('read-only'));

            await expect(suggestIntegrationProvider(context, channel)).resolves.toBeUndefined();
            expect(channel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Could not apply'));
        });
    });

    describe('when the user picks Keep or dismisses the message', () => {
        it('remembers Keep and stays quiet on the next activation', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();
            showInfo.mockResolvedValue('Keep Claude Code');

            await suggestIntegrationProvider(context, channel);
            showInfo.mockClear();
            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });

        it('remembers a dismissal the same way', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);
            showInfo.mockClear();
            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });

        it('asks again for a different assistant pair and keeps both remembered', async () => {
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();
            await suggestIntegrationProvider(context, channel);

            setFile(JSON.stringify({ integration: 'codex', default_integration: 'codex' }));
            await suggestIntegrationProvider(context, channel);
            expect(showInfo).toHaveBeenCalledTimes(2);

            showInfo.mockClear();
            setFile(COPILOT_FILE);
            await suggestIntegrationProvider(context, channel);
            setFile(JSON.stringify({ integration: 'codex', default_integration: 'codex' }));
            await suggestIntegrationProvider(context, channel);
            expect(showInfo).not.toHaveBeenCalled();
        });
    });

    describe('when there is nothing to suggest', () => {
        it('shows nothing when the integration matches the setting', async () => {
            setProvider('copilot');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
        });

        it('shows nothing when there is no integration.json', async () => {
            setProvider('claude');
            setFile(Object.assign(new Error('missing'), { code: 'ENOENT' }));
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
            expect(channel.appendLine).not.toHaveBeenCalled();
        });

        it('shows nothing and logs when the file cannot be read for another reason', async () => {
            setProvider('claude');
            setFile(Object.assign(new Error('denied'), { code: 'EACCES' }));
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
            expect(channel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Could not read'));
        });

        it('shows nothing when the file is not valid JSON', async () => {
            setProvider('claude');
            setFile('{ not json');
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
        });

        it('shows nothing for an agent that has no direct provider', async () => {
            setProvider('claude');
            setFile(JSON.stringify({ integration: 'cursor-agent', default_integration: 'cursor-agent' }));
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(showInfo).not.toHaveBeenCalled();
        });

        it('shows nothing with no folder open', async () => {
            (vscode.workspace as any).workspaceFolders = undefined;
            setProvider('claude');
            setFile(COPILOT_FILE);
            const { context } = createMockExtensionContext();

            await suggestIntegrationProvider(context, channel);

            expect(mockRead).not.toHaveBeenCalled();
            expect(showInfo).not.toHaveBeenCalled();
        });
    });
});
