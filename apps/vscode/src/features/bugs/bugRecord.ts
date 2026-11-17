import * as fs from 'fs';
import * as path from 'path';

export type BugStageId = 'assess' | 'fix' | 'test';
export type RecordStageState = 'done' | 'stopped' | 'running';

export interface RecordStage {
    id: BugStageId;
    state: RecordStageState;
    seconds?: number;
    outcome?: string;
}

const STAGES: readonly string[] = ['assess', 'fix', 'test'];

interface Boundary {
    step: BugStageId;
    kind: 'start' | 'complete';
    at: number;
    did?: string;
}

function boundaries(history: unknown): Boundary[] {
    if (!Array.isArray(history)) return [];
    return history.flatMap(entry => {
        const e = entry as Record<string, unknown>;
        const at = typeof e?.at === 'string' ? Date.parse(e.at) : NaN;
        if (!STAGES.includes(e?.step as string) || (e.kind !== 'start' && e.kind !== 'complete') || Number.isNaN(at)) return [];
        return [{ step: e.step as BugStageId, kind: e.kind, at, ...(typeof e.did === 'string' && { did: e.did }) }];
    });
}

/** Each round of each stage the bug's hooks recorded, in order; undefined when the bug has no record. */
export function recordStages(directory: string): RecordStage[] | undefined {
    let ctx: { history?: unknown };
    try {
        ctx = JSON.parse(fs.readFileSync(path.join(directory, '.spec-context.json'), 'utf-8'));
    } catch {
        return undefined;
    }
    const stages: RecordStage[] = [];
    const open = new Map<BugStageId, { stage: RecordStage; at: number }>();
    for (const b of boundaries(ctx?.history)) {
        if (b.kind === 'start') {
            for (const [, prior] of open) prior.stage.state = 'stopped';
            open.clear();
            const stage: RecordStage = { id: b.step, state: 'running' };
            stages.push(stage);
            open.set(b.step, { stage, at: b.at });
            continue;
        }
        const started = open.get(b.step);
        if (!started) continue;
        started.stage.state = 'done';
        started.stage.seconds = Math.max(0, Math.round((b.at - started.at) / 1000));
        if (b.did) started.stage.outcome = b.did;
        open.delete(b.step);
    }
    return stages.length ? stages : undefined;
}
