import * as fs from 'fs';
import * as path from 'path';

export type CommandFormat = 'dot' | 'dash';

/** Skill folders spec-kit writes for an agent that Companion's provider table does not list. */
const AGENT_SKILL_DIRS: Record<string, string[]> = {
    copilot: ['.github/skills'],
};

/** Copilot's own command files, which spec-kit always spells with dots. */
const COPILOT_DOT_FILES = ['.github/agents/speckit.specify.agent.md', '.github/prompts/speckit.specify.prompt.md'];

function recordedSeparator(root: string, agent: string): CommandFormat | undefined {
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(path.join(root, '.specify', 'integration.json'), 'utf-8'));
    } catch {
        return undefined;
    }
    const record = data as { installed_integrations?: unknown; integration_settings?: Record<string, { invoke_separator?: unknown }> } | null;
    if (Array.isArray(record?.installed_integrations) && !record.installed_integrations.includes(agent)) return undefined;
    const settings = record?.integration_settings?.[agent];
    if (settings?.invoke_separator === '-') return 'dash';
    if (settings?.invoke_separator === '.') return 'dot';
    return undefined;
}

function separatorOnDisk(root: string, dirs: string[]): CommandFormat | undefined {
    for (const dir of dirs) {
        if (fs.existsSync(path.join(root, dir, 'speckit-specify', 'SKILL.md'))) return 'dash';
        if (fs.existsSync(path.join(root, dir, 'speckit.specify', 'SKILL.md'))) return 'dot';
    }
    return undefined;
}

/** Copilot with no commands of its own still runs Claude's skills, since Copilot in VS Code reads that folder too. */
function copilotFallback(root: string): CommandFormat | undefined {
    if (COPILOT_DOT_FILES.some(file => fs.existsSync(path.join(root, file)))) return 'dot';
    return separatorOnDisk(root, ['.claude/skills']);
}

/**
 * How this project spells commands for an agent: the separator spec-kit recorded in
 * `.specify/integration.json`, then the skills on disk; undefined when neither says.
 */
export function projectCommandFormat(root: string | undefined, agent: string, skillsDir?: string): CommandFormat | undefined {
    if (!root) return undefined;
    const key = `${root}\0${agent}\0${skillsDir ?? ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.format;
    const dirs = [...(skillsDir ? [skillsDir] : []), ...(AGENT_SKILL_DIRS[agent] ?? [])];
    const format = recordedSeparator(root, agent) ?? separatorOnDisk(root, dirs) ?? (agent === 'copilot' ? copilotFallback(root) : undefined);
    cache.set(key, { at: Date.now(), format });
    return format;
}

// Spelling is asked for once per button and prompt; the record only changes when Spec Kit reinstalls.
const CACHE_MS = 5000;
const cache = new Map<string, { at: number; format: CommandFormat | undefined }>();
