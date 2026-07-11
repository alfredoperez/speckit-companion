import { AIProviders } from '../core/constants';
import { AIProviderType } from './aiProvider';
import { CliTerminalProvider, DispatchContext, DispatchPlan } from './cliTerminalProvider';
import { createTempFile } from '../core/utils/tempFileUtils';

/**
 * Wibey CLI provider — dispatches SpecKit commands to the Wibey CLI
 * (`wibey -f <file>`) in a VS Code terminal.
 *
 * Wibey CLI is Walmart's first-party AI coding assistant, built on the
 * Claude Agent SDK.
 *
 * The base class handles the full lifecycle:
 *   - Install check: `wibey --version`
 *   - Terminal create/reuse
 *   - Temp-file dispatch: `wibey -f "/path/to/prompt.md"` (--prompt-file; no shell expansion)
 *   - Scheduled temp-file cleanup
 *
 * Permission mode is managed via `~/.wibey/settings.json` (`bypassPermissions`)
 * — there is no CLI flag equivalent, so `autoApproveFlag` is `''`.
 *
 * The `wibey-vscode` panel key is handled by its sibling `WibeyPanelProvider`,
 * which dispatches to the Wibey chat panel via a runtime waterfall
 * (`wibey.sendPrompt` command → URI handler → clipboard) instead of a terminal.
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

    /**
     * Override to use `wibey -f <file>` instead of `wibey -p "$(cat <file>)"`.
     *
     * The default base-class dispatch (`-p "$(cat "path")"`) breaks when the
     * temp-file path contains spaces — macOS stores VS Code extension storage
     * under `~/Library/Application Support/...`, which the shell sometimes
     * passes as a literal `$(cat ...)` string to the CLI rather than expanding
     * it, causing Wibey to reject it with "Invalid command format".
     *
     * Wibey CLI supports `--prompt-file / -f` (confirmed in wibey-cli source):
     *   `wibey -f "/path with spaces/prompt.md"`
     * This reads the file directly — no shell expansion, no nested quoting,
     * works on macOS, Linux, and Windows (WSL path conversion via
     * `convertTempFilePathForWSL` still applies).
     */
    protected async prepareDispatch(
        ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>,
    ): Promise<DispatchPlan> {
        const promptText = this.preprocessPrompt(ctx);
        const filePrefix = ctx.mode === 'headless' ? 'background-prompt' : 'prompt';
        const tempFilePath = await createTempFile(
            this.context,
            promptText,
            filePrefix,
            this.convertTempFilePathForWSL,
        );
        const permissionFlag = this.getPermissionFlag(); // '' for Wibey (no auto-approve flag)
        const commandLine = `${this.cliBinary} ${permissionFlag}-f "${tempFilePath}"`;
        this.outputChannel.appendLine(`[WibeyCliProvider] dispatch: ${commandLine}`);
        return { commandLine, tempFiles: [tempFilePath] };
    }
}
