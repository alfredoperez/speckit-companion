import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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
