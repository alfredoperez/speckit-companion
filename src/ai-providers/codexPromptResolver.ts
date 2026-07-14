import * as fs from 'fs';
import * as path from 'path';
import { AIProviders } from '../core/constants';
import { PROVIDER_PATHS } from './aiProvider';
import { splitContextPreamble } from './promptBuilder';

/**
 * Resolves a SpecKit slash command to the prompt text Codex is fed.
 *
 * Codex has no client-side slash-command registry — the extension pipes raw
 * text into `codex exec -`, so a `/speckit.companion.specify` line only works
 * if the extension itself substitutes the command's body first.
 *
 * spec-kit emits Codex commands as skills under the provider's registered
 * skills directory; older `specify init --ai codex` workspaces carry the
 * deprecated prompts layout (`.codex/prompts/<command>.md`) instead, so both
 * are searched.
 */

const CODEX_SKILLS_DIR = PROVIDER_PATHS[AIProviders.CODEX].skillsDir;

export interface ParsedSlashCommand {
    /** Skill directory spec-kit emits, e.g. `speckit-companion-mark-complete`. */
    skillName: string;
    args: string;
}

const SLASH_COMMAND = /^\/(speckit[.\-][\w.\-]*[\w\-])(?:\s+([\s\S]*))?$/;

export function parseSlashCommand(command: string): ParsedSlashCommand | null {
    const match = command.trim().match(SLASH_COMMAND);
    if (!match) return null;

    const suffix = match[1].slice('speckit'.length + 1);
    return {
        skillName: `speckit-${suffix.replace(/\./g, '-')}`,
        args: match[2]?.trim() ?? '',
    };
}

function findLegacyPrompt(workspaceRoot: string, skillName: string): string | null {
    const dir = path.join(workspaceRoot, '.codex', 'prompts');
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return null;
    }
    // Prompt files are named by dotted command id whose leaf may itself be hyphenated
    // (`speckit.companion.mark-complete.md`), so match on the skill name both spellings
    // normalize to rather than guessing where the dots went.
    const found = entries.find(
        entry => entry.endsWith('.md') && entry.slice(0, -'.md'.length).replace(/\./g, '-') === skillName,
    );
    return found ? path.join(dir, found) : null;
}

export function findPromptFile(workspaceRoot: string, skillName: string): string | null {
    const skillPath = path.join(workspaceRoot, CODEX_SKILLS_DIR, skillName, 'SKILL.md');
    if (fs.existsSync(skillPath)) return skillPath;
    return findLegacyPrompt(workspaceRoot, skillName);
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
    const { preamble, command } = splitContextPreamble(rawPrompt);
    const parsed = parseSlashCommand(command);
    if (!parsed || !workspaceRoot) {
        return { text: fallback, promptFilePath: null };
    }

    const promptFilePath = findPromptFile(workspaceRoot, parsed.skillName);
    if (!promptFilePath) {
        return { text: fallback, promptFilePath: null };
    }

    try {
        const template = fs.readFileSync(promptFilePath, 'utf8');
        const body = template.replace(/\$ARGUMENTS/g, () => parsed.args);
        return {
            text: preamble ? `${preamble}\n\n${body}` : body,
            promptFilePath,
        };
    } catch (e) {
        return { text: fallback, promptFilePath: null, error: String(e) };
    }
}
