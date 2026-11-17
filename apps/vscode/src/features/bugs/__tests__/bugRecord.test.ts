import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { recordStages } from '../bugRecord';

const temps: string[] = [];
afterAll(() => temps.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

const at = (time: string) => `2026-11-17T${time}.000Z`;

function bugWith(history: unknown[] | string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-record-'));
    temps.push(dir);
    fs.writeFileSync(path.join(dir, '.spec-context.json'), typeof history === 'string' ? history : JSON.stringify({ history }));
    return dir;
}

describe('recordStages', () => {
    it('times a finished stage and keeps its outcome', () => {
        const dir = bugWith([
            { step: 'fix', kind: 'start', at: at('10:00:00') },
            { step: 'fix', kind: 'complete', at: at('10:02:30'), did: 'partial' },
        ]);
        expect(recordStages(dir)).toEqual([{ id: 'fix', state: 'done', seconds: 150, outcome: 'partial' }]);
    });

    it('reads a stage with no finish as stopped once a later stage starts', () => {
        const dir = bugWith([
            { step: 'assess', kind: 'start', at: at('10:00:00') },
            { step: 'assess', kind: 'complete', at: at('10:01:00'), did: 'valid' },
            { step: 'fix', kind: 'start', at: at('10:02:00') },
            { step: 'test', kind: 'start', at: at('10:05:00') },
        ]);
        expect(recordStages(dir)?.map(stage => `${stage.id}:${stage.state}`)).toEqual(['assess:done', 'fix:stopped', 'test:running']);
    });

    it('reads a lone start as running', () => {
        expect(recordStages(bugWith([{ step: 'fix', kind: 'start', at: at('10:00:00') }]))).toEqual([{ id: 'fix', state: 'running' }]);
    });

    it('keeps each round of a stage run twice', () => {
        const dir = bugWith([
            { step: 'fix', kind: 'start', at: at('10:00:00') },
            { step: 'fix', kind: 'complete', at: at('10:01:00'), did: 'not-applied' },
            { step: 'fix', kind: 'start', at: at('10:03:00') },
            { step: 'fix', kind: 'complete', at: at('10:04:00'), did: 'applied' },
        ]);
        expect(recordStages(dir)?.map(stage => stage.outcome)).toEqual(['not-applied', 'applied']);
    });

    it('has nothing for a bug with no record or an unreadable one', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-record-'));
        temps.push(empty);
        expect(recordStages(empty)).toBeUndefined();
        expect(recordStages(bugWith('{ not json'))).toBeUndefined();
        expect(recordStages(bugWith([{ step: 'plan', kind: 'start', at: at('10:00:00') }]))).toBeUndefined();
    });
});
