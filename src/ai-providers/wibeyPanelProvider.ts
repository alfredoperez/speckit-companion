import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { splitContextPreamble, cleanCommandArg } from './promptBuilder';

/** Extension ID of the Wibey VS Code extension. */
const WIBEY_EXTENSION_ID = 'wibey.wibey-vscode-extension';

/**
 * VS Code command added in genaica/wibey-vscode-extension issue #442 (Option A).
 * When present, pre-fills the chat input with the given text and focuses the panel.
 */
const WIBEY_SEND_PROMPT_COMMAND = 'wibey.sendPrompt';

/**
 * Path used in the URI handler registered by genaica/wibey-vscode-extension
 * issue #442 (Option B).
 * Full URI: vscode://wibey.wibey-vscode-extension/open?prompt=<encoded>
 * (`vscode.env.uriScheme` adapts automatically to Cursor, Windsurf, etc.)
 */
const WIBEY_URI_PATH = 'open';

/**
 * Wibey in VS Code provider — instead of spawning a terminal, it routes
 * SpecKit commands to the Wibey chat panel (wibey.wibey-vscode-extension).
 *
 * ## Dispatch strategy (runtime waterfall — no config needed)
 *
 * 1. **`wibey.sendPrompt(text)` — Option A / command.**
 *    Direct VS Code command call. Pre-fills the Wibey chat input and focuses
 *    the panel. Cleanest path: no URL encoding, no OS routing, instant.
 *    Requires genaica/wibey-vscode-extension#442 (Option A).
 *
 * 2. **URI handler — Option B / deep link.**
 *    `vscode://wibey.wibey-vscode-extension/open?prompt=<encoded>` via
 *    `vscode.env.openExternal`. Adapts to the host editor's URI scheme
 *    (Cursor → `cursor://...`, Windsurf → `windsurf://...`). Returns
 *    `false` when no handler is registered, so the waterfall moves on.
 *    Requires genaica/wibey-vscode-extension#442 (Option B).
 *
 * 3. **Clipboard fallback** — works with Wibey v1.0.19+ today.
 *    Copies the command, opens the panel via `wibey.openChat`, notifies
 *    the user to paste (⌘V / Ctrl+V). Same pattern as Windsurf in
 *    `IdeChatProvider`.
 *
 * ## Why A before B when both are present?
 * The command (A) is strictly more reliable: it's a direct function call with
 * no URL encoding/decoding, no OS URI-scheme routing, and no risk of a
 * browser intercepting the deep link. The Wibey team should implement
 * whichever option they prefer — this provider handles either transparently.
 *
 * ## Zero-change upgrade path
 * When issue #442 lands (either A or B), speckit-companion needs no further
 * changes. The waterfall probes at dispatch time.
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
     * Runtime waterfall — probed in this order every dispatch call,
     * no static config needed. Each path is self-contained and falls
     * through when unavailable.
     *
     *   Path 1 — wibey.sendPrompt command (Option A)
     *   Path 2 — URI handler deep link   (Option B)
     *   Path 3 — clipboard fallback       (today)
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

            // ── Path 1: wibey.sendPrompt command (Option A) ─────────────────────
            // Direct call — no URL encoding, no OS routing, instant.
            // Available when genaica/wibey-vscode-extension#442 Option A lands.
            try {
                const allCommands = await vscode.commands.getCommands(true);
                if (allCommands.includes(WIBEY_SEND_PROMPT_COMMAND)) {
                    this.outputChannel.appendLine(
                        `[WibeyPanelProvider] Path 1 — ${WIBEY_SEND_PROMPT_COMMAND}:\n${chatQuery}`
                    );
                    await vscode.commands.executeCommand(WIBEY_SEND_PROMPT_COMMAND, chatQuery);
                    return true;
                }
            } catch (cmdErr) {
                this.outputChannel.appendLine(
                    `[WibeyPanelProvider] Path 1 failed (${cmdErr}), trying URI handler`
                );
            }

            // ── Path 2: URI handler deep link (Option B) ─────────────────────────
            // vscode://wibey.wibey-vscode-extension/open?prompt=<encoded>
            // openExternal returns false when no URI handler is registered,
            // so we fall through cleanly. uriScheme adapts to Cursor/Windsurf/etc.
            // Available when genaica/wibey-vscode-extension#442 Option B lands.
            try {
                const uri = vscode.Uri.parse(
                    `${vscode.env.uriScheme}://${WIBEY_EXTENSION_ID}/${WIBEY_URI_PATH}` +
                    `?prompt=${encodeURIComponent(chatQuery)}`
                );
                this.outputChannel.appendLine(
                    `[WibeyPanelProvider] Path 2 — URI handler: ${uri.toString()}`
                );
                const opened = await vscode.env.openExternal(uri);
                if (opened) {
                    return true;
                }
                this.outputChannel.appendLine(
                    '[WibeyPanelProvider] Path 2 — openExternal returned false, trying clipboard fallback'
                );
            } catch (uriErr) {
                this.outputChannel.appendLine(
                    `[WibeyPanelProvider] Path 2 failed (${uriErr}), trying clipboard fallback`
                );
            }

            // ── Path 3: clipboard fallback (works with Wibey v1.0.19+) ───────────
            // Same pattern as IdeChatProvider for Windsurf/Cascade.
            this.outputChannel.appendLine(
                '[WibeyPanelProvider] Path 3 — clipboard fallback'
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
