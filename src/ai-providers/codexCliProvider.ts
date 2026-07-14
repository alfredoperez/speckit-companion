import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';
import { createTempFile } from '../core/utils/tempFileUtils';
import { CliTerminalProvider, DispatchContext, DispatchPlan } from './cliTerminalProvider';
import { readInitOptions } from './initOptions';
import { buildCodexExecCommand } from './codexCommandBuilder';
import { resolveCodexPrompt } from './codexPromptResolver';

/**
 * Codex CLI provider — `<script> codex exec - < <tmp>`.
 *
 * Two divergences from the default `CliTerminalProvider` dispatch:
 *
 *   1. The command line is built by `buildCodexExecCommand`, not the shared
 *      `buildPromptDispatchCommand`. Codex streams the prompt into `codex
 *      exec -` via a shell pipe, with an optional pre-script wrapper read
 *      from `initOptions`.
 *   2. When the prompt carries a SpecKit slash command (e.g. `/speckit.specify`,
 *      `/speckit.companion.plan`), the command is replaced by the *template*
 *      spec-kit emitted for Codex, with `$ARGUMENTS` substituted in Node — the
 *      context preamble, when present, still leads. Unresolvable commands fall
 *      back to a short instructional wrapper.
 *
 * Everything else (install check, terminal lifecycle, cleanup) is inherited.
 */
export class CodexCliProvider extends CliTerminalProvider {
    public readonly name = 'Codex CLI';
    public readonly type = AIProviders.CODEX;

    protected readonly cliBinary = 'codex';
    protected readonly installHint = {
        displayName: 'Codex CLI',
        installCommand: 'npm install -g @openai/codex',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Codex CLI';
    protected readonly headlessTerminalName = 'Codex CLI Background';
    protected readonly logPrefix = 'Codex';

    protected async prepareDispatch(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): Promise<DispatchPlan> {
        const rawPrompt = ctx.slashCommand ?? ctx.prompt;
        const fallback = ctx.slashCommand
            ? `Run the following SpecKit command: ${ctx.slashCommand}`
            : ctx.prompt;
        const resolution = resolveCodexPrompt(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            rawPrompt,
            fallback,
        );
        if (resolution.error) {
            this.outputChannel.appendLine(`[Codex] Failed to read prompt template: ${resolution.error}. Falling back.`);
        }
        const resolvedPrompt = resolution.text;

        const filePrefix =
            ctx.mode === 'headless' ? 'background-prompt'
            : ctx.mode === 'slash' ? 'slash-prompt'
            : 'prompt';

        // Codex needs LF line endings regardless of the host shell — normalize
        // before the temp file lands on disk.
        const normalized = resolvedPrompt.replace(/\r\n/g, '\n');
        const tempFilePath = await createTempFile(this.context, normalized, filePrefix, true);

        const { script } = readInitOptions(this.outputChannel);
        const commandLine = buildCodexExecCommand({
            script,
            promptFilePath: tempFilePath,
            permissionFlag: this.getPermissionFlag(),
        });
        this.outputChannel.appendLine(`[codex] script=${script} (init-options)`);

        return { commandLine, tempFiles: [tempFilePath] };
    }
}
