import * as vscode from 'vscode';
import { ClaudePanelProvider } from '../claudePanelProvider';

describe('ClaudePanelProvider', () => {
    let provider: ClaudePanelProvider;

    /** The string form of the URI passed to the first openExternal call. */
    function openedUri(): string {
        const call = (vscode.env.openExternal as jest.Mock).mock.calls[0];
        return call[0].toString();
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.env as any).uriScheme = 'vscode';
        (vscode.env.openExternal as jest.Mock).mockResolvedValue(true);
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ id: 'anthropic.claude-code' });
        (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/ws') }];
        (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);
        (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const outputChannel = { appendLine: jest.fn() } as any;
        provider = new ClaudePanelProvider({} as any, outputChannel);
    });

    describe('isInstalled', () => {
        it('is true when the Claude Code extension is present', async () => {
            (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ id: 'anthropic.claude-code' });
            expect(await provider.isInstalled()).toBe(true);
        });

        it('is false when the Claude Code extension is absent', async () => {
            (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);
            expect(await provider.isInstalled()).toBe(false);
        });
    });

    describe('dispatch', () => {
        it('opens the panel via the running uriScheme with the command prefilled', async () => {
            (vscode.env as any).uriScheme = 'vscode-insiders';
            await provider.executeSlashCommand('/speckit-tasks');

            expect(vscode.env.openExternal).toHaveBeenCalledTimes(1);
            const uri = openedUri();
            expect(uri).toContain('vscode-insiders://anthropic.claude-code/open?prompt=');
            expect(uri).toContain(encodeURIComponent('/speckit-tasks'));
        });

        it('inlines a new-spec description instead of the temp file path', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from('Add a dark mode toggle\n\n## Post-Specification\nbookkeeping', 'utf-8')
            );

            await provider.executeSlashCommand('/speckit-specify /tmp/globalStorage/spec.md');

            const uri = decodeURIComponent(openedUri());
            expect(uri).toContain('/speckit-specify Add a dark mode toggle');
            expect(uri).not.toContain('/tmp/globalStorage/spec.md');
        });

        it('shortens a spec-dir path argument to just the spec name', async () => {
            await provider.executeSlashCommand('/speckit-plan specs/104-claude-panel-provider/spec.md');

            const uri = decodeURIComponent(openedUri());
            expect(uri).toContain('/speckit-plan 104-claude-panel-provider');
            expect(uri).not.toContain('spec.md');
        });

        it('shows a press-Enter notification naming the command verb', async () => {
            await provider.executeSlashCommand('/speckit-implement');

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('/speckit-implement')
            );
        });

        it('warns and does not open the panel when the extension is not installed', async () => {
            (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);

            await provider.executeSlashCommand('/speckit-tasks');

            expect(vscode.env.openExternal).not.toHaveBeenCalled();
            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        });

        it('never throws when openExternal rejects', async () => {
            (vscode.env.openExternal as jest.Mock).mockRejectedValue(new Error('boom'));

            await expect(provider.executeSlashCommand('/speckit-tasks')).resolves.toBeUndefined();
            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        });
    });

    describe('context preamble', () => {
        const PREAMBLE =
            '<!-- speckit-companion:context-update -->\nbookkeeping\n<!-- /speckit-companion:context-update -->';

        it('writes the prompt file and @-mentions it alongside the command', async () => {
            await provider.executeInTerminal(`${PREAMBLE}\n\n/speckit-tasks`);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
            const uri = decodeURIComponent(openedUri());
            expect(uri).toContain('/speckit-tasks');
            expect(uri).toContain('@.claude/speckit-companion-prompt.md');
        });

        it('dispatches without the @-mention when there is no workspace folder', async () => {
            (vscode.workspace as any).workspaceFolders = undefined;

            await provider.executeInTerminal(`${PREAMBLE}\n\n/speckit-tasks`);

            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
            const uri = decodeURIComponent(openedUri());
            expect(uri).toContain('/speckit-tasks');
            expect(uri).not.toContain('@.claude/');
        });
    });
});
