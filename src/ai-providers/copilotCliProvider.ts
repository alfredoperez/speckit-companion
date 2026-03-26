import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { CLIDefaults, ConfigKeys, Timing } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { NotificationUtils } from '../core/utils/notificationUtils';

const execAsync = promisify(exec);

/**
 * GitHub Copilot CLI provider implementation
 * Supports copilot (GitHub Copilot CLI) command
 */
export class CopilotCliProvider implements IAIProvider {
    public readonly name = 'GitHub Copilot CLI';

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;

        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ConfigKeys.namespace)) {
                this.configManager.loadSettings();
            }
        });
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

    /**
     * Get permission flag based on user setting
     * Returns --yolo flag or empty string for default mode
     */
    private getPermissionFlag(): string {
        const config = vscode.workspace.getConfiguration('speckit');
        const mode = config.get<string>('copilotPermissionMode', 'yolo');
        return mode === 'yolo' ? '--yolo ' : '';
    }

    /**
     * Create a temporary file with content
     */
    private async createTempFile(content: string, prefix: string = 'prompt'): Promise<string> {
        const tempDir = this.context.globalStorageUri.fsPath;
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);

        const tempFile = path.join(tempDir, `${prefix}-${Date.now()}.md`);
        await fs.promises.writeFile(tempFile, content);

        return tempFile;
    }

    /**
     * Check if Copilot CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        const installed = await this.isInstalled();
        if (!installed) {
            const action = await vscode.window.showErrorMessage(
                'GitHub Copilot CLI is not installed. Install it with: gh extension install github/gh-copilot',
                'Copy Install Command'
            );
            if (action === 'Copy Install Command') {
                await vscode.env.clipboard.writeText('gh extension install github/gh-copilot');
                NotificationUtils.showStatusBarMessage('$(check) Install command copied to clipboard');
            }
            throw new Error('GitHub Copilot CLI is not installed');
        }
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
            const promptFilePath = await this.createTempFile(cleanPrompt, 'prompt');
            const command = `${cliPath} ${permissionFlag}-p "$(cat "${promptFilePath}")"`;

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
            });

            terminal.show();

            const delay = this.configManager.getTerminalDelay();
            setTimeout(() => {
                terminal.sendText(command, true);
            }, delay);

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
        const promptFilePath = await this.createTempFile(cleanPrompt, 'background-prompt');
        const commandLine = `${cliPath} ${permissionFlag}-p "$(cat "${promptFilePath}")"`;

        const terminal = vscode.window.createTerminal({
            name: 'Copilot CLI Background',
            cwd,
            hideFromUser: true
        });

        return new Promise((resolve) => {
            let shellIntegrationChecks = 0;

            const checkShellIntegration = setInterval(() => {
                shellIntegrationChecks++;

                if (terminal.shellIntegration) {
                    clearInterval(checkShellIntegration);

                    const execution = terminal.shellIntegration.executeCommand(commandLine);

                    const disposable = vscode.window.onDidEndTerminalShellExecution(event => {
                        if (event.terminal === terminal && event.execution === execution) {
                            disposable.dispose();

                            if (event.exitCode !== 0) {
                                this.outputChannel.appendLine(`[CopilotCliProvider] Command failed with exit code: ${event.exitCode}`);
                            }

                            resolve({
                                exitCode: event.exitCode,
                                output: undefined
                            });

                            setTimeout(async () => {
                                terminal.dispose();
                                try {
                                    await fs.promises.unlink(promptFilePath);
                                } catch (e) {
                                    // Ignore cleanup errors
                                }
                            }, Timing.terminalDisposeDelay);
                        }
                    });
                } else if (shellIntegrationChecks > Timing.shellIntegrationMaxChecks) {
                    clearInterval(checkShellIntegration);
                    this.outputChannel.appendLine(`[CopilotCliProvider] Shell integration not available, using fallback mode`);
                    terminal.sendText(commandLine);

                    setTimeout(async () => {
                        resolve({ exitCode: undefined });
                        terminal.dispose();
                        try {
                            await fs.promises.unlink(promptFilePath);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    }, Timing.shellIntegrationFallbackTimeout);
                }
            }, Timing.shellIntegrationCheckInterval);
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
