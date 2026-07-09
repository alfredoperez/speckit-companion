import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { splitContextPreamble, cleanCommandArg } from './promptBuilder';

/** Extension ID of the Wibey VS Code extension. */
const WIBEY_EXTENSION_ID = 'wibey.wibey-vscode-extension';

/**
 * VS Code command added in genaica/wibey-vscode-extension issue #442.
 * When present, pre-fills the chat input with the given text and focuses the panel.
 * When absent, the provider falls back to the clipboard path.
 */
const WIBEY_SEND_PROMPT_COMMAND = 'wibey.sendPrompt';

/**
 * Wibey in VS Code provider — instead of spawning a terminal, it routes
 * SpecKit commands to the Wibey chat panel (wibey.wibey-vscode-extension).
 *
 * ## Dispatch strategy (in priority order)
 *
 * 1. **`wibey.sendPrompt(text)`** — preferred path. Requires the Wibey
 *    extension to expose this command (tracked in
 *    gecgithub01.walmart.com/genaica/wibey-vscode-extension/issues/442).
 *    When available, the panel opens with the SpecKit command pre-filled
 *    and the user presses Enter to run it — identical experience to the
 *    `claude-vscode` provider.
 *
 * 2. **Clipboard fallback** — works with Wibey extension v1.0.19 and later.
 *    Copies the command to the clipboard, opens the panel via
 *    `wibey.openChat`, and notifies the user to paste (⌘V / Ctrl+V).
 *    Same pattern used for Windsurf in `IdeChatProvider`.
 *
 * ## Upgrade path
 * When issue #442 is resolved and `wibey.sendPrompt` becomes available,
 * speckit-companion requires no further changes — this provider picks it up
 * automatically at dispatch time via `vscode.commands.getCommands()`.
 */
export class WibeyPanelProvider implements IAIProvider {
    public readonly name = 'Wibey (VS Code)';
    public readonly type = AIProviders.WIBEY_VSCODE;

    private outputChannel: vscode.OutputChannel;

    constructor(_context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /** Installed when the Wibey VS Code extension is present. */
    async isInstalled(): Promise<boolean> {
        return vscode.extensions.getExtension(WIBEY_EXTENSION_ID) !== undefined;
    }

    getPermissionFlag(): string {
        return '';
    }

    /**
     * Core dispatch. Priority:
     *   1. wibey.sendPrompt(text) if registered
     *   2. clipboard + wibey.openChat
     */
    private async dispatchToPanel(prompt: string): Promise<boolean> {
        try {
            if (!(await this.isInstalled())) {
                vscode.window.showWarningMessage(
                    'The Wibey extension is not installed. Install it from the VS Code Marketplace, or switch `speckit.aiProvider` to `wibey` (terminal).'
                );
                return false;
            }

            const { command } = splitContextPreamble(prompt);
            const chatQuery = await cleanCommandArg(command);

            // ── Path 1: wibey.sendPrompt (requires issue #442) ──────────────────
            try {
                const allCommands = await vscode.commands.getCommands(true);
                if (allCommands.includes(WIBEY_SEND_PROMPT_COMMAND)) {
                    this.outputChannel.appendLine(
                        `[WibeyPanelProvider] Dispatching via ${WIBEY_SEND_PROMPT_COMMAND}:\n${chatQuery}`
                    );
                    await vscode.commands.executeCommand(WIBEY_SEND_PROMPT_COMMAND, chatQuery);
                    return true;
                }
            } catch (cmdErr) {
                this.outputChannel.appendLine(
                    `[WibeyPanelProvider] ${WIBEY_SEND_PROMPT_COMMAND} failed, falling back to clipboard: ${cmdErr}`
                );
            }

            // ── Path 2: clipboard fallback (works with Wibey v1.0.19+) ──────────
            this.outputChannel.appendLine(
                `[WibeyPanelProvider] ${WIBEY_SEND_PROMPT_COMMAND} not available — using clipboard fallback`
            );

            try {
                await vscode.env.clipboard.writeText(chatQuery);
            } catch (clipErr) {
                this.outputChannel.appendLine(`[WibeyPanelProvider] Clipboard write failed: ${clipErr}`);
            }

            await vscode.commands.executeCommand('wibey.openChat');

            vscode.window.showInformationMessage(
                'SpecKit command copied — paste it into Wibey (⌘V / Ctrl+V) and press Enter.'
            );
            return true;

        } catch (error) {
            this.outputChannel.appendLine(`[WibeyPanelProvider] ERROR dispatching to panel: ${error}`);
            vscode.window.showWarningMessage(`Couldn't open the Wibey panel: ${error}`);
            return false;
        }
    }

    async executeInTerminal(prompt: string, _title?: string): Promise<vscode.Terminal | undefined> {
        await this.dispatchToPanel(prompt);
        return undefined;
    }

    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.dispatchToPanel(prompt);
        return { exitCode: undefined };
    }

    async executeSlashCommand(command: string, _title?: string, _autoExecute?: boolean): Promise<vscode.Terminal | undefined> {
        await this.dispatchToPanel(command);
        return undefined;
    }
}
