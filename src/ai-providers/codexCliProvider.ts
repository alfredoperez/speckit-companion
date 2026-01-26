import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { ConfigKeys, Timing } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';

const execAsync = promisify(exec);

export class CodexCliProvider implements IAIProvider {
    public readonly name = 'Codex CLI';

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
     * Check if Codex CLI is installed
     */
    async isInstalled(): Promise<boolean> {
        try {
            await execAsync('codex --version');
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
     * Parse a slash command into skill name and arguments
     * Only parses the first line - refinement context may follow on subsequent lines
     */
    private parseSlashCommand(prompt: string): { skillName: string; args: string } | null {
        // Only look at the first line of the prompt
        const firstLine = prompt.split('\n')[0].trim();
        const match = firstLine.match(/^\/(speckit\.\w+)\s*(.*)$/);
        if (!match) return null;
        return { skillName: match[1], args: match[2]?.trim() || '' };
    }

    /**
     * Escape a string for safe use in sed substitution
     */
    private escapeForSed(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/\//g, '\\/')
            .replace(/&/g, '\\&')
            .replace(/'/g, "'\\''");
    }

    /**
     * Get the relative path to a prompt file if it exists
     */
    private getPromptFilePath(skillName: string): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;
        const promptPath = path.join(workspaceFolder.uri.fsPath, '.codex', 'prompts', `${skillName}.md`);
        return fs.existsSync(promptPath) ? `.codex/prompts/${skillName}.md` : null;
    }

    /**
     * Check if Codex CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        const installed = await this.isInstalled();
        if (!installed) {
            const action = await vscode.window.showErrorMessage(
                'Codex CLI is not installed. Install it with: npm install -g @openai/codex',
                'Copy Install Command'
            );
            if (action === 'Copy Install Command') {
                await vscode.env.clipboard.writeText('npm install -g @openai/codex');
                vscode.window.showInformationMessage('Install command copied to clipboard');
            }
            throw new Error('Codex CLI is not installed');
        }
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     * Uses sed + pipe for known SpecKit skills, falls back to temp file for custom prompts
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Codex CLI'): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();

            let command: string;
            let tempFilePath: string | null = null;

            const parsed = this.parseSlashCommand(prompt.trim());
            const promptFile = parsed ? this.getPromptFilePath(parsed.skillName) : null;

            this.outputChannel.appendLine(`[Codex] Prompt: "${prompt.substring(0, 100)}..."`);
            this.outputChannel.appendLine(`[Codex] Parsed: ${JSON.stringify(parsed)}`);
            this.outputChannel.appendLine(`[Codex] Prompt file: ${promptFile}`);

            if (parsed && promptFile) {
                // Use sed + pipe for known SpecKit skills
                const escapedArgs = this.escapeForSed(parsed.args);
                command = `sed "s/\\$ARGUMENTS/${escapedArgs}/" "${promptFile}" | codex exec - `;
            } else {
                // Fallback: write temp file for custom prompts
                tempFilePath = await this.createTempFile(prompt, 'prompt');
                command = `codex exec - < "${tempFilePath}" `;
            }

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

            // Clean up temp file after delay (only if we created one)
            if (tempFilePath) {
                const fileToClean = tempFilePath;
                setTimeout(async () => {
                    try {
                        await fs.promises.unlink(fileToClean);
                        this.outputChannel.appendLine(`[Codex] Cleaned up prompt file: ${fileToClean}`);
                    } catch (e) {
                        this.outputChannel.appendLine(`[Codex] Failed to cleanup temp file: ${e}`);
                    }
                }, Timing.tempFileCleanupDelay);
            }

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`[Codex] ERROR: Failed to send to Codex CLI: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Codex CLI: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a prompt in headless/background mode
     * Uses sed + pipe for known SpecKit skills, falls back to temp file for custom prompts
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.ensureInstalled();

        this.outputChannel.appendLine(`[CodexCliProvider] Invoking Codex CLI in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;

        let commandLine: string;
        let tempFilePath: string | null = null;

        const parsed = this.parseSlashCommand(prompt);
        const promptFile = parsed ? this.getPromptFilePath(parsed.skillName) : null;

        if (parsed && promptFile) {
            // Use sed + pipe for known SpecKit skills
            const escapedArgs = this.escapeForSed(parsed.args);
            commandLine = `sed "s/\\$ARGUMENTS/${escapedArgs}/" "${promptFile}" | codex exec - `;
        } else {
            // Fallback: write temp file for custom prompts
            tempFilePath = await this.createTempFile(prompt, 'background-prompt');
            commandLine = `codex exec - < "${tempFilePath}" `;
        }

        const terminal = vscode.window.createTerminal({
            name: 'Codex CLI Background',
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
                                this.outputChannel.appendLine(`[Codex] Command failed with exit code: ${event.exitCode}`);
                                this.outputChannel.appendLine(`[Codex] Command was: ${commandLine}`);
                            }

                            resolve({
                                exitCode: event.exitCode,
                                output: undefined
                            });

                            setTimeout(async () => {
                                terminal.dispose();
                                if (tempFilePath) {
                                    try {
                                        await fs.promises.unlink(tempFilePath);
                                        this.outputChannel.appendLine(`[Codex] Cleaned up temp file: ${tempFilePath}`);
                                    } catch (e) {
                                        this.outputChannel.appendLine(`[Codex] Failed to cleanup temp file: ${e}`);
                                    }
                                }
                            }, Timing.terminalDisposeDelay);
                        }
                    });
                } else if (shellIntegrationChecks > Timing.shellIntegrationMaxChecks) {
                    clearInterval(checkShellIntegration);
                    this.outputChannel.appendLine(`[Codex] Shell integration not available, using fallback mode`);
                    terminal.sendText(commandLine);

                    setTimeout(async () => {
                        resolve({ exitCode: undefined });
                        terminal.dispose();
                        if (tempFilePath) {
                            try {
                                await fs.promises.unlink(tempFilePath);
                            } catch (e) {
                                // Ignore cleanup errors
                            }
                        }
                    }, Timing.shellIntegrationFallbackTimeout);
                }
            }, Timing.shellIntegrationCheckInterval);
        });
    }

    /**
     * Execute a slash command in terminal
     * Uses sed + pipe for known SpecKit skills, falls back to echo wrapper for other commands
     * @param command - The slash command to execute (e.g., "/speckit.specify specs/012-feature")
     * @param title - Terminal title
     * @param autoExecute - If false, shows command but waits for user to press Enter (default: true)
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Codex CLI', autoExecute: boolean = true): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();

            // Ensure command starts with /
            const slashCommand = command.startsWith('/') ? command : `/${command}`;

            let terminalCommand: string;
            const parsed = this.parseSlashCommand(slashCommand);
            const promptFile = parsed ? this.getPromptFilePath(parsed.skillName) : null;

            if (parsed && promptFile) {
                // Use sed + pipe for known SpecKit skills
                const escapedArgs = this.escapeForSed(parsed.args);
                terminalCommand = `sed "s/\\$ARGUMENTS/${escapedArgs}/" "${promptFile}" | codex exec - `;
            } else {
                // Fallback: wrap as instruction prompt for unknown commands
                terminalCommand = `echo "Run the following SpecKit command: ${slashCommand}" | codex exec - `;
            }

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
                // autoExecute=false: show command but don't press Enter (user can add more input)
                terminal.sendText(terminalCommand, autoExecute);
            }, delay);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`[Codex] ERROR: Failed to execute slash command: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Codex CLI: ${error}`);
            throw error;
        }
    }
}
