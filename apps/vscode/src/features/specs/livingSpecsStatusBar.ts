import * as path from 'path';
import * as vscode from 'vscode';
import { claimsForFile, LIVING_SPECS_REL, type FileClaim } from './livingSpecsModel';

/**
 * "Which durable rules describe the file I am editing?" — answered in the
 * status bar for the active editor, and answered again as a picker that opens
 * the requirement itself.
 *
 * The whole thing runs in this process: reading the registry and matching a
 * path against a handful of globs costs less than a millisecond, and this fires
 * on every editor change, so dispatching a command here would be the wrong
 * shape as well as the wrong cost.
 */

const PICK_COMMAND = 'speckit.livingSpecs.forFile';

/** Claims for whatever is in the active editor, or none. */
function claimsForActiveEditor(): { root: string; relPath: string; claims: FileClaim[] } | null {
    const editor = vscode.window.activeTextEditor;
    // No repo-relative path (untitled, output channel) means nothing to claim.
    if (!editor || editor.document.uri.scheme !== 'file') {
        return null;
    }
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) {
        return null;
    }
    const root = folder.uri.fsPath;
    const relPath = path.relative(root, editor.document.uri.fsPath).replace(/\\/g, '/');
    const claims = claimsForFile(root, relPath);
    return claims.length > 0 ? { root, relPath, claims } : null;
}

interface RequirementPick extends vscode.QuickPickItem {
    specPath?: string;
    requirement?: string;
}

function buildPicks(claims: FileClaim[]): RequirementPick[] {
    const items: RequirementPick[] = [];
    for (const claim of claims) {
        items.push({ label: claim.capability, kind: vscode.QuickPickItemKind.Separator });
        if (!claim.exists || !claim.readable) {
            items.push({
                label: claim.exists
                    ? `$(warning) ${claim.capability}'s spec could not be read`
                    : `$(warning) ${claim.capability} has no spec file on disk`,
            });
            continue;
        }
        for (const heading of claim.requirements) {
            items.push({
                label: heading,
                description: claim.specPath,
                specPath: claim.specPath,
                requirement: heading,
            });
        }
        // A separator with nothing under it is a dead end; always offer a way in.
        if (claim.requirements.length === 0) {
            items.push({
                label: `$(book) Open ${claim.capability}`,
                description: claim.specPath,
                specPath: claim.specPath,
            });
        }
    }
    return items;
}

async function pickForActiveFile(): Promise<void> {
    const found = claimsForActiveEditor();
    if (!found) {
        return;
    }
    const picked = await vscode.window.showQuickPick(buildPicks(found.claims), {
        title: `Living specs for ${found.relPath}`,
        placeHolder: 'Open a requirement that describes this file',
        matchOnDescription: true,
    });
    if (!picked?.specPath) {
        return;
    }
    await vscode.commands.executeCommand(
        'speckit.viewSpecDocument',
        path.join(found.root, picked.specPath),
        { living: true, requirement: picked.requirement },
    );
}

/**
 * Register the indicator and its picker. Hidden whenever the active file is
 * claimed by nothing — a persistent "0 living specs" is noise in a bar that
 * competes for a few hundred pixels, and absence already reads correctly.
 */
export function registerLivingSpecsStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    item.command = PICK_COMMAND;

    const refresh = (): void => {
        const found = claimsForActiveEditor();
        if (!found) {
            item.hide();
            return;
        }
        const count = found.claims.length;
        item.text = `$(book) ${count} living spec${count === 1 ? '' : 's'}`;
        item.tooltip = `${found.relPath} is described by: ${found.claims.map(c => c.capability).join(', ')}`;
        item.show();
    };

    context.subscriptions.push(
        item,
        vscode.commands.registerCommand(PICK_COMMAND, pickForActiveFile),
        vscode.window.onDidChangeActiveTextEditor(refresh),
        // The registry is a file like any other: edit it and the claims change.
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (path.basename(doc.uri.fsPath) === LIVING_SPECS_REL) refresh();
        }),
    );
    refresh();
    return item;
}

// Named apart from the model's own `__test`: the barrel re-exports both.
export const __statusBarTest = { buildPicks, claimsForActiveEditor };
