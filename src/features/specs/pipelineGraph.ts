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

export function resolveConfigWriteScript(
    workspaceRoot: string,
    extensionPath: string,
): string | null {
    const build = resolveBuildScript(workspaceRoot, extensionPath);
    return build ? build.replace(/build-pipeline\.py$/, 'config_write.py') : null;
}

export function resolveConfigRepairScript(
    workspaceRoot: string,
    extensionPath: string,
): string | null {
    const build = resolveBuildScript(workspaceRoot, extensionPath);
    return build ? build.replace(/build-pipeline\.py$/, 'config_repair.py') : null;
}

/**
 * Carry out one repair on a configuration the builder could not read.
 *
 * Shaped like every other write here — the reason on refusal, null on success —
 * so the panel reports a repair that did not work the same way it reports an
 * edit that was rejected.
 */
export function applyRepair(
    script: string,
    workspaceRoot: string,
    repairId: string,
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot, ['--apply', repairId]);
}

/**
 * Save a step's node order into the project's `companion.yml`.
 *
 * The script refuses an order the pipeline cannot honour — a node moved across a
 * phase boundary, or before something it reads — and writes nothing when it
 * does, so a rejected drag leaves the configuration exactly as it was. Returns
 * the reason on refusal, or null on success.
 */
export function writeNodeOrder(
    script: string,
    workspaceRoot: string,
    command: string,
    order: string[],
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot,
        ['--command', command, '--nodes', order.join(',')]);
}

/** What one hook needs to be written. `ref` names a node or a skill. */
export interface HookDraft {
    type: 'command' | 'prompt' | 'node' | 'skill';
    when: 'before' | 'after';
    anchor: string;
    ref?: string;
    run?: string;
    text?: string;
    /** Replace the hook already at this index instead of appending one. */
    editIndex?: number;
}

/** Append a hook to the project's configuration. Returns the reason on refusal. */
export function writeHook(
    script: string,
    workspaceRoot: string,
    command: string,
    hook: HookDraft,
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot, [
        '--command', command,
        '--hook', hook.type,
        '--when', hook.when,
        '--anchor', hook.anchor,
        '--ref', hook.ref ?? '',
        '--run', hook.run ?? '',
        '--text', hook.text ?? '',
        ...(hook.editIndex === undefined ? [] : ['--edit-index', String(hook.editIndex)]),
    ]);
}

/** Take a hook out of the project's configuration. */
export function removeHook(
    script: string,
    workspaceRoot: string,
    command: string,
    when: string,
    anchor: string,
    index: number,
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot, [
        '--command', command, '--when', when, '--anchor', anchor,
        '--remove-index', String(index),
    ]);
}

/**
 * Save a step's phase grouping, and its order alongside when both change.
 *
 * A change to WHICH nodes run moves both halves at once, and each half is
 * validated against the other as it currently stands — so writing the grouping
 * first is refused for naming a node the order does not have, and writing the
 * order first is refused for naming one no phase holds. Neither can go first.
 * Passing both lets the writer check the pair it is being asked for.
 *
 * `order` is omitted for a pure regroup (a rename, a node dragged between two
 * phases), where the set of nodes is unchanged and the order still agrees.
 */
export function writePhases(
    script: string,
    workspaceRoot: string,
    command: string,
    phases: Array<{ name: string; nodes: string[] }>,
    renamed?: { from: string; to: string },
    order?: string[],
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot, [
        '--command', command, '--phases', JSON.stringify(phases),
        ...(order ? ['--nodes', order.join(',')] : []),
        ...(renamed ? ['--renamed', renamed.from, renamed.to] : []),
    ]);
}

/** Switch the project to a named workflow. Returns the reason on refusal. */
export function writeWorkflow(
    script: string,
    workspaceRoot: string,
    name: string,
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot, ['--workflow', name]);
}

/**
 * Point one template section at a fragment. An empty `fragment` restores the
 * shipped section. Returns the reason on refusal — a heading the template does
 * not have, or a fragment that does not exist, are both refused here rather
 * than at the next build.
 */
export function writeTemplateSection(
    script: string,
    workspaceRoot: string,
    command: string,
    heading: string,
    fragment: string,
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot, [
        '--command', command, '--template-section', heading, '--fragment', fragment,
    ]);
}

/** Create a step of the project's own, seeded runnable. */
export function createStep(
    script: string,
    workspaceRoot: string,
    name: string,
    label: string,
    after: string,
    writes: string,
): Promise<string | null> {
    const args = ['--new-step', name];
    if (label) { args.push('--label', label); }
    if (after) { args.push('--after', after); }
    if (writes) { args.push('--writes', writes); }
    return runConfigWrite(script, workspaceRoot, args);
}

/** Create a workflow, seeded from `from`, and switch to it. */
export function createWorkflow(
    script: string,
    workspaceRoot: string,
    name: string,
    from: string,
): Promise<string | null> {
    return runConfigWrite(script, workspaceRoot,
        ['--new-workflow', name, '--seed-from', from]);
}

function runConfigWrite(
    script: string,
    workspaceRoot: string,
    args: string[],
): Promise<string | null> {
    const { execFile } = require('child_process');
    return new Promise<string | null>(resolve => {
        execFile(
            'python3',
            [script, '--project', workspaceRoot, ...args],
            { cwd: workspaceRoot, timeout: GRAPH_TIMEOUT_MS },
            (err: Error | null, stdout: string, stderr: string) => {
                if (!err) { resolve(null); return; }
                const said = (stdout || stderr || '').replace(/^\[config]\s*/m, '').trim();
                resolve(said || `companion.yml could not be written: ${err.message}`);
            },
        );
    });
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
