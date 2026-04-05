import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { IAIProvider, AIExecutionResult, readPermissionMode } from './aiProvider';

const execAsync = promisify(exec);

export class ClaudeCodeProvider implements IAIProvider {
    public readonly name = 'Claude Code';
    public readonly type = 'claude' as const;

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
        return readPermissionMode() === 'auto-approve' ? '--permission-mode bypassPermissions ' : '';
    }

    /**
     * Create a temporary file with content
     */
    private async createPromptFile(content: string, prefix: string = 'prompt'): Promise<string> {
        return createTempFile(this.context, content, prefix, true);
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Claude Code'): Promise<vscode.Terminal> {
        try {

            const promptFilePath = await this.createPromptFile(prompt, 'prompt');
            const permissionFlag = this.getPermissionFlag();
            const command = `claude ${permissionFlag}"$(cat "${promptFilePath}")"`;

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

            // Clean up temp file after delay
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(promptFilePath);
                    this.outputChannel.appendLine(`Cleaned up prompt file: ${promptFilePath}`);
                } catch (e) {
                    this.outputChannel.appendLine(`Failed to cleanup temp file: ${e}`);
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

        const promptFilePath = await this.createPromptFile(prompt, 'background-prompt');
        const permissionFlag = this.getPermissionFlag();
        const commandLine = `claude ${permissionFlag}"$(cat "${promptFilePath}")"`;

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Claude Code Background',
            outputChannel: this.outputChannel,
            logPrefix: 'Claude',
            tempFilePath: promptFilePath,
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

            // Ensure command starts with /
            const slashCommand = command.startsWith('/') ? command : `/${command}`;
            const permissionFlag = this.getPermissionFlag();
            const fullCommand = `claude ${permissionFlag}"${slashCommand}"`;

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
            });

            terminal.show();

            await waitForShellReady(terminal);
            terminal.sendText(fullCommand, autoExecute);

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
        const permissionFlag = readPermissionMode() === 'auto-approve' ? '--permission-mode bypassPermissions ' : '';
        terminal.sendText(
            `claude ${permissionFlag}`.trim(),
            true
        );

        return terminal;
    }
}
