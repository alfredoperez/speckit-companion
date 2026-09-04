/**
 * Running a pipeline build from the editor.
 *
 * The build itself lives in the spec-kit half (`build-pipeline.py`) — this is the
 * button that runs it and reports what it said. Two commands: preview, which
 * writes nothing, and build, which does.
 *
 * The output channel keeps the whole log, because a build's output is the diff
 * it is about to apply and a toast cannot hold that. It only takes the screen
 * when something failed: stealing the editor to say a build worked is a cost
 * paid on every successful run for the sake of the rare one that did not.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildReport } from '../../protocol/pipeline';

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

/** How many commands the run said it handled. */
function commandCount(output: string): number {
    const said = /\[build\] (?:would build|built) (\d+) commands?/.exec(output);
    return said ? Number(said[1]) : 0;
}

/**
 * The commands a preview says would change.
 *
 * The script prints one `  name: …` row per command under its heading, and
 * `unchanged` is the one answer that is not a change. A real build prints no
 * such list, so it reports none.
 */
function changedCommands(output: string): string[] {
    const lines = output.split('\n');
    const heading = lines.findIndex(line => line.startsWith('[build] what would change:'));
    if (heading < 0) { return []; }
    const changed: string[] = [];
    for (const line of lines.slice(heading + 1)) {
        const row = /^ {2}(\S+): (.+)$/.exec(line);
        if (row && row[2] !== 'unchanged') { changed.push(row[1]); }
    }
    return changed;
}

/** What the run did, in the shape the panel reports it. */
export function readBuildReport(outcome: BuildOutcome, dryRun: boolean): BuildReport {
    return {
        ok: outcome.ok,
        // `h23` rather than `hour12: false`, which renders midnight as 24:05 in
        // some locales.
        at: new Date().toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }),
        commands: commandCount(outcome.output),
        changed: changedCommands(outcome.output),
        dryRun,
        output: outcome.output,
    };
}

export function registerPipelineBuildCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
): void {
    /**
     * `quiet` is the builder panel, which draws the result itself. The toast is
     * for the palette, where there is no panel and the alternative is silence.
     */
    const build = async (dryRun: boolean, quiet = false): Promise<BuildReport | null> => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            void vscode.window.showWarningMessage('Open a workspace folder to build its pipeline.');
            return null;
        }

        const script = resolveBuildScript(workspaceRoot, context.extensionPath);
        if (!script) {
            void vscode.window.showWarningMessage(
                'The pipeline builder is not available — install the companion spec-kit extension.',
            );
            return null;
        }

        outputChannel.appendLine(`[Pipeline] ${dryRun ? 'previewing' : 'building'} from companion.yml…`);

        const result = await runBuild(script, workspaceRoot, dryRun);
        outputChannel.appendLine(result.output || '(no output)');

        if (!result.ok) {
            outputChannel.show(true);
            void vscode.window.showErrorMessage(
                'The pipeline could not be built — nothing was written. See the output for the reason.',
            );
        } else if (!dryRun && !quiet) {
            void vscode.window.showInformationMessage('Pipeline built from companion.yml.');
        }
        return readBuildReport(result, dryRun);
    };

    type RunOptions = { quiet?: boolean };
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.companion.buildPipeline',
            (options?: RunOptions) => build(false, options?.quiet)),
        vscode.commands.registerCommand('speckit.companion.previewPipelineBuild',
            (options?: RunOptions) => build(true, options?.quiet)),
    );
}
