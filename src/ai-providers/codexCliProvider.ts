import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AIProviders } from '../core/constants';
import { createTempFile } from '../core/utils/tempFileUtils';
import { CliTerminalProvider, DispatchContext, DispatchPlan } from './cliTerminalProvider';
import { readInitOptions } from './initOptions';
import { buildCodexExecCommand } from './codexCommandBuilder';

/**
 * Codex CLI provider — `<script> codex exec - < <tmp>`.
 *
 * Two divergences from the default `CliTerminalProvider` dispatch:
 *
 *   1. The command line is built by `buildCodexExecCommand`, not the shared
 *      `buildPromptDispatchCommand`. Codex streams the prompt into `codex
 *      exec -` via a shell pipe, with an optional pre-script wrapper read
 *      from `initOptions`.
 *   2. When the prompt is a known SpecKit slash command (e.g.
 *      `/speckit.specify`), the prompt body is the *template* from
 *      `.codex/prompts/<name>.md` with `$ARGUMENTS` substituted in Node —
 *      not the slash text itself. Unknown commands fall back to a short
 *      instructional wrapper.
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
        // Slash-command path: try to resolve a SpecKit skill template, else
        // wrap the slash in a short instructional fallback. Other modes pass
        // the prompt straight through to template resolution (no-op when the
        // prompt isn't a slash command).
        const rawPrompt = ctx.slashCommand
            ? ctx.slashCommand
            : ctx.prompt;
        const fallback = ctx.slashCommand
            ? `Run the following SpecKit command: ${ctx.slashCommand}`
            : ctx.prompt;
        const resolvedPrompt = this.resolvePromptText(rawPrompt, fallback);

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

    // ─── Codex-specific skill-template resolution ─────────────────────────

    private parseSlashCommand(prompt: string): { skillName: string; args: string } | null {
        const firstLine = prompt.split('\n')[0].trim();
        const match = firstLine.match(/^\/(speckit[.\-]\w+)\s*(.*)$/);
        if (!match) return null;
        return { skillName: match[1], args: match[2]?.trim() || '' };
    }

    private getPromptFileAbsolutePath(skillName: string): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;
        const normalized = skillName.replace(/^speckit-/, 'speckit.');
        const promptPath = path.join(workspaceFolder.uri.fsPath, '.codex', 'prompts', `${normalized}.md`);
        return fs.existsSync(promptPath) ? promptPath : null;
    }

    private resolvePromptText(rawPrompt: string, fallback: string): string {
        const parsed = this.parseSlashCommand(rawPrompt.trim());
        if (!parsed) return fallback;

        const promptFilePath = this.getPromptFileAbsolutePath(parsed.skillName);
        if (!promptFilePath) return fallback;

        try {
            const template = fs.readFileSync(promptFilePath, 'utf8');
            return template.replace(/\$ARGUMENTS/g, parsed.args);
        } catch (e) {
            this.outputChannel.appendLine(`[Codex] Failed to read skill prompt ${promptFilePath}: ${e}. Falling back.`);
            return fallback;
        }
    }
}
