/**
 * Whether the built pipeline still matches the configuration it was built from.
 *
 * A build turns `companion.yml` into the command bodies the assistant reads, so
 * editing the configuration and not rebuilding leaves the two disagreeing — the
 * file says one thing, the command the assistant is handed says another, and
 * nothing about a run looks wrong. That is the failure class this whole area has
 * been closing, so it gets stated rather than left to be noticed.
 *
 * The rule is the one the product already uses for a plan that is older than its
 * spec: compare modified times, and say so when the source is newer.
 */

import * as fs from 'fs';
import * as path from 'path';

export const COMPANION_CONFIG_REL = path.join('.specify', 'companion.yml');
export const BUILT_COMMANDS_REL = path.join('.specify', 'extensions', 'companion', 'commands');

export type PipelineBuildState =
    /** No configuration to build from — the project runs the shipped pipeline. */
    | { kind: 'unconfigured' }
    /** Configured, but nothing has been built from it yet. */
    | { kind: 'never-built'; configuredAt: number }
    /** The built commands are older than the configuration that produced them. */
    | { kind: 'stale'; configuredAt: number; builtAt: number }
    /** Built and current. */
    | { kind: 'current'; builtAt: number };

function mtime(file: string): number | null {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return null;
    }
}

/** The newest build time across the emitted command bodies, or null when none exist. */
function newestBuildTime(commandsDir: string): number | null {
    let newest: number | null = null;
    let entries: string[];
    try {
        entries = fs.readdirSync(commandsDir);
    } catch {
        return null;
    }
    for (const entry of entries) {
        if (!entry.endsWith('.md')) { continue; }
        const stamp = mtime(path.join(commandsDir, entry));
        if (stamp !== null && (newest === null || stamp > newest)) {
            newest = stamp;
        }
    }
    return newest;
}

/**
 * Read the project's build state.
 *
 * Deliberately tolerant: an unreadable directory or a missing file is reported
 * as one of the ordinary states, never thrown. A staleness check that can fail
 * is one that gets wrapped in a try/catch by its caller and then never speaks.
 */
export function readPipelineBuildState(workspaceRoot: string): PipelineBuildState {
    const configuredAt = mtime(path.join(workspaceRoot, COMPANION_CONFIG_REL));
    if (configuredAt === null) {
        return { kind: 'unconfigured' };
    }

    const builtAt = newestBuildTime(path.join(workspaceRoot, BUILT_COMMANDS_REL));
    if (builtAt === null) {
        return { kind: 'never-built', configuredAt };
    }

    // Strictly newer: a build writes after it reads, so equal stamps mean the
    // build is the later event and the pipeline is current.
    return configuredAt > builtAt
        ? { kind: 'stale', configuredAt, builtAt }
        : { kind: 'current', builtAt };
}

/** Whether the user should be told to rebuild. */
export function needsRebuild(state: PipelineBuildState): boolean {
    return state.kind === 'stale' || state.kind === 'never-built';
}

/** One line for the sidebar, or null when there is nothing worth saying. */
export function describeBuildState(state: PipelineBuildState): string | null {
    switch (state.kind) {
        case 'stale':
            return 'Pipeline needs rebuilding — companion.yml changed since the last build';
        case 'never-built':
            return 'Pipeline not built yet — companion.yml has never been applied';
        case 'current':
        case 'unconfigured':
            return null;
    }
}
