import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
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
     * Check if Qwen Code CLI is installed and show helpful error if not
     */
    private async ensureInstalled(): Promise<void> {
        await ensureCliInstalled(
            'Qwen Code CLI',
            'npm install -g @qwen-code/qwen-code@latest',
            'qwen --version',
            this.outputChannel
        );
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

            const tempFilePath = await createTempFile(this.context, prompt, 'prompt', true);
            const command = `${cliPath}${yoloFlag} -p "$(cat "${tempFilePath}")"`;

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

        const tempFilePath = await createTempFile(this.context, prompt, 'background-prompt', true);
        const commandLine = `${cliPath}${yoloFlag} -p "$(cat "${tempFilePath}")"`;

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Qwen Code Background',
            outputChannel: this.outputChannel,
            logPrefix: 'Qwen',
            tempFilePath,
            logCommandOnFailure: true
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
