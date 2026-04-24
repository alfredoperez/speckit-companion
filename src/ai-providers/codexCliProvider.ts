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
import { readInitOptions } from './initOptions';
import { buildCodexExecCommand } from './codexCommandBuilder';

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
     * Create a temporary file with content. Normalizes CRLF → LF so that
     * downstream consumers (especially `codex exec -` on Windows) always
     * receive unix line endings regardless of the workspace's shell family.
     */
    private async createPromptFile(content: string, prefix: string = 'prompt'): Promise<string> {
        const normalized = content.replace(/\r\n/g, '\n');
        return createTempFile(this.context, normalized, prefix, true);
    }

    /**
     * Parse a slash command into skill name and arguments
     * Only parses the first line - refinement context may follow on subsequent lines
     */
    private parseSlashCommand(prompt: string): { skillName: string; args: string } | null {
        const firstLine = prompt.split('\n')[0].trim();
        const match = firstLine.match(/^\/(speckit[.\-]\w+)\s*(.*)$/);
        if (!match) return null;
        return { skillName: match[1], args: match[2]?.trim() || '' };
    }

    /**
     * Resolve a skill name to an absolute prompt file path under
     * `.codex/prompts/`, or `null` if no matching file exists.
     */
    private getPromptFileAbsolutePath(skillName: string): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;
        const normalized = skillName.replace(/^speckit-/, 'speckit.');
        const promptPath = path.join(workspaceFolder.uri.fsPath, '.codex', 'prompts', `${normalized}.md`);
        return fs.existsSync(promptPath) ? promptPath : null;
    }

    /**
     * Resolve the final prompt text that should be written to a temp file and
     * streamed into `codex exec`. For known SpecKit skills, read the prompt
     * file and substitute `$ARGUMENTS` in Node (no shell escaping hazards). For
     * other prompts, return `fallback` unchanged.
     */
    private resolvePromptText(rawPrompt: string, fallback: string): string {
        const parsed = this.parseSlashCommand(rawPrompt.trim());
        if (!parsed) return fallback;

        const promptFilePath = this.getPromptFileAbsolutePath(parsed.skillName);
        if (!promptFilePath) return fallback;

        try {
            const template = fs.readFileSync(promptFilePath, 'utf8');
            return template.replace(/\$ARGUMENTS/g, parsed.args);
        } catch (e) {
            this.outputChannel.appendLine(`[Codex] Failed to read skill prompt ${promptFilePath}: ${e}. Falling back.`);
            return fallback;
        }
    }

    /**
     * Schedule a temp-file cleanup after the standard delay.
     */
    private scheduleCleanup(tempFilePath: string): void {
        setTimeout(async () => {
            try {
                await fs.promises.unlink(tempFilePath);
                this.outputChannel.appendLine(`[Codex] Cleaned up prompt file: ${tempFilePath}`);
            } catch (e) {
                this.outputChannel.appendLine(`[Codex] Failed to cleanup temp file: ${e}`);
            }
        }, Timing.tempFileCleanupDelay);
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
     * Execute a prompt in a visible terminal (split view).
     * Always writes the resolved prompt to a temp file and streams it into
     * `codex exec -` via a shell-native pipe (no `<` redirection).
     */
    async executeInTerminal(prompt: string, title: string = 'SpecKit - Codex CLI'): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();

            const resolvedPrompt = this.resolvePromptText(prompt, prompt);
            const tempFilePath = await this.createPromptFile(resolvedPrompt, 'prompt');
            const { script } = readInitOptions(this.outputChannel);
            const command = buildCodexExecCommand({
                script,
                promptFilePath: tempFilePath,
                permissionFlag: this.getPermissionFlag(),
            });

            this.outputChannel.appendLine(`[codex] script=${script} (init-options)`);

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

            this.scheduleCleanup(tempFilePath);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`[Codex] ERROR: Failed to send to Codex CLI: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Codex CLI: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a prompt in headless/background mode.
     * Same pipeline as `executeInTerminal`: resolve → temp file → pipe.
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.ensureInstalled();

        this.outputChannel.appendLine(`[CodexCliProvider] Invoking Codex CLI in headless mode`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath;

        const resolvedPrompt = this.resolvePromptText(prompt, prompt);
        const tempFilePath = await this.createPromptFile(resolvedPrompt, 'background-prompt');
        const { script } = readInitOptions(this.outputChannel);
        const commandLine = buildCodexExecCommand({
            script,
            promptFilePath: tempFilePath,
            permissionFlag: this.getPermissionFlag(),
        });

        this.outputChannel.appendLine(`[codex] script=${script} (init-options)`);

        return executeCommandInHiddenTerminal({
            commandLine,
            cwd,
            terminalName: 'Codex CLI Background',
            outputChannel: this.outputChannel,
            logPrefix: 'Codex',
            tempFilePath,
            logCommandOnFailure: true
        });
    }

    /**
     * Execute a slash command in terminal.
     * Known SpecKit skills resolve their prompt file in Node; other commands
     * fall back to a short instructional wrapper. Either way the final text
     * is written to a temp file and streamed via `buildCodexExecCommand`.
     *
     * @param command - The slash command to execute (e.g., "/speckit.specify specs/012-feature")
     * @param title - Terminal title
     * @param autoExecute - If false, shows command but waits for user to press Enter (default: true)
     */
    async executeSlashCommand(command: string, title: string = 'SpecKit - Codex CLI', autoExecute: boolean = true): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();

            const slashCommand = command.startsWith('/') ? command : `/${command}`;
            const fallback = `Run the following SpecKit command: ${slashCommand}`;
            const resolvedPrompt = this.resolvePromptText(slashCommand, fallback);

            const tempFilePath = await this.createPromptFile(resolvedPrompt, 'slash-prompt');
            const { script } = readInitOptions(this.outputChannel);
            const terminalCommand = buildCodexExecCommand({
                script,
                promptFilePath: tempFilePath,
                permissionFlag: this.getPermissionFlag(),
            });

            this.outputChannel.appendLine(`[codex] script=${script} (init-options)`);

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

            this.scheduleCleanup(tempFilePath);

            return terminal;

        } catch (error) {
            this.outputChannel.appendLine(`[Codex] ERROR: Failed to execute slash command: ${error}`);
            vscode.window.showErrorMessage(`Failed to run Codex CLI: ${error}`);
            throw error;
        }
    }
}
