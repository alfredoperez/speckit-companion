/**
 * Reading the pipeline structure the builder draws.
 *
 * The structure is derived by the spec-kit half, from the same configuration a
 * build works from, so what the builder shows is what a build would produce.
 * Deriving it again here would be a second source that drifts from the first
 * within a release.
 */

import { PipelineGraphResult } from '../../protocol/pipeline';
import { resolveBuildScript } from './pipelineBuildCommands';

/** Long enough for a cold Python start; a hang past this is a bug, not slowness. */
const GRAPH_TIMEOUT_MS = 30_000;

export function resolveGraphScript(workspaceRoot: string, extensionPath: string): string | null {
    const build = resolveBuildScript(workspaceRoot, extensionPath);
    return build ? build.replace(/build-pipeline\.py$/, 'pipeline-graph.py') : null;
}

/**
 * Read the graph, or an error shaped like one.
 *
 * Every failure — no script, Python missing, unparsable output — comes back as
 * a `{ error }` the panel can render. The builder is most useful when something
 * is wrong, so it must never be the thing that fails to open.
 */
export function readPipelineGraph(
    script: string,
    workspaceRoot: string,
): Promise<PipelineGraphResult> {
    const { execFile } = require('child_process');
    return new Promise<PipelineGraphResult>(resolve => {
        execFile(
            'python3',
            [script, '--project', workspaceRoot],
            { cwd: workspaceRoot, timeout: GRAPH_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
            (err: Error | null, stdout: string, stderr: string) => {
                if (err && !stdout) {
                    resolve({ error: stderr?.trim() || `could not read the pipeline: ${err.message}` });
                    return;
                }
                try {
                    resolve(JSON.parse(stdout) as PipelineGraphResult);
                } catch {
                    resolve({ error: 'the pipeline structure could not be read as JSON' });
                }
            },
        );
    });
}
