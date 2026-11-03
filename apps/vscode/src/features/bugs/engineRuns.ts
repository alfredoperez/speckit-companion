import * as fs from 'fs';
import * as path from 'path';

export const WORKFLOW_RUNS_DIR = path.join('.specify', 'workflows', 'runs');

const MAX_FILE_BYTES = 4 * 1024 * 1024;

export type EngineStepState = 'done' | 'paused' | 'failed' | 'running';

export interface EngineStep {
    id: string;
    state: EngineStepState;
    gate: boolean;
    /** Whole seconds between the step starting and finishing; absent while it runs or waits. */
    seconds?: number;
}

export interface EngineRun {
    runId: string;
    workflowId: string;
    slug: string;
    status: string;
    steps: EngineStep[];
    /** Seconds the engine spent in steps that finished, not counting a wait at a gate. */
    workSeconds: number;
    /** The gate the run is waiting at, when it is paused. */
    pausedAt?: string;
}

function readJson(filePath: string): unknown {
    try {
        const stat = fs.lstatSync(filePath);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return undefined;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return undefined;
    }
}

function readLines(filePath: string): unknown[] {
    try {
        const stat = fs.lstatSync(filePath);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return [];
        const events: unknown[] = [];
        for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
            if (!line.trim()) continue;
            try {
                events.push(JSON.parse(line));
            } catch {
                continue;
            }
        }
        return events;
    } catch {
        return [];
    }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stamp(value: unknown): number | undefined {
    const raw = text(value);
    const time = raw === undefined ? NaN : Date.parse(raw);
    return Number.isNaN(time) ? undefined : time;
}

function stepsOf(events: unknown[]): EngineStep[] {
    const steps = new Map<string, EngineStep>();
    const started = new Map<string, number>();
    for (const event of events) {
        const entry = asRecord(event);
        const id = text(entry?.step_id);
        const at = stamp(entry?.timestamp);
        if (!entry || !id || at === undefined) continue;
        if (entry.event === 'step_started') {
            started.set(id, at);
            const step = steps.get(id) ?? { id, state: 'running' as EngineStepState, gate: entry.type === 'gate' };
            step.state = 'running';
            steps.set(id, step);
        } else if (entry.event === 'step_completed') {
            const begun = started.get(id);
            const step = steps.get(id);
            if (!step || begun === undefined) continue;
            started.delete(id);
            const status = text(entry.status);
            step.state = status === 'paused' ? 'paused' : status === 'completed' ? 'done' : 'failed';
            if (!step.gate && step.state !== 'paused') {
                step.seconds = (step.seconds ?? 0) + Math.max(0, Math.round((at - begun) / 1000));
            }
        }
    }
    return [...steps.values()];
}

const BUGFIX_WORKFLOW = 'bugfix';

interface CachedRun {
    key: string;
    run: (EngineRun & { stamp: number }) | undefined;
}

const cache = new Map<string, CachedRun>();

function fileKey(filePath: string): string {
    try {
        const stat = fs.statSync(filePath);
        return `${Math.floor(stat.mtimeMs)}:${stat.size}`;
    } catch {
        return 'missing';
    }
}

function readRun(runDirectory: string): (EngineRun & { stamp: number }) | undefined {
    const state = asRecord(readJson(path.join(runDirectory, 'state.json')));
    if (!state) return undefined;
    const inputs = asRecord(readJson(path.join(runDirectory, 'inputs.json')))?.inputs ?? state.inputs;
    const slug = text(asRecord(inputs)?.slug);
    const workflowId = text(state.workflow_id);
    const status = text(state.status);
    if (!slug || workflowId !== BUGFIX_WORKFLOW || !status) return undefined;

    const steps = stepsOf(readLines(path.join(runDirectory, 'log.jsonl')));
    const workSeconds = steps.reduce((sum, step) => sum + (step.state === 'done' ? step.seconds ?? 0 : 0), 0);
    const run: EngineRun & { stamp: number } = {
        runId: text(state.run_id) ?? path.basename(runDirectory),
        workflowId,
        slug,
        status,
        steps,
        workSeconds,
        stamp: stamp(state.updated_at) ?? stamp(state.created_at) ?? 0,
    };
    const gate = text(state.current_step_id);
    if (status === 'paused' && gate) run.pausedAt = gate;
    return run;
}

function slugOf(runDirectory: string): string | undefined {
    return text(asRecord(asRecord(readJson(path.join(runDirectory, 'inputs.json')))?.inputs)?.slug);
}

function cachedRun(runDirectory: string): (EngineRun & { stamp: number }) | undefined {
    const key = `${fileKey(path.join(runDirectory, 'state.json'))}|${fileKey(path.join(runDirectory, 'log.jsonl'))}|${fileKey(path.join(runDirectory, 'inputs.json'))}`;
    const hit = cache.get(runDirectory);
    if (hit?.key === key) return hit.run;
    const run = readRun(runDirectory);
    cache.set(runDirectory, { key, run });
    return run;
}

/**
 * The newest bugfix-workflow run for each bug slug under `<workspaceRoot>/.specify/workflows/runs/`.
 * With `slugs`, runs for other slugs are skipped after their small inputs.json; a missing or unreadable run is left out.
 */
export function readEngineRuns(workspaceRoot: string, slugs?: ReadonlySet<string>): Map<string, EngineRun> {
    const found = new Map<string, EngineRun & { stamp: number; folderTime: number }>();
    try {
        const root = path.join(workspaceRoot, WORKFLOW_RUNS_DIR);
        for (const name of fs.readdirSync(root)) {
            const directory = path.join(root, name);
            try {
                const folder = fs.lstatSync(directory);
                if (!folder.isDirectory()) continue;
                const early = slugOf(directory);
                if (slugs && early && !slugs.has(early)) continue;
                const run = cachedRun(directory);
                if (!run || (slugs && !slugs.has(run.slug))) continue;
                const before = found.get(run.slug);
                if (!before || run.stamp > before.stamp || (run.stamp === before.stamp && folder.mtimeMs >= before.folderTime)) {
                    found.set(run.slug, { ...run, folderTime: folder.mtimeMs });
                }
            } catch {
                continue;
            }
        }
    } catch {
        return new Map();
    }
    const runs = new Map<string, EngineRun>();
    for (const [slug, { stamp: _stamp, folderTime: _folderTime, ...run }] of found) runs.set(slug, run);
    return runs;
}

/** "39s", "1m 48s", "1h 02m". */
export function formatSeconds(seconds: number): string {
    const whole = Math.max(0, Math.round(seconds));
    if (whole < 60) return `${whole}s`;
    const minutes = Math.floor(whole / 60);
    if (minutes < 60) return `${minutes}m ${String(whole % 60).padStart(2, '0')}s`;
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** "review" for `review-assessment`: the first word of the step id. */
export function gateLabel(stepId: string): string {
    return stepId.split(/[-_]/)[0] || stepId;
}
