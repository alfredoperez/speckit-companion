import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AIProviders } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { waitForShellReady } from '../core/utils/terminalUtils';
import { ensureCliInstalled } from '../core/utils/installUtils';
import { splitContextPreamble } from './promptBuilder';

const execAsync = promisify(exec);

/**
 * Wibey CLI provider — dispatches SpecKit commands to the Wibey TUI.
 *
 * ## Dispatch strategy
 *
 * Wibey CLI is a TUI-first tool (interactive session with its own UI).
 * The headless `-p/-f` flags work but exit after each task, making the
 * experience feel disjointed. Instead, this provider follows the same
 * pattern as `GeminiCliProvider`:
 *
 *   1. **Reuse** an existing "SpecKit - Wibey" terminal if one is open
 *      and Wibey is still running. Send the command directly to the TUI.
 *   2. **Create** a new terminal when none exists: start `wibey`
 *      interactively, wait for the TUI to initialise, then send the prompt.
 *
 * This keeps Wibey running after each task so the developer can continue
 * working inside the same session.
 *
 * ## Terminal reuse
 * VS Code exposes `vscode.window.terminals` — we scan for a terminal
 * whose name matches `TERMINAL_TITLE` and whose `exitStatus` is undefined
 * (i.e., the process is still alive). If found, we send text directly;
 * otherwise we boot a fresh session.
 *
 * Note: the `wibey-vscode` panel key is handled by `WibeyPanelProvider`.
 */
export class WibeyCliProvider implements IAIProvider {
    public readonly name = 'Wibey CLI';
    public readonly type = AIProviders.WIBEY;

    private static readonly TERMINAL_TITLE = 'SpecKit - Wibey';

    /**
     * Milliseconds to wait after `wibey` is launched before sending the
     * first prompt. Wibey's TUI needs to load its config, check for updates,
     * and render the input area before it can accept keystrokes.
     */
    private static readonly INIT_DELAY_MS = 6000;

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
    }

    getPermissionFlag(): string {
        return ''; // Wibey permission mode is set interactively (SHIFT+TAB)
    }

    async isInstalled(): Promise<boolean> {
        try {
            await execAsync('wibey --version');
            return true;
        } catch {
            return false;
        }
    }

    private async ensureInstalled(): Promise<void> {
        await ensureCliInstalled(
            'Wibey CLI',
            'curl -sSL https://wibey.walmart.com/cli/setup | bash',
            'wibey --version',
            this.outputChannel,
        );
    }

    /**
     * Find an existing live "SpecKit - Wibey" terminal, or create a new one.
     * Returns the terminal and whether it was just created (needs boot delay).
     */
    private findOrCreateTerminal(): { terminal: vscode.Terminal; isNew: boolean } {
        const existing = vscode.window.terminals.find(
            t => t.name === WibeyCliProvider.TERMINAL_TITLE && t.exitStatus === undefined,
        );
        if (existing) {
            this.outputChannel.appendLine('[WibeyCliProvider] Reusing existing Wibey terminal');
            return { terminal: existing, isNew: false };
        }
        this.outputChannel.appendLine('[WibeyCliProvider] Creating new Wibey terminal');
        const terminal = vscode.window.createTerminal({
            name: WibeyCliProvider.TERMINAL_TITLE,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            location: { viewColumn: vscode.ViewColumn.Two },
        });
        return { terminal, isNew: true };
    }

    /**
     * Send a prompt to the Wibey TUI.
     *
     * - If the terminal is new: start `wibey` interactively, wait for the
     *   TUI to load (`INIT_DELAY_MS`), then send the prompt text + Enter.
     * - If the terminal already has Wibey running: send directly.
     *
     * The preamble (`.spec-context.json` bookkeeping injected by SpecKit) is
     * stripped from the visible command so the TUI input reads cleanly.
     */
    private async dispatch(prompt: string): Promise<vscode.Terminal> {
        await this.ensureInstalled();

        const { terminal, isNew } = this.findOrCreateTerminal();
        terminal.show();

        // Strip the context-preamble injected by SpecKit so only the
        // actual command is sent to the Wibey TUI input.
        const { command: visibleCommand } = splitContextPreamble(prompt);

        if (isNew) {
            // Boot Wibey interactively, then send the command once the TUI is ready.
            await waitForShellReady(terminal);
            terminal.sendText('wibey', true);

            const delay = WibeyCliProvider.INIT_DELAY_MS;
            setTimeout(() => {
                this.outputChannel.appendLine(
                    `[WibeyCliProvider] Sending prompt after ${delay}ms init delay:\n${visibleCommand}`,
                );
                terminal.sendText(visibleCommand, false);
            }, delay);
            setTimeout(() => terminal.sendText('', true), delay + 200);
        } else {
            // Wibey is already running — send text directly to the TUI input.
            this.outputChannel.appendLine(
                `[WibeyCliProvider] Sending prompt to existing session:\n${visibleCommand}`,
            );
            terminal.sendText(visibleCommand, false);
            setTimeout(() => terminal.sendText('', true), 200);
        }

        return terminal;
    }

    async executeInTerminal(prompt: string, _title?: string): Promise<vscode.Terminal> {
        return this.dispatch(prompt);
    }

    async executeSlashCommand(
        command: string,
        _title?: string,
        _autoExecute?: boolean,
    ): Promise<vscode.Terminal> {
        const slashCommand = command.startsWith('/') ? command : `/${command}`;
        return this.dispatch(slashCommand);
    }

    /**
     * Headless execution — used by background tasks. Falls back to piping
     * through the Wibey CLI's `-p` flag (if available) or returns a stub
     * result. Most SpecKit flows use `executeInTerminal`; this path is
     * rarely hit in practice.
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        this.outputChannel.appendLine('[WibeyCliProvider] Headless execution requested — using interactive terminal fallback');
        await this.dispatch(prompt);
        return { exitCode: undefined };
    }
}
