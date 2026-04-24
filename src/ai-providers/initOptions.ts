/**
 * SpecKit init-options helper.
 *
 * Reads `<workspaceRoot>/.specify/init-options.json` to determine which shell
 * family to target when dispatching commands to AI CLI providers. Today only
 * two values are supported:
 *   - `'sh'` — bash-family shells (default).
 *   - `'ps'` — PowerShell.
 *
 * Any unknown shell value (including missing file, invalid JSON, or unrecognized
 * strings like `"bash"`) normalizes to `{ script: 'sh' }`.
 *
 * The result is cached per workspace folder; tests can reset the cache via
 * `resetInitOptionsCache()`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface InitOptions {
    script: 'sh' | 'ps';
}

const DEFAULT_OPTIONS: InitOptions = { script: 'sh' };

const cache = new Map<string, InitOptions>();

/**
 * Read SpecKit init options for the current workspace folder.
 *
 * Synchronous: file is read with `fs.readFileSync` once per workspace and
 * cached thereafter. Errors never throw; they normalize to `{ script: 'sh' }`
 * and (except for ENOENT) log a single warning line to the optional output
 * channel.
 */
export function readInitOptions(outputChannel?: vscode.OutputChannel): InitOptions {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return DEFAULT_OPTIONS;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const cached = cache.get(workspaceRoot);
    if (cached) {
        return cached;
    }

    const filePath = path.join(workspaceRoot, '.specify', 'init-options.json');
    let result: InitOptions = DEFAULT_OPTIONS;

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (
                parsed &&
                typeof parsed === 'object' &&
                (parsed as { script?: unknown }).script === 'ps'
            ) {
                result = { script: 'ps' };
            }
        } catch (parseErr) {
            const reason = parseErr instanceof Error ? parseErr.message : String(parseErr);
            outputChannel?.appendLine(
                `[speckit] Failed to parse .specify/init-options.json at ${workspaceRoot}: ${reason}`
            );
        }
    } catch (readErr) {
        const code = (readErr as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') {
            const reason = readErr instanceof Error ? readErr.message : String(readErr);
            outputChannel?.appendLine(
                `[speckit] Failed to read .specify/init-options.json at ${workspaceRoot}: ${reason}`
            );
        }
    }

    cache.set(workspaceRoot, result);
    return result;
}

/**
 * Clear the in-memory cache. Intended for tests.
 */
export function resetInitOptionsCache(): void {
    cache.clear();
}
