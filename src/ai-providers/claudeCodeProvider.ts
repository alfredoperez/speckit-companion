import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { AIProviders, Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { IAIProvider, AIExecutionResult, dispatchSlashCommandViaTempFile } from './aiProvider';
import { getPermissionFlagForProvider } from './permissionValidation';

const execAsync = promisify(exec);

export class ClaudeCodeProvider implements IAIProvider {
    public readonly name = 'Claude Code';
    public readonly type = AIProviders.CLAUDE;

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;

        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    /**
     * Check if Claude Code CLI is installed
     */
    async isInstalled(): Promise<boolean> {
        try {
            await execAsync('claude --version');
            return true;
        } catch {
            return false;
        }
    }

    getPermissionFlag(): string {
        return getPermissionFlagForProvider(this.type);
    }

    /**
     * Create a temporary file with content
     */
    private async createPromptFile(content: string, prefix: string = 'prompt'): Promise<string> {
        return createTempFile(this.context, content, prefix, true);
    }

    /**
     * Split a prompt that contains the speckit-companion context-update preamble
     * into a system-level preamble (passed via --append-system-prompt) and a
     * clean user message (typically just a slash command). Keeping the preamble
     * out of the user message lets Claude CLI route slash commands correctly
     * and keeps the terminal view focused on what the user actually invoked.
     */
    private splitPreambleFromPrompt(prompt: string): { systemPrompt: string | null; userPrompt: string } {
        const MARKER_CLOSE = '<!-- /speckit-companion:context-update -->';
        const idx = prompt.indexOf(MARKER_CLOSE);
        if (idx === -1) {
            return { systemPrompt: null, userPrompt: prompt };
        }
        const end = idx + MARKER_CLOSE.length;
        return {
            systemPrompt: prompt.slice(0, end).trim(),
            userPrompt: prompt.slice(end).trim(),
        };
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Claude Code'): Promise<vscode.Terminal> {
        try {
            const { systemPrompt, userPrompt } = this.splitPreambleFromPrompt(prompt);

            const promptFilePath = await this.createPromptFile(userPrompt, 'prompt');
            const systemPromptFilePath = systemPrompt
                ? await this.createPromptFile(systemPrompt, 'system-prompt')
                : null;

            const permissionFlag = this.getPermissionFlag();
            const systemPromptFlag = systemPromptFilePath
                ? `--append-system-prompt "$(cat "${systemPromptFilePath}")" `
                : '';
            const command = `claude ${systemPromptFlag}${permissionFlag}"$(cat "${promptFilePath}")"`;

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
            });

            terminal.show();

            await waitForShellReady(terminal);
            terminal.sendText(command, true);

            // Clean up temp files after delay
            setTimeout(async () => {
                for (const path of [promptFilePath, systemPromptFilePath]) {
                    if (!path) continue;
                    try {
                        await fs.promises.unlink(path);
                        this.outputChannel.appendLine(`Cleaned up prompt file: ${path}`);
                    } catch (e) {
                        this.outputChannel.appendLine(`Failed to cleanup temp file: ${e}`);
                    }
                }
            }, Timing.tempFileCleanupDelay);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to send to Claude Code: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Claude Code: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a prompt in headless/background mode
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        this.outputChannel.appendLine(`[ClaudeCodeProvider] Invoking Claude Code in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;

        const { systemPrompt, userPrompt } = this.splitPreambleFromPrompt(prompt);

        const promptFilePath = await this.createPromptFile(userPrompt, 'background-prompt');
        const systemPromptFilePath = systemPrompt
            ? await this.createPromptFile(systemPrompt, 'background-system-prompt')
            : null;

        const permissionFlag = this.getPermissionFlag();
        const systemPromptFlag = systemPromptFilePath
            ? `--append-system-prompt "$(cat "${systemPromptFilePath}")" `
            : '';
        const commandLine = `claude ${systemPromptFlag}${permissionFlag}"$(cat "${promptFilePath}")"`;

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Claude Code Background',
            outputChannel: this.outputChannel,
            logPrefix: 'Claude',
            tempFilePath: promptFilePath,
            cleanupFn: systemPromptFilePath
                ? async () => {
                    try {
                        await fs.promises.unlink(systemPromptFilePath);
                        this.outputChannel.appendLine(`Cleaned up system prompt file: ${systemPromptFilePath}`);
                    } catch (e) {
                        this.outputChannel.appendLine(`Failed to cleanup system prompt file: ${e}`);
                    }
                }
                : undefined,
            logCommandOnFailure: true
        });
    }

    /**
     * Execute a slash command in terminal
     * @param command - The slash command to execute
     * @param title - Terminal title
     * @param autoExecute - If false, shows command but waits for user to press Enter (default: true)
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Claude Code', autoExecute: boolean = true): Promise<vscode.Terminal> {
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
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
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
     * Rename a terminal
     */
    async renameTerminal(terminal: vscode.Terminal, newName: string): Promise<void> {
        terminal.show();
        await new Promise(resolve => setTimeout(resolve, 100));
        this.outputChannel.appendLine(`[ClaudeCodeProvider] ${terminal.name} Terminal renamed to: ${newName}`);
        await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', {
            name: newName
        });
    }

    /**
     * Create permission setup terminal
     */
    static async createPermissionTerminal(): Promise<vscode.Terminal> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const terminal = vscode.window.createTerminal({
            name: 'Claude Code - Permission Setup',
            cwd: workspaceFolder,
            location: { viewColumn: vscode.ViewColumn.Two }
        });

        terminal.show();
        await waitForShellReady(terminal);
        const permissionFlag = getPermissionFlagForProvider(AIProviders.CLAUDE);
        terminal.sendText(
            `claude ${permissionFlag}`.trim(),
            true
        );

        return terminal;
    }
}
