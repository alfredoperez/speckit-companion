/**
 * The last run's outcome per hook, for the board.
 *
 * Each record is the assistant's own report (`hookRuns[]` in a spec's
 * `.spec-context.json`, written by `write-context.py --hook-outcome`). The run
 * read is the spec with the newest activity; a hook with no record there is
 * "not seen", which the board concludes and nothing ever writes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveSpecDirectories, SpecDirectoryInfo } from '../../core/specDirectoryResolver';
import { HookRun, HookRunsAnswer, HookType, HookWhen } from '../../protocol/pipeline';

const WHENS: readonly string[] = ['before', 'after'];
const TYPES: readonly string[] = ['command', 'prompt', 'node', 'skill'];
const OUTCOMES: readonly string[] = ['ran', 'skipped'];

function readRecord(specDir: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(specDir, '.spec-context.json'), 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function asRun(raw: unknown): HookRun | null {
    if (!raw || typeof raw !== 'object') { return null; }
    const r = raw as Record<string, unknown>;
    const { step, when, anchor, index, type, outcome, at } = r;
    if (typeof step !== 'string' || typeof anchor !== 'string' || typeof at !== 'string'
        || typeof when !== 'string' || !WHENS.includes(when)
        || typeof type !== 'string' || !TYPES.includes(type)
        || typeof outcome !== 'string' || !OUTCOMES.includes(outcome)
        || !Number.isInteger(index) || (index as number) < 0) {
        return null;
    }
    const run: HookRun = {
        key: `${step}/${when}/${anchor}/${index}`,
        step, when: when as HookWhen, anchor, index: index as number, type: type as HookType,
        ref: typeof r.ref === 'string' ? r.ref : '',
        outcome: outcome as HookRun['outcome'],
        at,
    };
    if (typeof r.reason === 'string' && r.reason) { run.reason = r.reason; }
    return run;
}

function newest(stamps: unknown[]): string | null {
    let best: string | null = null;
    for (const stamp of stamps) {
        if (typeof stamp === 'string' && !Number.isNaN(Date.parse(stamp))
            && (best === null || Date.parse(stamp) > Date.parse(best))) {
            best = stamp;
        }
    }
    return best;
}

function stampsOf(list: unknown): unknown[] {
    return Array.isArray(list) ? list.map(e => (e && typeof e === 'object' ? (e as { at?: unknown }).at : null)) : [];
}

/** The newest spec among these and its last record per hook. An unreadable record is passed over. */
export function hookRunsFrom(specs: SpecDirectoryInfo[]): HookRunsAnswer {
    let found: { spec: SpecDirectoryInfo; runAt: string; record: Record<string, unknown> } | null = null;
    for (const spec of specs) {
        const record = readRecord(spec.path);
        if (!record) { continue; }
        const runAt = newest([...stampsOf(record.history), ...stampsOf(record.hookRuns)]);
        if (runAt && (!found || Date.parse(runAt) > Date.parse(found.runAt))) {
            found = { spec, runAt, record };
        }
    }
    if (!found) { return { spec: null, runAt: null, runs: [] }; }

    const last = new Map<string, HookRun>();
    for (const raw of Array.isArray(found.record.hookRuns) ? found.record.hookRuns : []) {
        const run = asRun(raw);
        if (run) { last.delete(run.key); last.set(run.key, run); }
    }
    return {
        spec: { name: found.spec.name, path: found.spec.path },
        runAt: found.runAt,
        runs: [...last.values()],
    };
}

export async function readHookRuns(workspaceRoot: string): Promise<HookRunsAnswer> {
    return hookRunsFrom(await resolveSpecDirectories(workspaceRoot));
}
