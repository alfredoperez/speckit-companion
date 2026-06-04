import * as vscode from 'vscode';
import * as fs from 'fs';
import { AIProviders } from '../core/constants';
import { waitForShellReady } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { dispatchSlashCommandViaTempFile, buildPromptDispatchCommand, AIExecutionResult } from './aiProvider';
import { CliTerminalProvider, DispatchContext, DispatchPlan } from './cliTerminalProvider';
import { detectShell, formatPromptFileSubstitution, Shell } from '../core/utils/shellDetection';
import { splitContextPreamble } from './promptBuilder';
import { getPermissionFlagForProvider } from './permissionValidation';

function buildSystemPromptFlag(shell: Shell, systemPromptFilePath: string | null): string {
    if (!systemPromptFilePath) return '';
    if (shell === 'cmd') {
        const content = fs.readFileSync(systemPromptFilePath, 'utf8').replace(/"/g, '""').trim();
        return `--append-system-prompt "${content}" `;
    }
    return `--append-system-prompt "${formatPromptFileSubstitution(shell, systemPromptFilePath)}" `;
}

/**
 * Claude Code provider.
 *
 * Two divergences from the default `CliTerminalProvider` dispatch:
 *
 *   1. The prompt may carry a speckit-companion context-update *preamble*
 *      (see `splitContextPreamble`). When present, it's hoisted out of the
 *      user message and passed to `claude --append-system-prompt <file>` so
 *      it doesn't pollute the terminal scrollback or confuse slash-command
 *      routing. That requires a second temp file alongside the user prompt.
 *   2. `executeSlashCommand` uses `dispatchSlashCommandViaTempFile` — Claude
 *      keeps the slash command on the command line and passes only the args
 *      via `$(cat <file>)`. The base class's generic flow would send the
 *      whole slash text as a prompt, which doesn't match how Claude resolves
 *      `/speckit-*` commands.
 *
 * Everything else (install check, terminal lifecycle, cleanup) is inherited.
 */
export class ClaudeCodeProvider extends CliTerminalProvider {
    public readonly name = 'Claude Code';
    public readonly type = AIProviders.CLAUDE;

    protected readonly cliBinary = 'claude';
    protected readonly cliPathSettingKey = null;
    // Claude is so commonly pre-installed that the install-hint path adds
    // noise — keep it null. (The base class skips the check when this is null.)
    protected readonly installHint = null;
    protected readonly defaultTerminalTitle = 'SpecKit - Claude Code';
    protected readonly headlessTerminalName = 'Claude Code Background';
    protected readonly logPrefix = 'ClaudeCodeProvider';

    protected async prepareDispatch(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): Promise<DispatchPlan> {
        const { preamble, command } = splitContextPreamble(ctx.prompt);
        const filePrefix = ctx.mode === 'headless' ? 'background-prompt' : 'prompt';
        const systemPrefix = ctx.mode === 'headless' ? 'background-system-prompt' : 'system-prompt';

        const promptFilePath = await createTempFile(this.context, command, filePrefix, true);
        const systemPromptFilePath = preamble
            ? await createTempFile(this.context, preamble, systemPrefix, true)
            : null;

        const permissionFlag = this.getPermissionFlag();
        const shell = detectShell();
        const commandLine = buildPromptDispatchCommand({
            cliInvocation: 'claude',
            flags: `${buildSystemPromptFlag(shell, systemPromptFilePath)}${permissionFlag}`,
            promptFilePath,
            promptText: command,
            shell,
        });

        const tempFiles = systemPromptFilePath ? [promptFilePath, systemPromptFilePath] : [promptFilePath];
        return { commandLine, tempFiles };
    }

    /**
     * Claude resolves `/speckit-*` slash commands itself when they sit on the
     * command line. The base class would otherwise treat the slash text as a
     * regular prompt body, which short-circuits Claude's command resolution.
     */
    async executeSlashCommand(
        command: string,
        title: string = 'SpecKit - Claude Code',
        autoExecute: boolean = true,
    ): Promise<vscode.Terminal> {
        try {
            const slashCommand = command.startsWith('/') ? command : `/${command}`;
            const firstSpace = slashCommand.indexOf(' ');
            const slashName = firstSpace === -1 ? slashCommand : slashCommand.slice(0, firstSpace);
            const args = firstSpace === -1 ? '' : slashCommand.slice(firstSpace + 1).trimStart();

            const permissionFlag = this.getPermissionFlag();
            const cliInvocation = `claude ${permissionFlag}`.trimEnd();

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: { viewColumn: vscode.ViewColumn.Two },
            });
            terminal.show();

            await dispatchSlashCommandViaTempFile({
                context: this.context,
                outputChannel: this.outputChannel,
                terminal,
                cliInvocation,
                slashCommand: slashName,
                promptText: args,
                autoExecute,
                logPrefix: 'Claude',
            });

            return terminal;
        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to execute slash command: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Claude Code: ${error}`);
            throw error;
        }
    }

    // Legacy method aliases for backwards compatibility
    async invokeClaudeSplitView(prompt: string, title?: string): Promise<vscode.Terminal> {
        return this.executeInTerminal(prompt, title);
    }
    async invokeClaudeHeadless(prompt: string): Promise<AIExecutionResult> {
        return this.executeHeadless(prompt);
    }

    /**
     * Rename a terminal. Kept here (rather than on the base) because no other
     * provider exposes a rename surface and the call is Claude-specific in
     * existing callers.
     */
    async renameTerminal(terminal: vscode.Terminal, newName: string): Promise<void> {
        terminal.show();
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.outputChannel.appendLine(`[ClaudeCodeProvider] ${terminal.name} Terminal renamed to: ${newName}`);
        await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', { name: newName });
    }

    /**
     * Open a one-shot permission-setup terminal. Static helper that
     * sidesteps the dispatch flow because there is no prompt — the user just
     * needs to see the Claude CLI's interactive permission prompt.
     */
    static async createPermissionTerminal(): Promise<vscode.Terminal> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const terminal = vscode.window.createTerminal({
            name: 'Claude Code - Permission Setup',
            cwd: workspaceFolder,
            location: { viewColumn: vscode.ViewColumn.Two },
        });
        terminal.show();
        await waitForShellReady(terminal);
        const permissionFlag = getPermissionFlagForProvider(AIProviders.CLAUDE);
        terminal.sendText(`claude ${permissionFlag}`.trim(), true);
        return terminal;
    }
}
