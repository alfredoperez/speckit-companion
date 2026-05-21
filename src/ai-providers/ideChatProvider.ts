import * as vscode from 'vscode';
import { AIProviders, Commands } from '../core/constants';
import { SpecKitDetector } from '../speckit/detector';
import { IAIProvider, AIExecutionResult } from './aiProvider';
import { splitContextPreamble } from './promptBuilder';

/**
 * Host editors that expose a built-in AI chat we can dispatch to.
 * `unknown` means the editor was not recognized — we still try the inherited
 * base chat command before giving up.
 */
type HostIde = 'vscode' | 'cursor' | 'windsurf' | 'unknown';

/**
 * Per-IDE ordered list of candidate chat-open command IDs. The first candidate
 * that actually exists (verified against `vscode.commands.getCommands`) wins.
 *
 * VS Code / Copilot's `workbench.action.chat.open` is documented; Cursor and
 * Windsurf are VS Code forks whose own command IDs are proprietary, so we try
 * the inherited base command first (forks usually keep it) and fall back to
 * known fork-specific candidates.
 */
const CHAT_COMMAND_CANDIDATES: Record<HostIde, readonly string[]> = {
    vscode: ['workbench.action.chat.open'],
    cursor: ['workbench.action.chat.open', 'aichat.newchataction', 'composer.startComposerPrompt'],
    windsurf: ['workbench.action.chat.open', 'windsurf.prioritized.chat.open'],
    unknown: ['workbench.action.chat.open'],
};

const HOST_LABELS: Record<HostIde, string> = {
    vscode: 'VS Code (Copilot Chat)',
    cursor: 'Cursor (Composer)',
    windsurf: 'Windsurf (Cascade)',
    unknown: 'Unknown editor',
};

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
            const available = new Set(await vscode.commands.getCommands(true));
            for (const candidate of CHAT_COMMAND_CANDIDATES[host]) {
                if (available.has(candidate)) {
                    return candidate;
                }
            }
        } catch (error) {
            this.outputChannel.appendLine(`[IdeChatProvider] Failed to enumerate commands: ${error}`);
        }
        return undefined;
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
     * - free-text / multi-token / non-path arguments are left as-is (e.g.
     *   `specify` with a typed feature description);
     * - `specify <temp.md>` (create-new-spec dispatches the description inside a
     *   temp markdown file the chat can't read) is inlined to
     *   `specify <description>`, dropping the appended spec-context bookkeeping;
     * - any other spec-dir path argument is shortened to just the spec name
     *   (the chat resolves the feature by name and it reads far better than an
     *   absolute path).
     */
    private async buildChatQuery(prompt: string): Promise<string> {
        const trimmed = splitContextPreamble(prompt).command.trim();
        const sp = trimmed.indexOf(' ');
        if (sp === -1) return trimmed;
        const cmd = trimmed.slice(0, sp);
        const arg = trimmed.slice(sp + 1).trim();

        if (/\s/.test(arg)) return trimmed;     // free-text / multi-token argument
        if (!/[/\\]/.test(arg)) return trimmed; // not a path

        if (/[.-]specify$/.test(cmd) && /\.md$/i.test(arg)) {
            const description = await this.readSpecDescription(arg);
            if (description) return `${cmd} ${description}`;
        }
        return `${cmd} ${this.specNameFromPath(arg)}`;
    }

    /** The spec name from a path: the last segment, or its parent when it's a doc file. */
    private specNameFromPath(p: string): string {
        const segments = p.split(/[/\\]/).filter(Boolean);
        let name = segments.pop() ?? p;
        if (/\.md$/i.test(name) && segments.length > 0) {
            name = segments.pop()!;
        }
        return name;
    }

    /** Read a specify temp markdown file and return the feature description (sans bookkeeping). */
    private async readSpecDescription(filePath: string): Promise<string | null> {
        try {
            const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            const text = Buffer.from(data).toString('utf-8');
            const marker = text.indexOf('## Post-Specification');
            const body = (marker === -1 ? text : text.slice(0, marker)).trim();
            return body || null;
        } catch {
            return null;
        }
    }

    /** Warn that the host chat won't recognize `/speckit.*` until spec-kit is set up. */
    private async warnSpecKitNotReady(host: HostIde): Promise<void> {
        const init = 'Initialize SpecKit';
        const choice = await vscode.window.showWarningMessage(
            `IDE Chat sends \`/speckit.*\` commands to ${HOST_LABELS[host]}, but spec-kit isn't ` +
            `initialized in this workspace — the chat won't recognize them. Run SpecKit: Initialize Workspace first.`,
            init
        );
        if (choice === init) {
            await vscode.commands.executeCommand(Commands.initWorkspace);
        }
    }

    /**
     * Core dispatch: detect host, resolve a chat command, and open the host's
     * chat with the prompt. Never throws — on no resolvable target it shows a
     * graceful warning and returns false. Auto-submits only when spec-kit is
     * initialized; otherwise it prefills (so an unrecognized command never fires)
     * and warns the user to initialize spec-kit.
     */
    private async dispatchToChat(prompt: string): Promise<boolean> {
        try {
            const host = this.detectHostIde();
            const command = await this.resolveChatCommand(host);

            if (!command) {
                this.outputChannel.appendLine(
                    `[IdeChatProvider] No chat command available for ${HOST_LABELS[host]} — cannot dispatch`
                );
                vscode.window.showWarningMessage(
                    `SpecKit Companion couldn't find a built-in AI chat to open in this editor. ${SWITCH_TO_CLI_HINT}`
                );
                return false;
            }

            // Reduce the built prompt to what the host chat can actually use:
            // strip the context-update preamble, shorten spec-dir paths to the
            // spec name, and inline a specify temp-file description.
            const chatQuery = await this.buildChatQuery(prompt);

            const ready = await this.isWorkspaceSpecKitReady();
            this.outputChannel.appendLine(
                `[IdeChatProvider] Host: ${HOST_LABELS[host]} — dispatching via "${command}" (spec-kit ready: ${ready})`
            );

            if (!ready) {
                void this.warnSpecKitNotReady(host);
            }

            // Auto-submit when spec-kit is ready; otherwise prefill so the user
            // can review/init before an unrecognized command would be sent.
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
