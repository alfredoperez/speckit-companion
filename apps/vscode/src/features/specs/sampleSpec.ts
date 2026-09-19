/**
 * The welcome's "Open a live sample" action: seed the bundled sample spec into
 * the workspace (a copy — the packaged asset is never read in place or mutated)
 * and open it in the spec viewer. Repeat-safe: an existing sample is reopened,
 * never overwritten; without a workspace folder the action explains itself.
 */

import * as vscode from 'vscode';
import { DefaultPaths } from '../../core/constants';
import { reportSampleOpened } from '../../core/telemetry';

/** Directory the sample seeds into, under the workspace's specs/ root. */
export const SAMPLE_SPEC_DIR_NAME = 'sample-command-palette';

/** Location of the bundled sample inside the extension package. */
const BUNDLED_SAMPLE_PATH = ['assets', 'sample-spec'] as const;

async function directoryExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/**
 * Handler for `speckit.openSampleSpec`. Seeds `specs/<sample-dir>` from the
 * bundled asset when absent (`overwrite: false` — an existing directory is
 * never touched), then opens it through the viewer's own `speckit.openSpec`.
 */
export async function openSampleSpec(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        void vscode.window.showErrorMessage(
            'No workspace folder open — open a folder first, then choose "Open a live sample" again.'
        );
        return;
    }

    const target = vscode.Uri.joinPath(workspaceFolder.uri, DefaultPaths.specs, SAMPLE_SPEC_DIR_NAME);
    if (!(await directoryExists(target))) {
        const bundled = vscode.Uri.joinPath(context.extensionUri, ...BUNDLED_SAMPLE_PATH);
        await vscode.workspace.fs.copy(bundled, target, { overwrite: false });
    }

    await vscode.commands.executeCommand('speckit.openSpec', target.fsPath);
    reportSampleOpened();
}
