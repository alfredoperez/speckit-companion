import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatSeconds, gateLabel, readEngineRuns } from '../engineRuns';

const temps: string[] = [];

function workspaceWith(build: (root: string) => void): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-runs-'));
    temps.push(root);
    build(root);
    return root;
}

afterAll(() => temps.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

const at = (time: string) => `2026-11-01T${time}+00:00`;

const PAUSED_LOG = [
    { event: 'step_started', step_id: 'assess', type: 'command', timestamp: at('05:11:58.461686') },
    { event: 'step_completed', step_id: 'assess', status: 'completed', timestamp: at('05:13:46.461686') },
    { event: 'step_started', step_id: 'review-assessment', type: 'gate', timestamp: at('05:13:46.470000') },
    { event: 'step_completed', step_id: 'review-assessment', status: 'paused', timestamp: at('05:13:46.480000') },
    { event: 'workflow_finished', status: 'paused', timestamp: at('05:13:46.490000') },
];

function writeRun(
    root: string,
    runId: string,
    options: { slug?: string; status?: string; log?: unknown[] | string; updated?: string; state?: string } = {},
): string {
    const dir = path.join(root, '.specify', 'workflows', 'runs', runId);
    fs.mkdirSync(dir, { recursive: true });
    const slug = options.slug ?? 'star-crash';
    fs.writeFileSync(path.join(dir, 'inputs.json'), JSON.stringify({ inputs: { report: 'x', slug } }));
    fs.writeFileSync(
        path.join(dir, 'state.json'),
        options.state ??
            JSON.stringify({
                run_id: runId,
                workflow_id: 'bugfix',
                status: options.status ?? 'paused',
                current_step_id: 'review-assessment',
                updated_at: options.updated ?? at('05:15:20'),
                inputs: { slug },
            }),
    );
    const log = options.log ?? PAUSED_LOG;
    fs.writeFileSync(
        path.join(dir, 'log.jsonl'),
        typeof log === 'string' ? log : log.map(event => JSON.stringify(event)).join('\n'),
    );
    return dir;
}

function snapshot(dir: string): Record<string, string> {
    const files: Record<string, string> = {};
    const walk = (current: string) => {
        for (const name of fs.readdirSync(current)) {
            const full = path.join(current, name);
            if (fs.statSync(full).isDirectory()) walk(full);
            else files[path.relative(dir, full)] = fs.readFileSync(full, 'utf-8') + fs.statSync(full).mtimeMs;
        }
    };
    walk(dir);
    return files;
}

describe('readEngineRuns', () => {
    describe('given a bugfix run paused at its review gate', () => {
        const run = readEngineRuns(workspaceWith(root => writeRun(root, '3471d74b'))).get('star-crash');

        it('joins the run to the bug on the slug in its inputs', () => {
            expect(run?.runId).toBe('3471d74b');
            expect(run?.workflowId).toBe('bugfix');
        });

        it('measures each finished step from its start and finish stamps', () => {
            expect(run?.steps[0]).toEqual({ id: 'assess', state: 'done', gate: false, seconds: 108 });
            expect(run?.workSeconds).toBe(108);
        });

        it('names the gate the run is waiting at, with no time on it', () => {
            expect(run?.pausedAt).toBe('review-assessment');
            expect(run?.steps[1]).toEqual({ id: 'review-assessment', state: 'paused', gate: true });
        });
    });

    it('shows a gate once, as its latest attempt, after a resume that paused again', () => {
        const log = [
            ...PAUSED_LOG,
            { event: 'step_started', step_id: 'review-assessment', type: 'gate', timestamp: at('05:15:20.100000') },
            { event: 'step_completed', step_id: 'review-assessment', status: 'paused', timestamp: at('05:15:20.200000') },
        ];
        const run = readEngineRuns(workspaceWith(root => writeRun(root, 'a1', { log }))).get('star-crash');
        expect(run?.steps.map(step => step.id)).toEqual(['assess', 'review-assessment']);
    });

    it('reports a run past its gate with times for every step and no paused gate', () => {
        const log = [
            ...PAUSED_LOG,
            { event: 'step_started', step_id: 'review-assessment', type: 'gate', timestamp: at('05:20:00.000000') },
            { event: 'step_completed', step_id: 'review-assessment', status: 'completed', timestamp: at('05:20:00.010000') },
            { event: 'step_started', step_id: 'fix', type: 'command', timestamp: at('05:20:01.000000') },
            { event: 'step_completed', step_id: 'fix', status: 'completed', timestamp: at('05:23:41.000000') },
        ];
        const run = readEngineRuns(workspaceWith(root => writeRun(root, 'a1', { status: 'running', log }))).get('star-crash');
        expect(run?.pausedAt).toBeUndefined();
        expect(run?.steps.find(step => step.id === 'fix')?.seconds).toBe(220);
        expect(run?.workSeconds).toBe(108 + 220);
    });

    it('takes the newest run when a bug has run more than once', () => {
        const root = workspaceWith(r => {
            writeRun(r, 'old', { updated: at('01:00:00') });
            writeRun(r, 'new', { updated: at('09:00:00') });
        });
        expect(readEngineRuns(root).get('star-crash')?.runId).toBe('new');
    });

    it('keeps every good line when the last one is half written', () => {
        const good = PAUSED_LOG.slice(0, 2).map(event => JSON.stringify(event)).join('\n');
        const run = readEngineRuns(workspaceWith(r => writeRun(r, 'p1', { log: `${good}\n{"event": "step_sta` }))).get('star-crash');
        expect(run?.steps).toEqual([{ id: 'assess', state: 'done', gate: false, seconds: 108 }]);
    });

    it('sums the seconds of every attempt of a looped step and gives a gate no duration', () => {
        const log = [
            { event: 'step_started', step_id: 'fix', type: 'command', timestamp: at('05:00:00') },
            { event: 'step_completed', step_id: 'fix', status: 'completed', timestamp: at('05:01:00') },
            { event: 'step_started', step_id: 'review', type: 'gate', timestamp: at('05:01:00') },
            { event: 'step_completed', step_id: 'review', status: 'completed', timestamp: at('05:05:00') },
            { event: 'step_started', step_id: 'fix', type: 'command', timestamp: at('05:05:00') },
            { event: 'step_completed', step_id: 'fix', status: 'completed', timestamp: at('05:05:30') },
        ];
        const run = readEngineRuns(workspaceWith(r => writeRun(r, 'l1', { status: 'running', log }))).get('star-crash');
        expect(run?.steps.find(step => step.id === 'fix')?.seconds).toBe(90);
        expect(run?.steps.find(step => step.id === 'review')?.seconds).toBeUndefined();
        expect(run?.workSeconds).toBe(90);
    });

    it('breaks a tie between runs with no updated_at by the newer run folder', () => {
        const state = (status: string) => JSON.stringify({ run_id: 'x', workflow_id: 'bugfix', status, current_step_id: 'review-assessment', inputs: { slug: 'star-crash' } });
        const root = workspaceWith(r => {
            writeRun(r, 'aaa-old', { state: state('paused') });
            writeRun(r, 'zzz-new', { state: state('completed') });
        });
        const runs = path.join(root, '.specify', 'workflows', 'runs');
        fs.utimesSync(path.join(runs, 'aaa-old'), new Date('2026-01-01'), new Date('2026-01-01'));
        fs.utimesSync(path.join(runs, 'zzz-new'), new Date('2026-06-01'), new Date('2026-06-01'));
        const run = readEngineRuns(root).get('star-crash');
        expect(run?.status).toBe('completed');
        expect(run?.pausedAt).toBeUndefined();
    });

    it('ignores runs of any workflow but bugfix', () => {
        const other = JSON.stringify({ run_id: 'o', workflow_id: 'speckit', status: 'paused', current_step_id: 'g', updated_at: at('23:00:00'), inputs: { slug: 'star-crash' } });
        const root = workspaceWith(r => {
            writeRun(r, 'mine', { status: 'completed', updated: at('01:00:00') });
            writeRun(r, 'other', { state: other });
        });
        expect(readEngineRuns(root).get('star-crash')?.runId).toBe('mine');
    });

    it('does not load runs for slugs that are not bugs', () => {
        const root = workspaceWith(r => {
            writeRun(r, 'a', { slug: 'a-bug' });
            writeRun(r, 'b', { slug: 'not-a-bug' });
        });
        expect([...readEngineRuns(root, new Set(['a-bug'])).keys()]).toEqual(['a-bug']);
    });

    it('re-reads a run when its log changes and reuses it when nothing changed', () => {
        const root = workspaceWith(r => writeRun(r, 'c1'));
        const dir = path.join(root, '.specify', 'workflows', 'runs', 'c1');
        const log = path.join(dir, 'log.jsonl');
        // A whole second survives the round trip through utimes exactly.
        const mtime = Math.floor(Date.now() / 1000) - 60;
        fs.utimesSync(log, mtime, mtime);
        expect(readEngineRuns(root).get('star-crash')?.steps).toHaveLength(2);
        fs.writeFileSync(log, fs.readFileSync(log, 'utf-8').replace(/assess/g, 'assesz'));
        fs.utimesSync(log, mtime, mtime);
        expect(readEngineRuns(root).get('star-crash')?.steps[0].id).toBe('assess');
        fs.writeFileSync(path.join(dir, 'log.jsonl'), PAUSED_LOG.slice(0, 2).map(event => JSON.stringify(event)).join('\n'));
        expect(readEngineRuns(root).get('star-crash')?.steps).toHaveLength(1);
    });

    describe('when the log cannot be read', () => {
        it.each([
            ['is malformed', 'not json\nstill not json'],
            ['is empty', ''],
            ['holds events of another shape', '{"kind":"start","name":"assess","at":1}\n{"kind":"end","name":"assess","at":2}'],
        ])('keeps the run but shows no step times when the log %s', (_name, log) => {
            const root = workspaceWith(r => writeRun(r, 'x1', { log }));
            let run;
            expect(() => (run = readEngineRuns(root).get('star-crash'))).not.toThrow();
            expect(run).toMatchObject({ steps: [], workSeconds: 0 });
        });

        it('skips a run whose state.json is not JSON', () => {
            const root = workspaceWith(r => writeRun(r, 'x1', { state: '{nope' }));
            expect(readEngineRuns(root).size).toBe(0);
        });

        it('skips a run whose state.json is missing the workflow, the status or the slug', () => {
            const root = workspaceWith(r => writeRun(r, 'x1', { state: JSON.stringify({ run_id: 'x1' }) }));
            expect(readEngineRuns(root).size).toBe(0);
        });

        it('returns nothing when the project has no workflow runs', () => {
            expect(readEngineRuns(workspaceWith(() => undefined)).size).toBe(0);
        });

        it('returns nothing for a workspace that does not exist', () => {
            expect(readEngineRuns(path.join(os.tmpdir(), 'engine-runs-missing-folder')).size).toBe(0);
        });
    });

    it('never writes: the run folder is byte and time identical afterwards', () => {
        const root = workspaceWith(r => writeRun(r, '3471d74b'));
        const before = snapshot(root);
        readEngineRuns(root);
        expect(snapshot(root)).toEqual(before);
    });

    it('leaves out a run folder that is a symlink', () => {
        const root = workspaceWith(r => writeRun(r, 'real'));
        const runs = path.join(root, '.specify', 'workflows', 'runs');
        fs.symlinkSync(path.join(runs, 'real'), path.join(runs, 'linked'));
        expect(readEngineRuns(root).get('star-crash')?.runId).toBe('real');
    });
});

describe('formatSeconds', () => {
    it.each([
        [39, '39s'],
        [108, '1m 48s'],
        [125, '2m 05s'],
        [3720, '1h 02m'],
        [-3, '0s'],
    ])('writes %p as %p', (seconds, expected) => {
        expect(formatSeconds(seconds)).toBe(expected);
    });
});

describe('gateLabel', () => {
    it('keeps the first word of the step id', () => {
        expect(gateLabel('review-assessment')).toBe('review');
        expect(gateLabel('approve')).toBe('approve');
    });
});
