import * as vscode from 'vscode';
import { IdeChatProvider } from '../ideChatProvider';

describe('IdeChatProvider', () => {
    let provider: IdeChatProvider;

    function mockAvailableCommands(commands: string[]) {
        (vscode.commands.getCommands as jest.Mock).mockResolvedValue(commands);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.env as any).appName = '';
        (vscode.env as any).uriScheme = '';
        (vscode.commands.getCommands as jest.Mock).mockResolvedValue([]);

        const context = {} as any;
        const outputChannel = { appendLine: jest.fn() } as any;
        provider = new IdeChatProvider(context, outputChannel);
    });

    describe('detectHostIde', () => {
        it('detects Cursor from uriScheme', () => {
            (vscode.env as any).uriScheme = 'cursor';
            expect(provider.detectHostIde()).toBe('cursor');
        });

        it('detects Cursor from appName', () => {
            (vscode.env as any).appName = 'Cursor';
            expect(provider.detectHostIde()).toBe('cursor');
        });

        it('detects Windsurf from uriScheme', () => {
            (vscode.env as any).uriScheme = 'windsurf';
            expect(provider.detectHostIde()).toBe('windsurf');
        });

        it('detects Windsurf from appName', () => {
            (vscode.env as any).appName = 'Windsurf';
            expect(provider.detectHostIde()).toBe('windsurf');
        });

        it('detects VS Code from uriScheme', () => {
            (vscode.env as any).uriScheme = 'vscode';
            expect(provider.detectHostIde()).toBe('vscode');
        });

        it('detects VS Code from appName', () => {
            (vscode.env as any).appName = 'Visual Studio Code';
            expect(provider.detectHostIde()).toBe('vscode');
        });

        it('returns unknown for an unrecognized editor', () => {
            (vscode.env as any).uriScheme = 'someotherfork';
            (vscode.env as any).appName = 'Some Other Editor';
            expect(provider.detectHostIde()).toBe('unknown');
        });
    });

    describe('resolveChatCommand', () => {
        it('chooses the fork-specific command when the base command is absent', async () => {
            mockAvailableCommands(['aichat.newchataction']);
            const command = await provider.resolveChatCommand('cursor');
            expect(command).toBe('aichat.newchataction');
        });

        it('prefers the base command when it is present (first in the candidate list wins)', async () => {
            mockAvailableCommands(['aichat.newchataction', 'workbench.action.chat.open']);
            const command = await provider.resolveChatCommand('cursor');
            expect(command).toBe('workbench.action.chat.open');
        });

        it('returns undefined when no candidate command is registered', async () => {
            mockAvailableCommands([]);
            const command = await provider.resolveChatCommand('vscode');
            expect(command).toBeUndefined();
        });
    });

    describe('dispatch when no chat target is resolvable', () => {
        it('does not throw, warns the user, and never calls executeCommand', async () => {
            mockAvailableCommands([]);
            (vscode.env as any).uriScheme = 'someotherfork';

            await expect(provider.executeInTerminal('hello')).resolves.toBeUndefined();
            expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        });
    });

    describe('dispatch happy path (spec-kit ready)', () => {
        it('auto-submits the resolved command (isPartialQuery false) and returns undefined', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'vscode';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            const result = await provider.executeInTerminal('do the thing');

            expect(result).toBeUndefined();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                { query: 'do the thing', isPartialQuery: false }
            );
            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        });
    });

    describe('strips the context-update preamble and shortens the spec path', () => {
        it('sends only the clean command with the spec name, not the bookkeeping preamble or absolute path', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'vscode';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            const wrapped =
                '<!-- speckit-companion:context-update -->\n' +
                'UPDATE SPEC CONTEXT JSON ... lots of bookkeeping instructions ...\n' +
                '<!-- /speckit-companion:context-update -->\n\n' +
                '/speckit.tasks /Users/me/dev/project/specs/100-ide-chat-provider';

            await provider.executeInTerminal(wrapped);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                { query: '/speckit.tasks 100-ide-chat-provider', isPartialQuery: false }
            );
        });

        it('leaves the specify free-text description untouched', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'vscode';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            await provider.executeInTerminal('/speckit.specify add OAuth login with refresh tokens');

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                { query: '/speckit.specify add OAuth login with refresh tokens', isPartialQuery: false }
            );
        });

        it('inlines the feature description for a specify temp markdown file (chat cannot read paths)', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'vscode';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);
            const md = 'Add OAuth login with refresh tokens\n\n## Post-Specification: Update .spec-context.json\nblah blah';
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(md, 'utf-8'));

            await provider.executeInTerminal('/speckit.specify /tmp/speckit/abc/spec.md');

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                { query: '/speckit.specify Add OAuth login with refresh tokens', isPartialQuery: false }
            );
        });
    });

    describe('dispatch when spec-kit is not initialized', () => {
        it('warns the user and prefills (isPartialQuery true) instead of auto-submitting', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'vscode';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(false);

            const result = await provider.executeInTerminal('do the thing');

            expect(result).toBeUndefined();
            expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                { query: 'do the thing', isPartialQuery: true }
            );
        });
    });

    describe('executeHeadless', () => {
        it('returns an undefined exit code (treated as success by callers)', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'vscode';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            const result = await provider.executeHeadless('prompt');
            expect(result).toEqual({ exitCode: undefined });
        });
    });

    describe('getPermissionFlag', () => {
        it('returns an empty string', () => {
            expect(provider.getPermissionFlag()).toBe('');
        });
    });
});
