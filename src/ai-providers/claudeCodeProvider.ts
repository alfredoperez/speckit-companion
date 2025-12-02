import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { ConfigKeys, Timing } from '../core/constants';
import { getPermissionManager } from '../extension';
import { IAIProvider, AIExecutionResult } from './aiProvider';

const execAsync = promisify(exec);

export class ClaudeCodeProvider implements IAIProvider {
    public readonly name = 'Claude Code';

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;

        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ConfigKeys.namespace)) {
                this.configManager.loadSettings();
            }
        });
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
     * Check permissions before executing
     */
    private async ensurePermissions(): Promise<void> {
        const permissionManager = getPermissionManager();
        if (permissionManager) {
            const hasPermission = await permissionManager.checkPermission();
            if (!hasPermission) {
                this.outputChannel.appendLine('[ClaudeCodeProvider] No permission, showing setup');
                const granted = await permissionManager.showPermissionSetup();
                if (!granted) {
                    throw new Error('Claude Code permissions not granted');
                }
            }
        }
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Claude Code'): Promise<vscode.Terminal> {
        try {
            await this.ensurePermissions();

            const promptFilePath = await this.createTempFile(prompt, 'prompt');
            const command = `claude --permission-mode bypassPermissions "$(cat "${promptFilePath}")"`;

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
        await this.ensurePermissions();

        this.outputChannel.appendLine(`[ClaudeCodeProvider] Invoking Claude Code in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;

        const promptFilePath = await this.createTempFile(prompt, 'background-prompt');
        const commandLine = `claude --permission-mode bypassPermissions "$(cat "${promptFilePath}")"`;

        const terminal = vscode.window.createTerminal({
            name: 'Claude Code Background',
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
                                this.outputChannel.appendLine(`[Claude] Command failed with exit code: ${event.exitCode}`);
                                this.outputChannel.appendLine(`[Claude] Command was: ${commandLine}`);
                            }

                            resolve({
                                exitCode: event.exitCode,
                                output: undefined
                            });

                            setTimeout(async () => {
                                terminal.dispose();
                                try {
                                    await fs.promises.unlink(promptFilePath);
                                    this.outputChannel.appendLine(`[Claude] Cleaned up temp file: ${promptFilePath}`);
                                } catch (e) {
                                    this.outputChannel.appendLine(`[Claude] Failed to cleanup temp file: ${e}`);
                                }
                            }, Timing.terminalDisposeDelay);
                        }
                    });
                } else if (shellIntegrationChecks > Timing.shellIntegrationMaxChecks) {
                    clearInterval(checkShellIntegration);
                    this.outputChannel.appendLine(`[Claude] Shell integration not available, using fallback mode`);
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
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Claude Code'): Promise<vscode.Terminal> {
        try {
            await this.ensurePermissions();

            // Ensure command starts with /
            const slashCommand = command.startsWith('/') ? command : `/${command}`;
            const fullCommand = `claude --permission-mode bypassPermissions "${slashCommand}"`;

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
                terminal.sendText(fullCommand, true);
            }, delay);

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
    static createPermissionTerminal(): vscode.Terminal {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const terminal = vscode.window.createTerminal({
            name: 'Claude Code - Permission Setup',
            cwd: workspaceFolder,
            location: { viewColumn: vscode.ViewColumn.Two }
        });

        terminal.show();
        terminal.sendText(
            'claude --permission-mode bypassPermissions',
            true
        );

        return terminal;
    }
}
