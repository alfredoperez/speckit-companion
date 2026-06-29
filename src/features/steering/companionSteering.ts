import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

const COMPANION_CONFIG_REL = '.specify/companion.yml';
const COMPANION_MANIFEST_REL = '.specify/extensions/companion/extension.yml';

export interface CompanionCommand {
    name: string;
    description: string;
    /** Manifest `file:` for the command body, relative to the extension dir (e.g. `commands/x.md`); `''` when absent. */
    file: string;
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
            .filter((c): c is { name: string; description?: unknown; file?: unknown } =>
                !!c && typeof c === 'object' && typeof (c as { name?: unknown }).name === 'string')
            .map(c => ({
                name: c.name,
                description: typeof c.description === 'string' ? c.description : '',
                file: typeof c.file === 'string' ? c.file : '',
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

/** Absolute path to a command's body file under the installed extension dir, or `undefined` if absent/escaping/missing. */
export function companionCommandFilePath(workspaceRoot: string, file: string): string | undefined {
    if (!file) {
        return undefined;
    }
    const extDir = path.dirname(COMPANION_MANIFEST_REL);
    const abs = path.join(workspaceRoot, extDir, file);
    if (!isWithinRoot(workspaceRoot, abs) || !fs.existsSync(abs)) {
        return undefined;
    }
    return abs;
}

export const COMPANION_STEERING_PATHS = {
    config: COMPANION_CONFIG_REL,
    manifest: COMPANION_MANIFEST_REL,
} as const;
