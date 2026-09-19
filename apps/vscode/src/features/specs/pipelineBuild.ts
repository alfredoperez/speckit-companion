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
import { needsBuild } from '../../protocol/pipeline';

export const COMPANION_CONFIG_REL = path.join('.specify', 'companion.yml');
export const BUILT_COMMANDS_REL = path.join('.specify', 'extensions', 'companion', 'commands');

/**
 * Everything a build reads, beside the configuration.
 *
 * A node you rewrote, a workflow you switched to, a fragment or a template you
 * wrote: the build folds all of them into the command bodies, so any one of
 * them being newer than the build leaves the assistant reading something out of
 * date. Comparing the configuration alone reported `current` in exactly the
 * case this panel makes easiest — editing a node, which writes a file here and
 * nothing at all to `companion.yml`.
 */
const BUILD_INPUT_DIRS = [
    path.join('.specify', 'companion', 'nodes'),
    path.join('.specify', 'companion', 'workflows'),
    path.join('.specify', 'companion', 'fragments'),
    // The templates a build reshapes are spec-kit's own, not a Companion copy.
    path.join('.specify', 'templates'),
];

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

/** The newest write across every build input, walking each directory once. */
function newestInputTime(workspaceRoot: string): number | null {
    let newest: number | null = null;
    const walk = (dir: string) => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const here = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(here); continue; }
            const stamp = mtime(here);
            if (stamp !== null && (newest === null || stamp > newest)) { newest = stamp; }
        }
    };
    for (const rel of BUILD_INPUT_DIRS) { walk(path.join(workspaceRoot, rel)); }
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
    const configAt = mtime(path.join(workspaceRoot, COMPANION_CONFIG_REL));
    const inputsAt = newestInputTime(workspaceRoot);
    // A project with a rewritten node and no configuration file is configured:
    // the build has something of this project's to fold in, and saying
    // "unconfigured" told the reader their edit was not there.
    const configuredAt = configAt === null ? inputsAt : Math.max(configAt, inputsAt ?? configAt);
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
