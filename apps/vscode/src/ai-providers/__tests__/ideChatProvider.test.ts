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

        it('detects Antigravity from appName', () => {
            (vscode.env as any).appName = 'Antigravity';
            expect(provider.detectHostIde()).toBe('antigravity');
        });

        it('returns unknown for an unrecognized editor', () => {
            (vscode.env as any).uriScheme = 'someotherfork';
            (vscode.env as any).appName = 'Some Other Editor';
            expect(provider.detectHostIde()).toBe('unknown');
        });
    });

    describe('per-host command formatting', () => {
        async function dispatchOn(uriScheme: string, command: string): Promise<unknown> {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = uriScheme;
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);
            await provider.executeInTerminal(command);
            return (vscode.commands.executeCommand as jest.Mock).mock.calls.find(
                c => c[0] === 'workbench.action.chat.open'
            )?.[1];
        }

        it('emits the dash form for Cursor (dash-named skills)', async () => {
            const payload = await dispatchOn('cursor', '/speckit.tasks /repo/specs/_demo-tasked');
            expect(payload).toEqual({ query: '/speckit-tasks _demo-tasked', isPartialQuery: false });
        });

        it('emits the dash form for Antigravity', async () => {
            const payload = await dispatchOn('antigravity', '/speckit.plan /repo/specs/_demo-planned');
            expect(payload).toEqual({ query: '/speckit-plan _demo-planned', isPartialQuery: false });
        });
    });

    describe('Cursor prefill (no callable submit command)', () => {
        it('prefills the dash command and does not auto-fire any submit command', async () => {
            mockAvailableCommands(['workbench.action.chat.open', 'composer.acceptComposerStep', 'composer.sendToAgent']);
            (vscode.env as any).uriScheme = 'cursor';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            await provider.executeInTerminal('/speckit.tasks /repo/specs/_demo-tasked');

            const calls = (vscode.commands.executeCommand as jest.Mock).mock.calls.map(c => c[0]);
            expect(calls).toContain('workbench.action.chat.open');
            // No submit command is fired — Cursor has no callable composer submit.
            expect(calls).not.toContain('composer.acceptComposerStep');
            expect(calls).not.toContain('composer.sendToAgent');
        });
    });

    describe('Windsurf clipboard fallback (host drops the query arg)', () => {
        it('copies the command and tells the user to paste', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'windsurf';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            await provider.executeInTerminal('/speckit.tasks /repo/specs/_demo-tasked');

            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/speckit.tasks _demo-tasked');
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                expect.objectContaining({ query: '/speckit.tasks _demo-tasked' })
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
        });

        it('suppresses the paste guidance when spec-kit is not initialized (only warns)', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'windsurf';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(false);

            await provider.executeInTerminal('/speckit.tasks /repo/specs/_demo-tasked');

            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/speckit.tasks _demo-tasked');
            expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
    });

    describe('unknown host', () => {
        it('still dispatches via the inherited base command (dot form) when present', async () => {
            mockAvailableCommands(['workbench.action.chat.open']);
            (vscode.env as any).uriScheme = 'someotherfork';
            (vscode.env as any).appName = 'Some Other Editor';
            jest.spyOn(provider as any, 'isWorkspaceSpecKitReady').mockResolvedValue(true);

            await provider.executeInTerminal('/speckit.tasks /repo/specs/_demo-tasked');

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.action.chat.open',
                { query: '/speckit.tasks _demo-tasked', isPartialQuery: false }
            );
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
