import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { runInTerminal } from '../core/utils/terminalUtils';
import { CLI_PREREQ_COMMAND } from './specKitExtensionInstall';

export type ProcessExtensionId = 'bug' | 'assess';

export const PROCESS_EXTENSION_IDS: readonly ProcessExtensionId[] = ['bug', 'assess'];

export function coerceProcessExtensionId(value: unknown): ProcessExtensionId | undefined {
    return PROCESS_EXTENSION_IDS.find(id => id === value);
}

export type ProcessExtensionState = 'present' | 'absent' | 'unknown';

export function processExtensionState(root: string, id: ProcessExtensionId): ProcessExtensionState {
    try {
        return fs.statSync(path.join(root, '.specify', 'extensions', id)).isDirectory() ? 'present' : 'absent';
    } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        return code === 'ENOENT' || code === 'ENOTDIR' ? 'absent' : 'unknown';
    }
}

/** The author spec-kit writes in the manifests of the extensions it bundles. */
export const BUNDLED_AUTHOR = 'spec-kit-core';

const MAX_MANIFEST_BYTES = 256 * 1024;

export interface ProcessExtensionInfo {
    state: ProcessExtensionState;
    /** The registry lists it with `enabled: false`; its files stay, its commands don't run. */
    disabled: boolean;
    /** Same id, but the manifest names an author other than spec-kit. */
    foreign: boolean;
    version?: string;
    author?: string;
    manifestPath?: string;
}

function readSmall(filePath: string): string | undefined {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile() && stat.size <= MAX_MANIFEST_BYTES ? fs.readFileSync(filePath, 'utf-8') : undefined;
    } catch {
        return undefined;
    }
}

function field(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Whether an installed process extension is turned off or a same-id extension from another author. Unreadable files read as the bundled one, turned on. */
export function processExtensionInfo(root: string, id: ProcessExtensionId): ProcessExtensionInfo {
    const state = processExtensionState(root, id);
    const info: ProcessExtensionInfo = { state, disabled: false, foreign: false };
    if (state !== 'present') return info;

    let entry: Record<string, unknown> | undefined;
    try {
        const registry = JSON.parse(readSmall(path.join(root, '.specify', 'extensions', '.registry')) ?? 'null');
        const listed = registry?.extensions && Object.prototype.hasOwnProperty.call(registry.extensions, id) ? registry.extensions[id] : undefined;
        if (listed && typeof listed === 'object' && !Array.isArray(listed)) entry = listed;
    } catch {
        entry = undefined;
    }
    info.disabled = entry?.enabled === false;

    const manifestPath = path.join(root, '.specify', 'extensions', id, 'extension.yml');
    let manifest: Record<string, unknown> | undefined;
    try {
        const parsed = yaml.load(readSmall(manifestPath) ?? '') as { extension?: unknown } | undefined;
        const block = parsed?.extension;
        if (block && typeof block === 'object' && !Array.isArray(block)) manifest = block as Record<string, unknown>;
    } catch {
        manifest = undefined;
    }
    if (manifest) info.manifestPath = manifestPath;
    const version = field(manifest?.version) ?? field(entry?.version);
    const author = field(manifest?.author);
    if (version) info.version = version;
    if (author) info.author = author;
    info.foreign = author !== undefined && author !== BUNDLED_AUTHOR;
    return info;
}

/** Runs `specify extension enable <id>` in a terminal at the project folder. */
export async function runSpecifyExtensionEnable(id: ProcessExtensionId, root: string | undefined): Promise<vscode.Terminal | undefined> {
    if (!root) return undefined;
    const terminal = vscode.window.createTerminal({ name: `Turn on Spec Kit ${id} extension`, cwd: root });
    terminal.show();
    await runInTerminal(terminal, `specify extension enable ${id}`);
    return terminal;
}

const installing = new Map<ProcessExtensionId, vscode.Terminal>();

export function _resetForTests(): void {
    installing.clear();
}

export async function runSpecifyExtensionAdd(
    id: ProcessExtensionId,
    root: string | undefined,
): Promise<vscode.Terminal | undefined> {
    if (!root) return undefined;
    // A terminal still open from an earlier try is reused, so a retry runs there instead of piling up terminals.
    const open = installing.get(id);
    const terminal = open && open.exitStatus === undefined
        ? open
        : vscode.window.createTerminal({ name: `Install Spec Kit ${id} extension`, cwd: root });
    installing.set(id, terminal);
    terminal.show();
    if (terminal !== open) {
        await runInTerminal(terminal, `echo "Prerequisite (github-source spec-kit CLI): ${CLI_PREREQ_COMMAND}"`);
    }
    // --force: the registry can still list an extension whose folder is gone, and a plain add would refuse.
    await runInTerminal(terminal, `specify extension add ${id} --force`);
    return terminal;
}
