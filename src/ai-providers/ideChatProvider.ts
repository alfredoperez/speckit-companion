import * as vscode from 'vscode';
import { AIProviders, Commands } from '../core/constants';
import { SpecKitDetector } from '../speckit/detector';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { splitContextPreamble, cleanCommandArg } from './promptBuilder';

/**
 * Host editors that expose a built-in AI chat we can dispatch to.
 * `unknown` means the editor was not recognized — we still try the inherited
 * base chat command before giving up.
 */
type HostIde = 'vscode' | 'cursor' | 'windsurf' | 'antigravity' | 'unknown';

/** Inherited VS Code chat-open command — present in most forks. */
const BASE_CHAT_OPEN = 'workbench.action.chat.open';

interface HostProfile {
    /** Human-readable label for logs and user-facing messages. */
    label: string;
    /**
     * Ordered chat-open command candidates; the first one actually registered
     * (verified against `vscode.commands.getCommands`) wins. The inherited
     * `BASE_CHAT_OPEN` goes first; fork-specific IDs (proprietary, undocumented)
     * follow as fallbacks.
     */
    chatCommands: readonly string[];
    /**
     * spec-kit installs this host's commands as dash-named skills
     * (`.cursor/skills/speckit-tasks/`, `.agents/skills/speckit-tasks/`), so emit
     * `/speckit-tasks`. Hosts with dot-named slash commands (Copilot prompts,
     * Windsurf workflows) keep `/speckit.tasks`.
     */
    dashCommands: boolean;
    /**
     * Host's chat-open drops the `query` arg (opens an empty chat) and exposes no
     * "open chat with a prompt" command, so copy the command to the clipboard,
     * open the chat, and ask the user to paste + Enter. Windsurf's Cascade does this.
     */
    clipboardFallback: boolean;
}

const HOST_PROFILES: Record<HostIde, HostProfile> = {
    vscode: { label: 'VS Code (Copilot Chat)', chatCommands: [BASE_CHAT_OPEN], dashCommands: false, clipboardFallback: false },
    cursor: { label: 'Cursor (Composer)', chatCommands: [BASE_CHAT_OPEN, 'aichat.newchataction', 'composer.startComposerPrompt'], dashCommands: true, clipboardFallback: false },
    windsurf: { label: 'Windsurf (Cascade)', chatCommands: [BASE_CHAT_OPEN, 'windsurf.prioritized.chat.open'], dashCommands: false, clipboardFallback: true },
    antigravity: { label: 'Antigravity', chatCommands: [BASE_CHAT_OPEN], dashCommands: true, clipboardFallback: false },
    unknown: { label: 'Unknown editor', chatCommands: [BASE_CHAT_OPEN], dashCommands: false, clipboardFallback: false },
};

const IDE_DISPLAY_NAMES: Record<HostIde, string> = {
    vscode: 'GitHub Copilot',
    cursor: 'Cursor Chat',
    windsurf: 'Windsurf Chat',
    antigravity: 'IDE Chat',
    unknown: 'IDE Chat',
};

/**
 * Returns the human-readable display name for the host IDE's chat product.
 * Used by getProviderDisplayName() in aiProvider.ts and detectHostIde() below.
 */
export function getIdeChatDisplayName(): string {
    const scheme = (vscode.env.uriScheme || '').toLowerCase();
    const appName = (vscode.env.appName || '').toLowerCase();
    let host: HostIde = 'unknown';
    if (scheme === 'cursor' || appName.includes('cursor')) {
        host = 'cursor';
    } else if (scheme === 'windsurf' || appName.includes('windsurf')) {
        host = 'windsurf';
    } else if (scheme === 'antigravity' || scheme === 'agy' || appName.includes('antigravity')) {
        host = 'antigravity';
    } else if (scheme === 'vscode' || scheme === 'vscode-insiders' || appName.includes('visual studio code')) {
        host = 'vscode';
    }
    return IDE_DISPLAY_NAMES[host];
}

/** Common tail for the no-chat-target warnings — keeps the guidance identical. */
const SWITCH_TO_CLI_HINT =
    'Switch `speckit.aiProvider` to a CLI provider (e.g. Claude, Gemini) to run this command.';

/**
 * IDE Chat provider — instead of spawning a CLI in a terminal, it routes the
 * already-assembled prompt to the host editor's built-in AI chat via a verified
 * VS Code command. Detects the host (VS Code → Copilot, Cursor → Composer,
 * Windsurf → Cascade) from `vscode.env`, resolves a chat-open command from a
 * per-IDE candidate list, and only dispatches after confirming the command
 * exists — otherwise it surfaces a graceful, actionable message. Every path is
 * wrapped so nothing throws.
 */
export class IdeChatProvider implements IAIProvider {
    public readonly name = 'IDE Chat';
    public readonly type = AIProviders.IDE_CHAT;

    private outputChannel: vscode.OutputChannel;

    constructor(_context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Detect the host editor from stable `vscode.env` signals. `uriScheme` is
     * the most reliable (forks set their own), with `appName` as a fallback.
     */
    detectHostIde(): HostIde {
        const scheme = (vscode.env.uriScheme || '').toLowerCase();
        const appName = (vscode.env.appName || '').toLowerCase();

        if (scheme === 'cursor' || appName.includes('cursor')) {
            return 'cursor';
        }
        if (scheme === 'windsurf' || appName.includes('windsurf')) {
            return 'windsurf';
        }
        if (scheme === 'antigravity' || scheme === 'agy' || appName.includes('antigravity')) {
            return 'antigravity';
        }
        if (scheme === 'vscode' || scheme === 'vscode-insiders' || appName.includes('visual studio code')) {
            return 'vscode';
        }
        // An unrecognized fork falls through to 'unknown', which still tries the
        // inherited base chat command before giving up.
        return 'unknown';
    }
    /**
     * Resolve the first candidate chat command that is actually registered in
     * the running editor. Returns `undefined` when none are available so the
     * caller can take the graceful fallback path.
     */
    async resolveChatCommand(host: HostIde): Promise<string | undefined> {
        try {
            const available = await vscode.commands.getCommands(true);
            return HOST_PROFILES[host].chatCommands.find(candidate => available.includes(candidate));
        } catch (error) {
            this.outputChannel.appendLine(`[IdeChatProvider] Failed to enumerate commands: ${error}`);
            return undefined;
        }
    }

    /**
     * Whether spec-kit is initialized in this workspace. The dispatched
     * `/speckit.*` commands only resolve in the host chat when spec-kit has
     * scaffolded them for the editor, so this gates auto-submit. Extracted so
     * tests can stub it without wiring the filesystem.
     */
    private async isWorkspaceSpecKitReady(): Promise<boolean> {
        return SpecKitDetector.getInstance().checkWorkspaceInitialized();
    }

    /**
     * Turn a built `/speckit.* <arg>` command into the form to send to the host
     * chat:
     * - the command verb is reformatted per host — dot (`/speckit.tasks`) for
     *   Copilot/Windsurf, dash (`/speckit-tasks`) for Cursor/Antigravity, whose
     *   spec-kit commands are dash-named skills;
     * - free-text / multi-token / non-path arguments are kept as-is (e.g.
     *   `specify` with a typed feature description);
     * - `specify <temp.md>` (create-new-spec dispatches the description inside a
     *   temp markdown file the chat can't read) is inlined to
     *   `specify <description>`, dropping the appended spec-context bookkeeping;
     * - any other spec-dir path argument is shortened to just the spec name
     *   (the chat resolves the feature by name and it reads far better than an
     *   absolute path).
     */
    private async buildChatQuery(prompt: string, host: HostIde): Promise<string> {
        // Shared helper cleans the arg (description inlining, spec-dir shortening);
        // then format the verb for the host. The verb has no spaces, so formatting
        // before vs. after arg cleanup is equivalent — doing it after avoids a
        // second split.
        const cleaned = await cleanCommandArg(splitContextPreamble(prompt).command);
        const sp = cleaned.indexOf(' ');
        if (sp === -1) return this.formatCommandForHost(cleaned, host);
        return `${this.formatCommandForHost(cleaned.slice(0, sp), host)}${cleaned.slice(sp)}`;
    }

    /**
     * Reformat a `/speckit.*` command verb for the host: dash form
     * (`/speckit-tasks`) where spec-kit installs dash-named skills (Cursor,
     * Antigravity); dot form (`/speckit.tasks`) everywhere else. Non-speckit
     * commands are left untouched.
     */
    private formatCommandForHost(cmd: string, host: HostIde): string {
        if (!HOST_PROFILES[host].dashCommands) return cmd;
        return cmd.replace(/^(\/?)speckit\./, '$1speckit-');
    }

    /** Warn that the host chat won't recognize `/speckit.*` until spec-kit is set up. */
    private async warnSpecKitNotReady(host: HostIde): Promise<void> {
        const init = 'Initialize SpecKit';
        const choice = await vscode.window.showWarningMessage(
            `IDE Chat sends \`/speckit.*\` commands to ${HOST_PROFILES[host].label}, but spec-kit isn't ` +
            `initialized in this workspace — the chat won't recognize them. Run SpecKit: Initialize Workspace first.`,
            init
        );
        if (choice === init) {
            await vscode.commands.executeCommand(Commands.initWorkspace);
        }
    }

    /**
     * Core dispatch: detect host, resolve a chat command, reduce the prompt to
     * what the host chat can use, and open it. Never throws — on no resolvable
     * target it shows a graceful warning and returns false.
     *
     * Submit behavior is host-specific: Copilot/VS Code auto-submits via the
     * `query` arg when ready; Cursor prefills (it has no callable command to send
     * a typed prompt — submit is the input's Enter handler) so the user presses
     * Enter; Windsurf drops the query, so it falls back to the clipboard.
     */
    private async dispatchToChat(prompt: string): Promise<boolean> {
        try {
            const host = this.detectHostIde();
            const profile = HOST_PROFILES[host];
            const command = await this.resolveChatCommand(host);

            if (!command) {
                this.outputChannel.appendLine(
                    `[IdeChatProvider] No chat command available for ${profile.label} — cannot dispatch`
                );
                vscode.window.showWarningMessage(
                    `SpecKit Companion couldn't find a built-in AI chat to open in this editor. ${SWITCH_TO_CLI_HINT}`
                );
                return false;
            }

            const chatQuery = await this.buildChatQuery(prompt, host);
            const ready = await this.isWorkspaceSpecKitReady();
            this.outputChannel.appendLine(
                `[IdeChatProvider] Host: ${profile.label} — dispatching via "${command}" (spec-kit ready: ${ready})`
            );

            if (!ready) {
                void this.warnSpecKitNotReady(host);
            }

            if (profile.clipboardFallback) {
                try {
                    await vscode.env.clipboard.writeText(chatQuery);
                } catch (clipErr) {
                    this.outputChannel.appendLine(`[IdeChatProvider] Clipboard write failed: ${clipErr}`);
                }
                // Open with isPartialQuery:false — the host won't open in partial
                // mode. The query is dropped either way; the clipboard carries it.
                await vscode.commands.executeCommand(command, { query: chatQuery, isPartialQuery: false });
                this.outputChannel.appendLine(`[IdeChatProvider] Copied command to clipboard for ${profile.label} (host drops the query arg)`);
                // Suppress the paste guidance when not ready — the readiness
                // warning already says the command won't be recognized.
                if (ready) {
                    vscode.window.showInformationMessage(
                        `SpecKit command copied — paste it into ${profile.label} (⌘V / Ctrl+V) and press Enter.`
                    );
                }
                return true;
            }

            // isPartialQuery:!ready — auto-submit when ready (Copilot), else prefill
            // so an unrecognized command isn't fired. Cursor ignores the flag and
            // always prefills; the user presses Enter.
            await vscode.commands.executeCommand(command, { query: chatQuery, isPartialQuery: !ready });
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`[IdeChatProvider] ERROR dispatching to chat: ${error}`);
            vscode.window.showWarningMessage(
                `SpecKit Companion couldn't open the editor's AI chat: ${error}. ${SWITCH_TO_CLI_HINT}`
            );
            return false;
        }
    }

    /**
     * A chat target is "installed" when one of the host's candidate commands is
     * registered. Never throws.
     */
    async isInstalled(): Promise<boolean> {
        const host = this.detectHostIde();
        return (await this.resolveChatCommand(host)) !== undefined;
    }

    getPermissionFlag(): string {
        return '';
    }

    /**
     * Dispatch the assembled prompt to the host editor's chat. Returns
     * `undefined` (no terminal) — call sites tolerate this via the widened
     * IAIProvider return type.
     */
    async executeInTerminal(prompt: string, _title?: string): Promise<vscode.Terminal | undefined> {
        await this.dispatchToChat(prompt);
        return undefined;
    }

    /**
     * Headless has no chat analog — degrade to the interactive chat path and
     * report a non-failure exit code (`undefined`), which callers already treat
     * as success.
     */
    async executeHeadless(prompt: string): Promise<AIExecutionResult> {
        await this.dispatchToChat(prompt);
        return { exitCode: undefined };
    }

    /**
     * Slash commands have no terminal analog for chat — route the command text
     * to the host chat like any other prompt. Returns `undefined`.
     */
    async executeSlashCommand(command: string, _title?: string, _autoExecute?: boolean): Promise<vscode.Terminal | undefined> {
        await this.dispatchToChat(command);
        return undefined;
    }
}
