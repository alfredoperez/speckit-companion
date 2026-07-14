import * as fs from 'fs';
import * as path from 'path';

/**
 * Pure resolution of a SpecKit slash command to the prompt text Codex is fed.
 *
 * Codex has no client-side slash-command registry — the extension pipes raw
 * text into `codex exec -`, so a `/speckit.companion.specify` line only works
 * if the extension itself substitutes the command's body first.
 *
 * spec-kit emits Codex commands as skills (`.agents/skills/<skill>/SKILL.md`);
 * older `specify init --ai codex` workspaces carry the deprecated prompts
 * layout (`.codex/prompts/<command>.md`) instead, so both are searched.
 */

export interface ParsedSlashCommand {
    /** Dotted command id, e.g. `speckit.companion.specify`. */
    commandId: string;
    /** Skill directory name, e.g. `speckit-companion-specify`. */
    skillName: string;
    args: string;
}

const SLASH_COMMAND = /^\/(speckit[.\-][\w.\-]*[\w-])\s*(.*)$/;

export function parseSlashCommand(prompt: string): ParsedSlashCommand | null {
    const firstLine = prompt.split('\n')[0].trim();
    const match = firstLine.match(SLASH_COMMAND);
    if (!match) return null;

    const raw = match[1];
    const suffix = raw.slice('speckit'.length + 1);
    return {
        commandId: `speckit.${suffix.replace(/-/g, '.')}`,
        skillName: `speckit-${suffix.replace(/\./g, '-')}`,
        args: match[2]?.trim() || '',
    };
}

export function findPromptFile(workspaceRoot: string, parsed: ParsedSlashCommand): string | null {
    const candidates = [
        path.join(workspaceRoot, '.agents', 'skills', parsed.skillName, 'SKILL.md'),
        path.join(workspaceRoot, '.codex', 'prompts', `${parsed.commandId}.md`),
    ];
    return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
}

export interface CodexPromptResolution {
    text: string;
    /** Absolute path of the template used, or null when `fallback` was returned. */
    promptFilePath: string | null;
    error?: string;
}

export function resolveCodexPrompt(
    workspaceRoot: string | undefined,
    rawPrompt: string,
    fallback: string,
): CodexPromptResolution {
    const parsed = parseSlashCommand(rawPrompt.trim());
    if (!parsed || !workspaceRoot) {
        return { text: fallback, promptFilePath: null };
    }

    const promptFilePath = findPromptFile(workspaceRoot, parsed);
    if (!promptFilePath) {
        return { text: fallback, promptFilePath: null };
    }

    try {
        const template = fs.readFileSync(promptFilePath, 'utf8');
        return {
            text: template.replace(/\$ARGUMENTS/g, parsed.args),
            promptFilePath,
        };
    } catch (e) {
        return { text: fallback, promptFilePath: null, error: String(e) };
    }
}
