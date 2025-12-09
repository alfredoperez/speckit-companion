import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { ConfigKeys, Timing } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';

const execAsync = promisify(exec);

/**
 * Gemini CLI provider implementation
 * Supports gemini command for AI assistance
 */
export class GeminiCliProvider implements IAIProvider {
    public readonly name = 'Gemini CLI';

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
     * Check if Gemini CLI is installed
     */
    async isInstalled(): Promise<boolean> {
        try {
            await execAsync('gemini --version');
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
        return config.get<string>('geminiPath', 'gemini');
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
     * Execute a prompt in a visible terminal (split view)
     * Gemini CLI runs in interactive mode - we start it first, then send the prompt
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Gemini'): Promise<vscode.Terminal> {
        try {
            const cliPath = this.getCliPath();

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
            });

            terminal.show();

            const delay = this.configManager.getTerminalDelay();

            // Start Gemini in interactive mode
            setTimeout(() => {
                terminal.sendText(cliPath, true);
            }, delay);

            // After Gemini initializes, send the prompt then Enter separately
            setTimeout(() => {
                terminal.sendText(prompt, false);  // Send text without Enter
            }, delay + Timing.geminiInitDelay);

            // Send Enter after a small delay to submit the prompt
            setTimeout(() => {
                terminal.sendText('', true);  // Just send Enter
            }, delay + Timing.geminiInitDelay + 200);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`ERROR: Failed to send to Gemini CLI: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Gemini CLI: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a prompt in headless/background mode
     * Uses pipe to send prompt to Gemini CLI
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        this.outputChannel.appendLine(`[GeminiCliProvider] Invoking Gemini CLI in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;
        const cliPath = this.getCliPath();

        const promptFilePath = await this.createTempFile(prompt, 'background-prompt');
        // Use pipe to send prompt content to Gemini CLI
        const commandLine = `cat "${promptFilePath}" | ${cliPath}`;

        const terminal = vscode.window.createTerminal({
            name: 'Gemini CLI Background',
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
                                this.outputChannel.appendLine(`[GeminiCliProvider] Command failed with exit code: ${event.exitCode}`);
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
                    this.outputChannel.appendLine(`[GeminiCliProvider] Shell integration not available, using fallback mode`);
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
     * Gemini CLI supports slash commands in interactive mode
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Gemini'): Promise<vscode.Terminal> {
        // Ensure command starts with /
        const slashCommand = command.startsWith('/') ? command : `/${command}`;
        return this.executeInTerminal(slashCommand, title);
    }
}
