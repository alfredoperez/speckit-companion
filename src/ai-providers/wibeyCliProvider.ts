import { AIProviders } from '../core/constants';
import { AIProviderType } from './aiProvider';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * Wibey CLI provider — dispatches SpecKit commands to the Wibey CLI
 * (`wibey -p "…"`) in a VS Code terminal.
 *
 * Wibey CLI is Walmart's first-party AI coding assistant, built on the
 * Claude Agent SDK. It uses the same `-p` flag for non-interactive prompt
 * dispatch as the base `CliTerminalProvider` default (`cliPromptFlag()`
 * returns `'-p '`), so no method overrides are required.
 *
 * The base class handles the full lifecycle:
 *   - Install check: `wibey --version`
 *   - Terminal create/reuse
 *   - Temp-file dispatch: `wibey -p "$(cat /tmp/prompt.md)"`
 *   - Scheduled temp-file cleanup
 *
 * Permission mode is managed via `~/.wibey/settings.json` (`bypassPermissions`)
 * — there is no CLI flag equivalent, so `autoApproveFlag` is `''`.
 *
 * NOTE — Phase 2: A `WibeyPanelProvider` for the `wibey-vscode` key is
 * deferred until `genaica/wibey-vscode-extension` exposes a
 * `wibey.sendPrompt(text: string)` command.
 */
export class WibeyCliProvider extends CliTerminalProvider {
    public readonly name = 'Wibey CLI';
    public readonly type: AIProviderType = AIProviders.WIBEY;

    protected readonly cliBinary = 'wibey';
    protected readonly installHint = {
        displayName: 'Wibey CLI',
        installCommand: 'curl -sSL https://wibey.walmart.com/cli/setup | bash',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Wibey';
    protected readonly headlessTerminalName = 'Wibey Background';
    protected readonly logPrefix = 'WibeyCliProvider';

    // No method overrides needed.
    // Dispatch produces: wibey -p "$(cat /tmp/prompt.md)"
    // Slash commands:    wibey -p "/speckit-specify $(cat /tmp/prompt.md)"
}
