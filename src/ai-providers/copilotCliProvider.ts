import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { AIProviders, CLIDefaults, Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
import { IAIProvider, AIExecutionResult, buildPromptDispatchCommand } from './aiProvider';
import { getPermissionFlagForProvider } from './permissionValidation';

const execAsync = promisify(exec);

/**
 * GitHub Copilot CLI provider implementation
 * Supports copilot (GitHub Copilot CLI) command
 */
export class CopilotCliProvider implements IAIProvider {
    public readonly name = 'GitHub Copilot CLI';
    public readonly type = AIProviders.COPILOT;

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
     * Check if GitHub Copilot CLI is installed
     * Checks for copilot command
     */
    async isInstalled(): Promise<boolean> {
        try {
            await execAsync(`${CLIDefaults.copilot} --version`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the CLI command path
     */
    private getCliPath(): string {
        const config = vscode.workspace.getConfiguration('speckit');
        return config.get<string>('copilotPath', CLIDefaults.copilot);
    }

    getPermissionFlag(): string {
        return getPermissionFlagForProvider(this.type);
    }

    /**
     * Check if Copilot CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        await ensureCliInstalled(
            'GitHub Copilot CLI',
            'gh extension install github/gh-copilot',
            `${CLIDefaults.copilot} --version`,
            this.outputChannel
        );
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Copilot'): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();
            const cliPath = this.getCliPath();
            const permissionFlag = this.getPermissionFlag();
            // Strip leading slash from prompt — Copilot doesn't use slash commands
            const cleanPrompt = prompt.startsWith('/') ? prompt.substring(1) : prompt;
            const promptFilePath = await createTempFile(this.context, cleanPrompt, 'prompt', false);
            const command = buildPromptDispatchCommand({
                cliInvocation: cliPath,
                flags: `${permissionFlag}-p `,
                promptFilePath,
                promptText: cleanPrompt,
            });

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
                    this.outputChannel.appendLine(`[CopilotCliProvider] Cleaned up prompt file: ${promptFilePath}`);
                } catch (e) {
                    this.outputChannel.appendLine(`[CopilotCliProvider] Failed to cleanup temp file: ${e}`);
                }
            }, Timing.tempFileCleanupDelay);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to send to Copilot CLI: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Copilot CLI: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a prompt in headless/background mode
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.ensureInstalled();
        // Strip leading slash from prompt — Copilot doesn't use slash commands
        const cleanPrompt = prompt.startsWith('/') ? prompt.substring(1) : prompt;
        this.outputChannel.appendLine(`[CopilotCliProvider] Invoking Copilot CLI in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(cleanPrompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;
        const cliPath = this.getCliPath();

        const permissionFlag = this.getPermissionFlag();
        const promptFilePath = await createTempFile(this.context, cleanPrompt, 'background-prompt', false);
        const commandLine = buildPromptDispatchCommand({
            cliInvocation: cliPath,
            flags: `${permissionFlag}-p `,
            promptFilePath,
            promptText: cleanPrompt,
        });

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Copilot CLI Background',
            outputChannel: this.outputChannel,
            logPrefix: 'CopilotCliProvider',
            tempFilePath: promptFilePath,
            logCommandOnFailure: false
        });
    }

    /**
     * Execute a slash command in terminal
     * Copilot CLI doesn't have slash commands, so we pass the command as a prompt
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Copilot'): Promise<vscode.Terminal> {
        await this.ensureInstalled();
        const prompt = command.startsWith('/') ? command.substring(1) : command;
        return this.executeInTerminal(prompt, title);
    }
}
