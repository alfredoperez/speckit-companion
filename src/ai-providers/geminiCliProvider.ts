import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
import { IAIProvider, AIExecutionResult } from './aiProvider';

const execAsync = promisify(exec);

/**
 * Gemini CLI provider implementation
 * Supports gemini command for AI assistance
 */
export class GeminiCliProvider implements IAIProvider {
    public readonly name = 'Gemini CLI';
    public readonly type = 'gemini' as const;

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
        return '';
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
     * Get the Gemini CLI initialization delay from settings
     */
    private getInitDelay(): number {
        const config = vscode.workspace.getConfiguration('speckit');
        return config.get<number>('geminiInitDelay', Timing.geminiInitDelay);
    }

    /**
     * Check if Gemini CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        await ensureCliInstalled(
            'Gemini CLI',
            'npm install -g @google/gemini-cli',
            'gemini --version',
            this.outputChannel
        );
    }

    /**
     * Execute a prompt in a visible terminal (split view)
     * Gemini CLI runs in interactive mode - we start it first, then send the prompt
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Gemini'): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();
            const cliPath = this.getCliPath();

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: {
                    viewColumn: vscode.ViewColumn.Two
                }
            });

            terminal.show();

            const initDelay = this.getInitDelay();

            // Wait for shell to be ready, then start Gemini in interactive mode
            await waitForShellReady(terminal);
            terminal.sendText(cliPath, true);

            // After Gemini initializes, send the prompt then Enter separately
            setTimeout(() => {
                terminal.sendText(prompt, false);  // Send text without Enter
            }, initDelay);

            // Send Enter after a small delay to submit the prompt
            setTimeout(() => {
                terminal.sendText('', true);  // Just send Enter
            }, initDelay + 200);

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
        await this.ensureInstalled();
        this.outputChannel.appendLine(`[GeminiCliProvider] Invoking Gemini CLI in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;
        const cliPath = this.getCliPath();

        const promptFilePath = await createTempFile(this.context, prompt, 'background-prompt', false);
        const commandLine = `cat "${promptFilePath}" | ${cliPath}`;

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Gemini CLI Background',
            outputChannel: this.outputChannel,
            logPrefix: 'GeminiCliProvider',
            tempFilePath: promptFilePath,
            logCommandOnFailure: false
        });
    }

    /**
     * Execute a slash command in terminal
     * Gemini CLI supports slash commands in interactive mode
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Gemini'): Promise<vscode.Terminal> {
        await this.ensureInstalled();
        // Ensure command starts with /
        const slashCommand = command.startsWith('/') ? command : `/${command}`;
        return this.executeInTerminal(slashCommand, title);
    }
}
