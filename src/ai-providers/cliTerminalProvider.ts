import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigManager } from '../core/utils/configManager';
import { AIProviderType, AIExecutionResult, IAIProvider, buildPromptDispatchCommand } from './aiProvider';
import { Timing } from '../core/constants';
import { waitForShellReady, executeCommandInHiddenTerminal } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
import { getPermissionFlagForProvider } from './permissionValidation';

const execAsync = promisify(exec);

/**
 * The dispatch unit a concrete provider produces for the base class to run.
 *
 * `commandLine` is the exact text that will be sent to the terminal (or to
 * `executeCommandInHiddenTerminal` in headless mode). `tempFiles` are the
 * paths the base class will unlink after `Timing.tempFileCleanupDelay`.
 */
export interface DispatchPlan {
    commandLine: string;
    tempFiles: string[];
}

/**
 * Modes the base class can run a dispatch in.
 *
 * `terminal` — visible split-view terminal, command sent with autoExecute=true.
 * `slash` — same as `terminal` but `autoExecute` is honoured (so callers can
 *           show the command without pressing Enter).
 * `headless` — background terminal, captured exit code; uses the
 *              `background-prompt` temp-file prefix.
 */
export type DispatchMode = 'terminal' | 'slash' | 'headless';

export interface DispatchContext {
    mode: DispatchMode;
    /** Raw prompt as received by the public method. */
    prompt: string;
    /** Original `command` arg when called via `executeSlashCommand` (else null). */
    slashCommand: string | null;
    /** Resolved CLI path (config override or default). */
    cliPath: string;
    /** Cached permission flag string for this dispatch. */
    permissionFlag: string;
}

/**
 * Shared workflow for terminal-CLI AI providers.
 *
 * Owns the per-dispatch dance every CLI provider was independently
 * reimplementing — `ensureInstalled` → write temp file(s) → build the shell
 * line → create terminal → `waitForShellReady` → `sendText` → schedule
 * cleanup. Concrete providers only have to supply (1) static identity
 * (name, cli binary, install hint, log prefix) and (2) a `prepareDispatch`
 * hook that returns the exact `commandLine` + the temp files to clean up.
 *
 * This is intentionally narrow: it does not cover Gemini's "start
 * interactively, then sendText the prompt separately" pattern. Gemini stays
 * outside this hierarchy because forcing it through would require enough
 * hooks to defeat the abstraction.
 */
export abstract class CliTerminalProvider implements IAIProvider {
    public abstract readonly name: string;
    public abstract readonly type: AIProviderType;

    /** The bare CLI binary name used for install verification and dispatch. */
    protected abstract readonly cliBinary: string;
    /** `displayName` shown when the CLI isn't found, plus the install command to suggest. `null` skips the install check entirely. */
    protected abstract readonly installHint: { displayName: string; installCommand: string } | null;
    /** Default title for the visible terminal. */
    protected abstract readonly defaultTerminalTitle: string;
    /** Terminal name for the hidden background terminal in headless mode. */
    protected abstract readonly headlessTerminalName: string;
    /** Short log tag, e.g. `"Qwen"`, `"Copilot"`. */
    protected abstract readonly logPrefix: string;

    protected readonly context: vscode.ExtensionContext;
    protected readonly outputChannel: vscode.OutputChannel;
    protected readonly configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    // ─── IAIProvider surface ────────────────────────────────────────────────

    async isInstalled(): Promise<boolean> {
        try {
            await execAsync(`${this.cliBinary} --version`);
            return true;
        } catch {
            return false;
        }
    }

    getPermissionFlag(): string {
        return getPermissionFlagForProvider(this.type);
    }

    async executeInTerminal(prompt: string, title?: string): Promise<vscode.Terminal> {
        return this.runVisible({ mode: 'terminal', prompt, slashCommand: null }, title ?? this.defaultTerminalTitle, true);
    }

    async executeSlashCommand(command: string, title?: string, autoExecute: boolean = true): Promise<vscode.Terminal> {
        const slashCommand = command.startsWith('/') ? command : `/${command}`;
        return this.runVisible(
            { mode: 'slash', prompt: slashCommand, slashCommand },
            title ?? this.defaultTerminalTitle,
            autoExecute,
        );
    }

    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        return this.runHeadless({ mode: 'headless', prompt, slashCommand: null });
    }

    // ─── Hooks for subclasses ───────────────────────────────────────────────

    /**
     * Build the command line and collect the temp files that need cleanup.
     *
     * The default implementation handles the "direct prompt-file dispatch"
     * pattern (Copilot, Qwen, OpenCode): write `ctx.prompt` to a temp file
     * and invoke `<cli> <flags>"$(cat <tempFile>)"`. Subclasses with more
     * complex needs (Claude's system prompt, Codex's skill template) override
     * this entirely.
     */
    protected async prepareDispatch(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): Promise<DispatchPlan> {
        const cliPath = this.cliBinary;
        const permissionFlag = this.getPermissionFlag();
        const promptText = this.preprocessPrompt(ctx);
        const filePrefix = ctx.mode === 'headless' ? 'background-prompt' : 'prompt';
        const tempFilePath = await createTempFile(this.context, promptText, filePrefix, this.convertTempFilePathForWSL);

        const commandLine = buildPromptDispatchCommand({
            cliInvocation: cliPath,
            flags: `${permissionFlag}${this.cliPromptFlag()}`,
            promptFilePath: tempFilePath,
            promptText,
        });

        return { commandLine, tempFiles: [tempFilePath] };
    }

    /**
     * Whether to convert the temp prompt-file path to WSL form before handing
     * it to the CLI. Defaults to `true` — the right behavior for CLIs invoked
     * via WSL (most of them). Override to `false` for CLIs that run natively
     * on Windows (notably the `gh copilot` extension) where WSL-style paths
     * like `/mnt/c/…` are unreadable.
     */
    protected readonly convertTempFilePathForWSL: boolean = true;

    /**
     * Override to transform the prompt before it hits the temp file. Default
     * is identity; Copilot uses this to strip the leading `/`.
     */
    protected preprocessPrompt(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): string {
        return ctx.prompt;
    }

    /**
     * The prompt-input flag inserted between permissionFlag and the
     * `"$(cat …)"` substitution. Default is `-p ` which fits Copilot, Qwen,
     * OpenCode. Override to return `` if the CLI takes the prompt positionally.
     */
    protected cliPromptFlag(): string {
        return '-p ';
    }

    // ─── Shared workflow ────────────────────────────────────────────────────

    private async ensureInstalled(): Promise<void> {
        if (!this.installHint) return;
        await ensureCliInstalled(
            this.installHint.displayName,
            this.installHint.installCommand,
            `${this.cliBinary} --version`,
            this.outputChannel,
        );
    }

    private async runVisible(
        ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>,
        title: string,
        autoExecute: boolean,
    ): Promise<vscode.Terminal> {
        try {
            await this.ensureInstalled();

            const plan = await this.prepareDispatch(ctx);

            const terminal = vscode.window.createTerminal({
                name: title,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                location: { viewColumn: vscode.ViewColumn.Two },
            });
            terminal.show();

            await waitForShellReady(terminal);
            terminal.sendText(plan.commandLine, autoExecute);

            this.scheduleCleanup(plan.tempFiles);
            return terminal;
        } catch (error) {
            this.outputChannel.appendLine(`[${this.logPrefix}] ERROR: ${error}`);
            vscode.window.showErrorMessage(`Failed to run ${this.name}: ${error}`);
            throw error;
        }
    }

    private async runHeadless(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): Promise<AIExecutionResult> {
        await this.ensureInstalled();
        this.outputChannel.appendLine(`[${this.logPrefix}] Invoking ${this.name} in headless mode`);
        // Echo the prompt body to the output channel — temp files get
        // unlinked after `Timing.tempFileCleanupDelay`, so without this echo
        // there is no post-hoc way to inspect what was sent when debugging
        // "background dispatch did the wrong thing." The pre-refactor
        // executeHeadless on each provider had this exact pattern.
        this.outputChannel.appendLine(`========================================`);
        this.outputChannel.appendLine(ctx.prompt);
        this.outputChannel.appendLine(`========================================`);

        const plan = await this.prepareDispatch(ctx);

        // The hidden-terminal helper handles cleanup of the primary temp file
        // via its own `tempFilePath` arg. Any *additional* temp files (e.g.
        // Claude's system-prompt file) are cleaned up via the `cleanupFn` hook.
        const [primary, ...extras] = plan.tempFiles;
        const extraCleanup = extras.length === 0
            ? undefined
            : async () => {
                for (const p of extras) {
                    try {
                        await fs.promises.unlink(p);
                        this.outputChannel.appendLine(`[${this.logPrefix}] Cleaned up file: ${p}`);
                    } catch (e) {
                        this.outputChannel.appendLine(`[${this.logPrefix}] Failed to cleanup ${p}: ${e}`);
                    }
                }
            };

        return executeCommandInHiddenTerminal({
            commandLine: plan.commandLine,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            terminalName: this.headlessTerminalName,
            outputChannel: this.outputChannel,
            logPrefix: this.logPrefix,
            tempFilePath: primary,
            cleanupFn: extraCleanup,
            logCommandOnFailure: true,
        });
    }

    private scheduleCleanup(tempFiles: string[]): void {
        if (tempFiles.length === 0) return;
        setTimeout(async () => {
            for (const p of tempFiles) {
                try {
                    await fs.promises.unlink(p);
                    this.outputChannel.appendLine(`[${this.logPrefix}] Cleaned up prompt file: ${p}`);
                } catch (e) {
                    this.outputChannel.appendLine(`[${this.logPrefix}] Failed to cleanup temp file: ${e}`);
                }
            }
        }, Timing.tempFileCleanupDelay);
    }
}
