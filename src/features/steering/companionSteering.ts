import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

const COMPANION_CONFIG_REL = '.specify/companion.yml';
const COMPANION_MANIFEST_REL = '.specify/extensions/companion/extension.yml';

export interface CompanionCommand {
    name: string;
    description: string;
}

/** Top-level setting groups of `.specify/companion.yml`; `[]` when absent or unparseable. */
export function readCompanionConfigGroups(workspaceRoot: string): string[] {
    const file = path.join(workspaceRoot, COMPANION_CONFIG_REL);
    try {
        const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return [];
        }
        return Object.keys(parsed as Record<string, unknown>);
    } catch {
        return [];
    }
}

/** `provides.commands` from the installed extension manifest; `[]` when absent or malformed. */
export function readCompanionCommands(workspaceRoot: string): CompanionCommand[] {
    const file = path.join(workspaceRoot, COMPANION_MANIFEST_REL);
    try {
        const parsed = yaml.load(fs.readFileSync(file, 'utf8')) as
            | { provides?: { commands?: unknown } }
            | undefined;
        const commands = parsed?.provides?.commands;
        if (!Array.isArray(commands)) {
            return [];
        }
        return commands
            .filter((c): c is { name: string; description?: unknown } =>
                !!c && typeof c === 'object' && typeof (c as { name?: unknown }).name === 'string')
            .map(c => ({
                name: c.name,
                description: typeof c.description === 'string' ? c.description : '',
            }));
    } catch {
        return [];
    }
}

/** True when `candidatePath` resolves inside `workspaceRoot` (guards `..`/absolute escapes). */
export function isWithinRoot(workspaceRoot: string, candidatePath: string): boolean {
    const rel = path.relative(workspaceRoot, path.resolve(workspaceRoot, candidatePath));
    // `rel === ''` is the root itself (within). Reject only real parent traversal
    // (`..` or `../…`), not an in-root name that merely starts with `..` (`..config`).
    return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

export const COMPANION_STEERING_PATHS = {
    config: COMPANION_CONFIG_REL,
    manifest: COMPANION_MANIFEST_REL,
} as const;
