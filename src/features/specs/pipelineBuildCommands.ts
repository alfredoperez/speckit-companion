/**
 * Running a pipeline build from the editor.
 *
 * The build itself lives in the spec-kit half (`build-pipeline.py`) — this is the
 * button that runs it and reports what it said. Two commands: preview, which
 * writes nothing, and build, which does.
 *
 * The result goes to the output channel rather than a notification, because a
 * build's output is the diff it is about to apply and a toast cannot hold that.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { needsRebuild, readPipelineBuildState } from './pipelineBuild';

/** How long a build may take before it is abandoned. Assembly is fast; a hang is a bug. */
const BUILD_TIMEOUT_MS = 60_000;

export interface BuildOutcome {
    ok: boolean;
    output: string;
}

/**
 * Locate `build-pipeline.py`.
 *
 * Prefers the copy installed in the workspace, since that is the one whose nodes
 * match the project's installed extension. Falls back to the copy bundled with
 * this extension, which is what makes the command work in a repository that
 * develops the spec-kit half rather than consuming it.
 */
export function resolveBuildScript(workspaceRoot: string, extensionPath: string): string | null {
    const candidates = [
        path.join(workspaceRoot, '.specify', 'extensions', 'companion', 'scripts', 'build-pipeline.py'),
        path.join(extensionPath, 'speckit-extension', 'scripts', 'build-pipeline.py'),
    ];
    return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
}

export function runBuild(
    script: string,
    workspaceRoot: string,
    dryRun: boolean,
): Promise<BuildOutcome> {
    const { execFile } = require('child_process');
    const args = [script, '--project', workspaceRoot, ...(dryRun ? ['--dry-run'] : [])];
    return new Promise<BuildOutcome>(resolve => {
        execFile(
            'python3',
            args,
            { cwd: workspaceRoot, timeout: BUILD_TIMEOUT_MS },
            (err: Error | null, stdout: string, stderr: string) => {
                // The script says why it refused on stderr and exits non-zero;
                // both halves are shown, because the reason is the useful part.
                resolve({ ok: !err, output: [stdout, stderr].filter(Boolean).join('\n').trim() });
            },
        );
    });
}

export function registerPipelineBuildCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
): void {
    const build = async (dryRun: boolean): Promise<void> => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            void vscode.window.showWarningMessage('Open a workspace folder to build its pipeline.');
            return;
        }

        const script = resolveBuildScript(workspaceRoot, context.extensionPath);
        if (!script) {
            void vscode.window.showWarningMessage(
                'The pipeline builder is not available — install the companion spec-kit extension.',
            );
            return;
        }

        outputChannel.show(true);
        outputChannel.appendLine(`[Pipeline] ${dryRun ? 'previewing' : 'building'} from companion.yml…`);

        const result = await runBuild(script, workspaceRoot, dryRun);
        outputChannel.appendLine(result.output || '(no output)');

        if (!result.ok) {
            void vscode.window.showErrorMessage(
                'The pipeline could not be built — nothing was written. See the output for the reason.',
            );
            return;
        }
        if (!dryRun) {
            void vscode.window.showInformationMessage('Pipeline built from companion.yml.');
        }
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.companion.buildPipeline', () => build(false)),
        vscode.commands.registerCommand('speckit.companion.previewPipelineBuild', () => build(true)),
    );
}

/**
 * Tell the user once per session when the built pipeline is behind its
 * configuration, with the rebuild one click away.
 *
 * Once, because staleness persists until acted on and a notice that returns on
 * every window focus is one people learn to dismiss without reading.
 */
export async function notifyIfPipelineStale(
    workspaceRoot: string,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    const state = readPipelineBuildState(workspaceRoot);
    if (!needsRebuild(state)) {
        return;
    }
    outputChannel.appendLine(`[Pipeline] ${state.kind === 'stale'
        ? 'companion.yml is newer than the built commands'
        : 'companion.yml has never been built'}`);

    const choice = await vscode.window.showInformationMessage(
        state.kind === 'stale'
            ? 'Your companion.yml changed since the pipeline was last built.'
            : 'Your companion.yml has not been built yet.',
        'Build now',
        'Preview',
    );
    if (choice === 'Build now') {
        await vscode.commands.executeCommand('speckit.companion.buildPipeline');
    } else if (choice === 'Preview') {
        await vscode.commands.executeCommand('speckit.companion.previewPipelineBuild');
    }
}
