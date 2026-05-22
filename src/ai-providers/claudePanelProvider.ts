import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { splitContextPreamble, cleanCommandArg } from './promptBuilder';

/** Extension id of the Claude Code GUI extension. */
const CLAUDE_CODE_EXTENSION_ID = 'anthropic.claude-code';

/**
 * Workspace-relative file the assembled prompt is written to so it can be
 * `@`-mentioned into the panel (the panel resolves workspace files by path).
 * Lives under `.claude/` (already present for Claude users) with a stable name
 * so it is overwritten each dispatch rather than accumulating.
 */
const PROMPT_REL_PATH = '.claude/speckit-companion-prompt.md';

/**
 * Claude in VS Code provider — instead of spawning the `claude` CLI in a
 * terminal, it opens the Claude Code GUI panel via the extension's documented
 * URI handler (`vscode://anthropic.claude-code/open?prompt=…`) and pre-fills the
 * input box.
 *
 * KNOWN LIMITATION (documented): the URI handler pre-fills but does NOT
 * auto-submit — the user presses Enter. There is no documented param or command
 * to submit programmatically. The full prompt (including the `.spec-context.json`
 * bookkeeping preamble) is written to a workspace file and `@`-mentioned so the
 * panel still receives the whole instruction (the panel resolves workspace files
 * by path); the visible command itself is cleaned via `cleanCommandArg` so the
 * input reads well. Every path is wrapped so nothing throws.
 */
export class ClaudePanelProvider implements IAIProvider {
    public readonly name = 'Claude in VS Code';
    public readonly type = AIProviders.CLAUDE_VSCODE;

    private outputChannel: vscode.OutputChannel;

    constructor(_context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /** Installed when the Claude Code GUI extension is present. */
    async isInstalled(): Promise<boolean> {
        return vscode.extensions.getExtension(CLAUDE_CODE_EXTENSION_ID) !== undefined;
    }

    getPermissionFlag(): string {
        return '';
    }

    /**
     * Write the full assembled prompt to the workspace prompt file and return
     * its workspace-relative path for `@`-mentioning. Returns null if there is
     * no workspace folder (the panel needs one anyway).
     */
    private async writePromptFile(fullPrompt: string): Promise<string | null> {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return null;
        try {
            const fileUri = vscode.Uri.joinPath(folder.uri, PROMPT_REL_PATH);
            const dirUri = vscode.Uri.joinPath(folder.uri, '.claude');
            await vscode.workspace.fs.createDirectory(dirUri);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(fullPrompt, 'utf-8'));
            return PROMPT_REL_PATH;
        } catch (error) {
            this.outputChannel.appendLine(`[ClaudePanelProvider] Failed to write prompt file: ${error}`);
            return null;
        }
    }

    /**
     * Build the text to pre-fill into the panel input. The command (a
     * `/speckit.*` slash command or a free-form prompt) goes first so it runs on
     * Enter; when a bookkeeping preamble exists it is carried as an `@`-mention
     * of the prompt file so the panel still gets the full instruction.
     */
    private buildPanelPrompt(command: string, promptRelPath: string | null, hasPreamble: boolean): string {
        if (hasPreamble && promptRelPath) {
            return `${command}\n\n@${promptRelPath}`;
        }
        return command;
    }

    /**
     * Core dispatch: open the Claude Code panel via the URI handler with the
     * prompt pre-filled, then surface an obvious "press Enter" notification (the
     * panel exposes no programmatic submit). Never throws — returns false on any
     * failure.
     */
    private async dispatchToPanel(prompt: string): Promise<boolean> {
        try {
            if (!(await this.isInstalled())) {
                vscode.window.showWarningMessage(
                    'The Claude Code extension is not installed. Install it, or switch `speckit.aiProvider` to `claude` (terminal).'
                );
                return false;
            }

            const { preamble, command } = splitContextPreamble(prompt);
            // Clean the prefilled command so the panel input reads well (inline a
            // new-spec description from its temp file, shorten spec-dir paths to
            // the spec name) and write the full prompt file — independent, so run
            // them concurrently.
            const [cmdText, promptRelPath] = await Promise.all([
                cleanCommandArg(command),
                this.writePromptFile(prompt),
            ]);
            if (preamble && !promptRelPath) {
                this.outputChannel.appendLine(
                    '[ClaudePanelProvider] No workspace folder for the prompt file — dispatching without the context preamble.'
                );
            }
            const panelPrompt = this.buildPanelPrompt(cmdText, promptRelPath, !!preamble);

            // Use the running product's scheme so this works in Insiders / forks.
            const uri = vscode.Uri.parse(
                `${vscode.env.uriScheme}://${CLAUDE_CODE_EXTENSION_ID}/open?prompt=${encodeURIComponent(panelPrompt)}`
            );

            this.outputChannel.appendLine(`[ClaudePanelProvider] Opening Claude Code panel (prefill):\n${panelPrompt}`);
            this.outputChannel.appendLine(`[ClaudePanelProvider] URI: ${uri.toString()}`);

            const opened = await vscode.env.openExternal(uri);
            if (!opened) {
                this.outputChannel.appendLine('[ClaudePanelProvider] openExternal returned false');
                vscode.window.showWarningMessage('Could not open the Claude Code panel.');
                return false;
            }

            this.notifyPressEnter(cmdText);
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`[ClaudePanelProvider] ERROR dispatching to panel: ${error}`);
            vscode.window.showWarningMessage(`Couldn't open the Claude Code panel: ${error}`);
            return false;
        }
    }

    /**
     * Make it obvious the command was only PREFILLED and needs a manual Enter
     * (the Claude Code panel exposes no programmatic submit). Names the command
     * verb so the pending action is clear.
     */
    private notifyPressEnter(cmdText: string): void {
        const verb = cmdText.split(/\s+/)[0] || 'the command';
        vscode.window.showInformationMessage(
            `▶ Claude Code panel is ready — press Enter to run ${verb}. (The panel can't auto-submit.)`
        );
    }

    /**
     * Dispatch the assembled prompt to the Claude Code panel. Returns
     * `undefined` (no terminal) — call sites tolerate this via the widened
     * IAIProvider return type.
     */
    async executeInTerminal(prompt: string, _title?: string): Promise<vscode.Terminal | undefined> {
        await this.dispatchToPanel(prompt);
        return undefined;
    }

    /**
     * No headless analog for a GUI panel — degrade to the interactive panel path
     * and report a non-failure exit code (`undefined`), which callers treat as
     * success.
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.dispatchToPanel(prompt);
        return { exitCode: undefined };
    }

    /**
     * Slash commands have no terminal analog for the panel — route the command
     * text to the panel like any other prompt. Returns `undefined`.
     */
    async executeSlashCommand(command: string, _title?: string, _autoExecute?: boolean): Promise<vscode.Terminal | undefined> {
        await this.dispatchToPanel(command);
        return undefined;
    }
}
