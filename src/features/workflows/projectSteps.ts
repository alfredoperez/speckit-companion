/**
 * Reading a project's own Companion steps.
 *
 * A project adds a step by writing `.specify/companion/nodes/<step>/` — the
 * same directory shape the shipped steps use, which is why the spec-kit half
 * already builds a command for it and accepts a run of it into the recorded
 * history. This module is the VS Code half of that: it reads those directories
 * so the rail can draw the pipeline the project actually runs.
 *
 * Nothing here throws. A missing, unreadable or malformed directory yields an
 * empty list or omits just that entry (FR-007).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Where an added step is declared, relative to the workspace root. */
export const PROJECT_NODES_REL = '.specify/companion/nodes';

/** The file inside a step directory that carries its placement. */
export const ORDER_FILE = '_order.yml';

/** The file inside a step directory that carries its label. */
export const FRAME_FILE = '_frame.md';

/** The shipped steps an added step may be placed behind. */
export const PLACEABLE_AFTER: readonly string[] = ['specify', 'plan', 'tasks', 'implement'];

/** Names a project step may not take — the shipped definition stands. */
const RESERVED_NAMES: ReadonlySet<string> = new Set([
    ...PLACEABLE_AFTER,
    'mark-complete',
    'auto',
    // Lifecycle names: positional inference would draw a completed mark on a step that never ran.
    'clarify',
    'analyze',
]);

/** The shape the builder enforces when it creates the directory. */
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** One step a project added, as read off disk. Nothing writes this. */
export interface ProjectStep {
    /** Directory name under `.specify/companion/nodes/`. */
    name: string;
    /** From `description:` in `_frame.md`, else the name made readable. */
    label: string;
    /** From `after:` in `_order.yml`. Empty when the step declares no placement. */
    after: string;
    /** From a node's `writes:`. Empty when the step produces no document. */
    writes: string;
}

export function readText(file: string): string | undefined {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}

/** First `<key>: value` at the start of a line, unquoted. Comments skipped. */
function scalar(text: string, key: string): string {
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        if (line.startsWith(`${key}:`)) {
            return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
        }
    }
    return '';
}

function readWrites(dir: string, entries: string[]): string {
    for (const entry of entries) {
        if (!entry.endsWith('.md') || entry === FRAME_FILE) continue;
        const text = readText(path.join(dir, entry));
        const writes = text ? scalar(text, 'writes') : '';
        if (writes) return writes;
    }
    return '';
}

/**
 * Every valid step directory under `<root>/.specify/companion/nodes/`, ordered
 * by directory name.
 */
export function readProjectSteps(root: string | undefined): ProjectStep[] {
    if (!root) return [];
    const base = path.join(root, PROJECT_NODES_REL);
    let names: string[];
    try {
        names = fs.readdirSync(base).sort();
    } catch {
        return [];
    }

    const steps: ProjectStep[] = [];
    for (const name of names) {
        if (RESERVED_NAMES.has(name) || !NAME_PATTERN.test(name)) continue;
        const dir = path.join(base, name);
        const order = readText(path.join(dir, ORDER_FILE));
        if (order === undefined) continue;

        let entries: string[];
        try {
            entries = fs.readdirSync(dir).sort();
        } catch {
            continue;
        }

        const frame = readText(path.join(dir, FRAME_FILE)) ?? '';
        steps.push({
            name,
            label: scalar(frame, 'description') || name.replace(/-/g, ' '),
            after: scalar(order, 'after'),
            writes: readWrites(dir, entries),
        });
    }
    return steps;
}
