import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { AIProviders, Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
import { IAIProvider, AIExecutionResult, buildPromptDispatchCommand } from './aiProvider';
import { getPermissionFlagForProvider } from './permissionValidation';

export class OpenCodeProvider implements IAIProvider {
    public readonly name = 'OpenCode';
    public readonly type = AIProviders.OPENCODE;

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;

        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    async isInstalled(): Promise<boolean> {
        try {
            await promisify(exec)('opencode --version');
            return true;
        } catch {
            return false;
        }
    }

    private getCliPath(): string {
        const config = vscode.workspace.getConfiguration('speckit');
        return config.get<string>('opencodePath', 'opencode');
    }

    getPermissionFlag(): string {
        return getPermissionFlagForProvider(this.type);
    }

    private async ensureInstalled(): Promise<void> {
        await ensureCliInstalled(
            'OpenCode CLI',
            'npm install -g opencode-ai',
            'opencode --version',
            this.outputChannel
        );
    }

    async executeInTerminal(prompt: string, title: string = 'SpecKit - OpenCode'): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();
            const cliPath = this.getCliPath();
            const permissionFlag = this.getPermissionFlag();
            const tempFilePath = await createTempFile(this.context, prompt, 'prompt', true);
            const command = buildPromptDispatchCommand({
                cliInvocation: cliPath,
                flags: `${permissionFlag}-p `,
                promptFilePath: tempFilePath,
                promptText: prompt,
            });

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: { viewColumn: vscode.ViewColumn.Two }
            });

            terminal.show();
            await waitForShellReady(terminal);
            terminal.sendText(command, true);

            const fileToClean = tempFilePath;
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(fileToClean);
                    this.outputChannel.appendLine(`[OpenCode] Cleaned up prompt file: ${fileToClean}`);
                } catch (e) {
                    this.outputChannel.appendLine(`[OpenCode] Failed to cleanup temp file: ${e}`);
                }
            }, Timing.tempFileCleanupDelay);

            return terminal;
        } catch (error) {
            this.outputChannel.appendLine(`[OpenCode] ERROR: ${error}`);
            vscode.window.showErrorMessage(`Failed to run OpenCode CLI: ${error}`);
            throw error;
        }
    }

    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.ensureInstalled();

        this.outputChannel.appendLine(`[OpenCodeProvider] Invoking OpenCode CLI in headless mode`);
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(prompt);
        this.outputChannel.appendLine(`========================================`);

        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const cliPath = this.getCliPath();
        const permissionFlag = this.getPermissionFlag();
        const tempFilePath = await createTempFile(this.context, prompt, 'background-prompt', true);
        const commandLine = buildPromptDispatchCommand({
            cliInvocation: cliPath,
            flags: `${permissionFlag}-p `,
            promptFilePath: tempFilePath,
            promptText: prompt,
        });

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'OpenCode Background',
            outputChannel: this.outputChannel,
            logPrefix: 'OpenCode',
            tempFilePath,
            logCommandOnFailure: true
        });
    }

    async executeSlashCommand(command: string, title: string = 'SpecKit - OpenCode', _autoExecute: boolean = true): Promise<vscode.Terminal> {
        await this.ensureInstalled();
        const slashCommand = command.startsWith('/') ? command : `/${command}`;
        return this.executeInTerminal(slashCommand, title);
    }
}
