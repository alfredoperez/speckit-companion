import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hookRunsFrom } from '../hookRuns';

function spec(root: string, name: string, record: unknown): { name: string; path: string } {
    const dir = path.join(root, 'specs', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.spec-context.json'),
        typeof record === 'string' ? record : JSON.stringify(record), 'utf8');
    return { name, path: dir };
}

const run = (at: string, outcome: string, extra: Record<string, unknown> = {}) => ({
    step: 'specify', when: 'after', anchor: 'finalize', index: 0, type: 'skill',
    ref: 'house-check', outcome, by: 'ai', at, ...extra,
});

describe('the last run\'s outcome per hook', () => {
    let root: string;
    beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-runs-')); });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('says there is no run when the project has no spec', () => {
        expect(hookRunsFrom([])).toEqual({ spec: null, runAt: null, runs: [] });
    });

    it('reads the spec with the newest activity, not the highest number', () => {
        const older = spec(root, '002-b', {
            history: [{ step: 'specify', kind: 'start', at: '2026-11-01T10:00:00.000Z' }],
            hookRuns: [run('2026-11-01T10:05:00.000Z', 'ran')],
        });
        const newer = spec(root, '001-a', {
            history: [{ step: 'implement', kind: 'start', at: '2026-11-20T09:00:00.000Z' }],
            hookRuns: [run('2026-11-20T09:01:00.000Z', 'skipped', { reason: 'no time' })],
        });
        const answer = hookRunsFrom([older, newer]);
        expect(answer.spec).toEqual({ name: '001-a', path: newer.path });
        expect(answer.runAt).toBe('2026-11-20T09:01:00.000Z');
        expect(answer.runs).toEqual([{
            key: 'specify/after/finalize/0', step: 'specify', when: 'after', anchor: 'finalize',
            index: 0, type: 'skill', ref: 'house-check', outcome: 'skipped', reason: 'no time',
            at: '2026-11-20T09:01:00.000Z',
        }]);
    });

    it('keeps the last record of each hook', () => {
        const only = spec(root, '001-a', {
            history: [],
            hookRuns: [
                run('2026-11-20T09:01:00.000Z', 'skipped'),
                run('2026-11-20T09:02:00.000Z', 'ran', { anchor: 'draft-spec', when: 'before', type: 'prompt', ref: '' }),
                run('2026-11-20T09:03:00.000Z', 'ran'),
            ],
        });
        const answer = hookRunsFrom([only]);
        expect(answer.runs.map(r => `${r.key}=${r.outcome}`)).toEqual([
            'specify/before/draft-spec/0=ran',
            'specify/after/finalize/0=ran',
        ]);
    });

    it('names the newest spec with no runs, so every hook reads not seen', () => {
        spec(root, '001-a', { hookRuns: [run('2026-11-01T10:00:00.000Z', 'ran')] });
        const newest = spec(root, '002-b', {
            history: [{ step: 'specify', kind: 'start', at: '2026-11-21T10:00:00.000Z' }],
        });
        const answer = hookRunsFrom([
            { name: '001-a', path: path.join(root, 'specs', '001-a') }, newest]);
        expect(answer.spec?.name).toBe('002-b');
        expect(answer.runs).toEqual([]);
    });

    it('passes over an unreadable record and a malformed entry', () => {
        const broken = spec(root, '003-c', '{ not json');
        const good = spec(root, '001-a', {
            hookRuns: [
                run('2026-11-20T09:00:00.000Z', 'maybe'),
                run('2026-11-20T09:01:00.000Z', 'ran', { index: -1 }),
                run('2026-11-20T09:02:00.000Z', 'ran'),
            ],
        });
        const missing = { name: '004-d', path: path.join(root, 'specs', '004-d') };
        const answer = hookRunsFrom([broken, missing, good]);
        expect(answer.spec?.name).toBe('001-a');
        expect(answer.runs).toHaveLength(1);
        expect(answer.runs[0].outcome).toBe('ran');
    });
});
