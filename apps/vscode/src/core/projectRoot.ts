import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigKeys } from './constants';

const MARKERS = [
    '.specify',
    path.join('.github', 'agents', 'speckit.specify.agent.md'),
    path.join('.github', 'agents', 'speckit.plan.agent.md'),
];
const DEFAULT_SPEC_DIRECTORIES = ['specs', '.specify/specs'];
const CACHE_MS = 1000;
const SETTING = ConfigKeys.projectFolder.slice(ConfigKeys.namespace.length + 1);

type Picked = 'setting' | 'marker' | 'specs' | 'first';

interface Resolution {
    root: string | undefined;
    uri?: vscode.Uri;
    picked?: Picked;
    alsoQualify: string[];
    settingMiss?: string;
    unreadable: string[];
}

/** true = there, false = absent, undefined = could not tell. */
function probe(target: string): boolean | undefined {
    try {
        fs.statSync(target);
        return true;
    } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code;
        return code === 'ENOENT' || code === 'ENOTDIR' ? false : undefined;
    }
}

/** What marks a folder as a Spec Kit project. The detector reads the same answer. */
export function hasSpecKitMarker(root: string): boolean {
    return MARKERS.some(marker => probe(path.join(root, marker)) === true);
}

function configuredFolder(): string {
    const value = vscode.workspace.getConfiguration(ConfigKeys.namespace).get<unknown>(SETTING);
    return typeof value === 'string' ? value.trim() : '';
}

/** The fixed leading part of each configured spec directory: `openspec/changes/*` gives `openspec/changes`. */
function specDirectoryBases(): string[] {
    const configured = vscode.workspace.getConfiguration(ConfigKeys.namespace).get<unknown>('specDirectories');
    const patterns = Array.isArray(configured) && configured.every(p => typeof p === 'string')
        ? (configured as string[])
        : DEFAULT_SPEC_DIRECTORIES;
    const bases = patterns.map(pattern => {
        const segments = pattern.split('/');
        const wildcard = segments.findIndex(segment => /[*?{[]/.test(segment));
        return (wildcard === -1 ? segments : segments.slice(0, wildcard)).join(path.sep);
    });
    return [...new Set(bases.filter(Boolean))];
}

function samePath(a: string, b: string): boolean {
    const [left, right] = [path.resolve(a), path.resolve(b)];
    return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function resolve(): Resolution {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const none: Resolution = { root: undefined, alsoQualify: [], unreadable: [] };
    if (folders.length === 0) return none;

    const wanted = configuredFolder();
    if (wanted) {
        const match = folders.find(
            f => f.name === wanted || (path.isAbsolute(wanted) && samePath(f.uri.fsPath, wanted)),
        );
        if (match) return { ...none, root: match.uri.fsPath, uri: match.uri, picked: 'setting' };
    }
    const settingMiss = wanted || undefined;
    if (folders.length === 1) {
        return { ...none, root: folders[0].uri.fsPath, uri: folders[0].uri, picked: 'first', settingMiss };
    }

    const unreadable: string[] = [];
    const holding = (entries: string[]): vscode.WorkspaceFolder[] =>
        folders.filter(folder => {
            const root = folder.uri.fsPath;
            const probes = entries.map(entry => probe(path.join(root, entry)));
            if (probes.includes(true)) return true;
            if (probes.includes(undefined) && !unreadable.includes(root)) unreadable.push(root);
            return false;
        });
    const pick = (found: vscode.WorkspaceFolder[], picked: Picked): Resolution => ({
        root: found[0].uri.fsPath,
        uri: found[0].uri,
        picked,
        alsoQualify: found.slice(1).map(f => f.uri.fsPath),
        settingMiss,
        unreadable,
    });

    const withMarker = holding(MARKERS);
    if (withMarker.length > 0) return pick(withMarker, 'marker');
    const withSpecs = holding(specDirectoryBases());
    if (withSpecs.length > 0) return pick(withSpecs, 'specs');
    return pick([folders[0]], 'first');
}

let cached: { key: string; at: number; resolution: Resolution } | undefined;
let noticeDrift: ((resolution: Resolution) => void) | undefined;

/** One resolve per second in a multi-root window, so a tree of rows costs one set of disk probes. */
function current(): Resolution {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length < 2) return resolve();
    // VS Code hands back a fresh array on every read, so the key is the folders' paths.
    const key = folders.map(f => f.uri.fsPath).join('\n');
    const now = Date.now();
    if (cached && cached.key === key && now - cached.at < CACHE_MS) return cached.resolution;
    const resolution = resolve();
    cached = { key, at: now, resolution };
    noticeDrift?.(resolution);
    return resolution;
}

/** The one workspace folder Companion treats as the Spec Kit project. */
export function getProjectRoot(): string | undefined {
    return current().root;
}

export function getProjectRootUri(): vscode.Uri | undefined {
    return current().uri;
}

const changed = new vscode.EventEmitter<string | undefined>();

/** Fires with the new project folder when a setting or workspace-folder change moves it. */
export const onDidChangeProjectRoot = changed.event;

const PICKED_BY: Record<Picked, string> = {
    setting: `the ${ConfigKeys.projectFolder} setting`,
    marker: 'its Spec Kit files',
    specs: 'its specs folder',
    first: 'being the first folder',
};

function report(resolution: Resolution, outputChannel: vscode.OutputChannel): void {
    if (resolution.settingMiss) {
        outputChannel.appendLine(
            `[SpecKit] ${ConfigKeys.projectFolder} names "${resolution.settingMiss}", which is not a folder in this workspace. Falling back to detection.`,
        );
    }
    for (const root of resolution.unreadable) {
        outputChannel.appendLine(`[SpecKit] Could not read ${root} while looking for the project folder, so it was skipped.`);
    }
    if (!resolution.root || !resolution.picked) return;
    if ((vscode.workspace.workspaceFolders?.length ?? 0) < 2) return;
    outputChannel.appendLine(`[SpecKit] Project folder: ${resolution.root}, picked by ${PICKED_BY[resolution.picked]}.`);
    if (resolution.alsoQualify.length > 0) {
        outputChannel.appendLine(
            `[SpecKit] Also holding Spec Kit files: ${resolution.alsoQualify.join(', ')}. Set ${ConfigKeys.projectFolder} to choose one.`,
        );
    }
}

/** Re-resolves on a setting or workspace-folder change, logs the pick, and fires when it moved. */
export function watchProjectRoot(outputChannel: vscode.OutputChannel): vscode.Disposable {
    let last = resolve();
    report(last, outputChannel);
    const settle = (next: Resolution): void => {
        if (next.root === last.root) return;
        last = next;
        report(next, outputChannel);
        changed.fire(next.root);
    };
    const recheck = (): void => {
        cached = undefined;
        const next = resolve();
        if (next.root === last.root) {
            report(next, outputChannel);
            last = next;
        }
        settle(next);
    };
    // A marker created on disk (specify init, a checkout) raises no event: the next resolve notices the move.
    noticeDrift = next => queueMicrotask(() => settle(next));
    const subscriptions = [
        vscode.workspace.onDidChangeWorkspaceFolders(recheck),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ConfigKeys.projectFolder) || e.affectsConfiguration(ConfigKeys.specDirectories)) recheck();
        }),
    ];
    return {
        dispose: () => {
            noticeDrift = undefined;
            subscriptions.forEach(s => s.dispose());
        },
    };
}
