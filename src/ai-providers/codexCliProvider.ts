import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { AIProviders, Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { getPermissionFlagForProvider } from './permissionValidation';

const execAsync = promisify(exec);

export class CodexCliProvider implements IAIProvider {
    public readonly name = 'Codex CLI';
    public readonly type = AIProviders.CODEX;

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;

        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    getPermissionFlag(): string {
        return getPermissionFlagForProvider(this.type);
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
    private async createPromptFile(content: string, prefix: string = 'prompt'): Promise<string> {
        return createTempFile(this.context, content, prefix, true);
    }

    /**
     * Parse a slash command into skill name and arguments
     * Only parses the first line - refinement context may follow on subsequent lines
     */
    private parseSlashCommand(prompt: string): { skillName: string; args: string } | null {
        // Only look at the first line of the prompt
        const firstLine = prompt.split('\n')[0].trim();
        const match = firstLine.match(/^\/(speckit[.\-]\w+)\s*(.*)$/);
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
        // Prompt files use dot notation (speckit.specify.md), normalize dash format
        const normalized = skillName.replace(/^speckit-/, 'speckit.');
        const promptPath = path.join(workspaceFolder.uri.fsPath, '.codex', 'prompts', `${normalized}.md`);
        return fs.existsSync(promptPath) ? `.codex/prompts/${normalized}.md` : null;
    }

    /**
     * Check if Codex CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        await ensureCliInstalled(
            'Codex CLI',
            'npm install -g @openai/codex',
            'codex --version',
            this.outputChannel
        );
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
                tempFilePath = await this.createPromptFile(prompt, 'prompt');
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

            await waitForShellReady(terminal);
            terminal.sendText(command, true);

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
            const escapedArgs = this.escapeForSed(parsed.args);
            commandLine = `sed "s/\\$ARGUMENTS/${escapedArgs}/" "${promptFile}" | codex exec - `;
        } else {
            tempFilePath = await this.createPromptFile(prompt, 'background-prompt');
            commandLine = `codex exec - < "${tempFilePath}" `;
        }

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Codex CLI Background',
            outputChannel: this.outputChannel,
            logPrefix: 'Codex',
            tempFilePath: tempFilePath ?? undefined,
            logCommandOnFailure: true
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

            await waitForShellReady(terminal);
            terminal.sendText(terminalCommand, autoExecute);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`[Codex] ERROR: Failed to execute slash command: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Codex CLI: ${error}`);
            throw error;
        }
    }
}
