import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { ConfigKeys, Timing } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';

const execAsync = promisify(exec);

export class QwenCliProvider implements IAIProvider {
    public readonly name = 'Qwen Code';

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
     * Check if Qwen Code CLI is installed
     */
    async isInstalled(): Promise<boolean> {
        try {
            await execAsync('qwen --version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the CLI command path from settings
     */
    private getCliPath(): string {
        const config = vscode.workspace.getConfiguration('speckit');
        return config.get<string>('qwenPath', 'qwen');
    }

    /**
     * Get whether YOLO mode (--yolo) is enabled
     */
    private getYoloMode(): boolean {
        const config = vscode.workspace.getConfiguration('speckit');
        return config.get<boolean>('qwenYoloMode', false);
    }

    /**
     * Create a temporary file with content
     */
    private async createTempFile(content: string, prefix: string = 'prompt'): Promise<string> {
        const tempDir = this.context.globalStorageUri.fsPath;
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);

        const tempFile = path.join(tempDir, `${prefix}-${Date.now()}.md`);
        await fs.promises.writeFile(tempFile, content);

        return this.convertPathIfWSL(tempFile);
    }

    /**
     * Convert Windows path to WSL path if needed
     */
    private convertPathIfWSL(filePath: string): string {
        if (process.platform === 'win32' && filePath.match(/^[A-Za-z]:\\/)) {
            let wslPath = filePath.replace(/\\/g, '/');
            wslPath = wslPath.replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`);
            return wslPath;
        }
        return filePath;
    }

    /**
     * Check if Qwen Code CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        const installed = await this.isInstalled();
        if (!installed) {
            const action = await vscode.window.showErrorMessage(
                'Qwen Code CLI is not installed. Install it with: npm install -g @qwen-code/qwen-code@latest',
                'Copy Install Command'
            );
            if (action === 'Copy Install Command') {
                await vscode.env.clipboard.writeText('npm install -g @qwen-code/qwen-code@latest');
                vscode.window.showInformationMessage('Install command copied to clipboard');
            }
            throw new Error('Qwen Code CLI is not installed');
        }
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     * Uses qwen -p "$(cat <tempFile>)" to pass the prompt
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Qwen Code'): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();
            const cliPath = this.getCliPath();
            const yoloFlag = this.getYoloMode() ? ' --yolo' : '';

            const tempFilePath = await this.createTempFile(prompt, 'prompt');
            const command = `${cliPath}${yoloFlag} -p "$(cat "${tempFilePath}")"`;

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
            const fileToClean = tempFilePath;
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(fileToClean);
                    this.outputChannel.appendLine(`[Qwen] Cleaned up prompt file: ${fileToClean}`);
                } catch (e) {
                    this.outputChannel.appendLine(`[Qwen] Failed to cleanup temp file: ${e}`);
                }
            }, Timing.tempFileCleanupDelay);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`[Qwen] ERROR: Failed to send to Qwen Code CLI: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Qwen Code CLI: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a prompt in headless/background mode
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.ensureInstalled();

        this.outputChannel.appendLine(`[QwenCliProvider] Invoking Qwen Code CLI in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;
        const cliPath = this.getCliPath();
        const yoloFlag = this.getYoloMode() ? ' --yolo' : '';

        const tempFilePath = await this.createTempFile(prompt, 'background-prompt');
        const commandLine = `${cliPath}${yoloFlag} -p "$(cat "${tempFilePath}")"`;

        const terminal = vscode.window.createTerminal({
            name: 'Qwen Code Background',
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
                                this.outputChannel.appendLine(`[Qwen] Command failed with exit code: ${event.exitCode}`);
                                this.outputChannel.appendLine(`[Qwen] Command was: ${commandLine}`);
                            }

                            resolve({
                                exitCode: event.exitCode,
                                output: undefined
                            });

                            setTimeout(async () => {
                                terminal.dispose();
                                try {
                                    await fs.promises.unlink(tempFilePath);
                                    this.outputChannel.appendLine(`[Qwen] Cleaned up temp file: ${tempFilePath}`);
                                } catch (e) {
                                    this.outputChannel.appendLine(`[Qwen] Failed to cleanup temp file: ${e}`);
                                }
                            }, Timing.terminalDisposeDelay);
                        }
                    });
                } else if (shellIntegrationChecks > Timing.shellIntegrationMaxChecks) {
                    clearInterval(checkShellIntegration);
                    this.outputChannel.appendLine(`[Qwen] Shell integration not available, using fallback mode`);
                    terminal.sendText(commandLine);

                    setTimeout(async () => {
                        resolve({ exitCode: undefined });
                        terminal.dispose();
                        try {
                            await fs.promises.unlink(tempFilePath);
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
     * Delegates to executeInTerminal with the slash command as prompt
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Qwen Code', autoExecute: boolean = true): Promise<vscode.Terminal> {
        await this.ensureInstalled();
        const slashCommand = command.startsWith('/') ? command : `/${command}`;
        return this.executeInTerminal(slashCommand, title);
    }
}
