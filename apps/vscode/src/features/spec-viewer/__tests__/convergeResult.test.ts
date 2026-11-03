import { deriveConvergeResult } from '../convergeResult';
import type { SpecContext } from '../../../core/types/specContext';

const TASKS = [
    '- [x] **T001** First thing · src/a.ts',
    '- [ ] **T013** [P] [US1] Saved filter names must be unique · src/b.ts',
    '- [x] **T014** Deleting a filter clears `the list` view',
    '- [ ] **T015** Test for SC-002',
].join('\n');

function ctx(convergePasses: unknown): SpecContext {
    return { convergePasses } as unknown as SpecContext;
}

const START = '2026-11-03T10:00:00.000Z';
const FINISH = '2026-11-03T10:02:31.000Z';

describe('deriveConvergeResult', () => {
    it('is undefined when converge never ran', () => {
        expect(deriveConvergeResult(ctx(undefined), TASKS)).toBeUndefined();
        expect(deriveConvergeResult(ctx([]), TASKS)).toBeUndefined();
    });

    it('reads gaps with titles, checked state and the open count', () => {
        const r = deriveConvergeResult(ctx([
            { startedAt: START, by: 'extension', finishedAt: FINISH, added: ['T013', 'T014', 'T015'] },
        ]), TASKS)!;
        expect(r.outcome).toBe('gaps');
        expect(r.passes[0].durationMs).toBe(151_000);
        expect(r.addedTasks).toEqual([
            { id: 'T013', title: 'Saved filter names must be unique', checked: false },
            { id: 'T014', title: 'Deleting a filter clears `the list` view', checked: true },
            { id: 'T015', title: 'Test for SC-002', checked: false },
        ]);
        expect(r.openAdded).toBe(2);
    });

    it('reads a clean latest pass and who completed the spec', () => {
        const r = deriveConvergeResult(ctx([
            { startedAt: START, by: 'extension', finishedAt: FINISH, added: ['T013'] },
            { startedAt: FINISH, by: 'extension', finishedAt: '2026-11-03T10:05:00.000Z', added: [], completed: true },
        ]), TASKS)!;
        expect(r.outcome).toBe('clean');
        expect(r.passCount).toBe(2);
        expect(r.passes.map(p => p.outcome)).toEqual(['gaps', 'clean']);
        expect(r.addedTasks).toEqual([]);
        expect(r.openAdded).toBe(0);
        expect(r.completedBy).toEqual({ at: '2026-11-03T10:05:00.000Z', by: 'extension' });
    });

    it('never reads a pass without its task list as clean', () => {
        const r = deriveConvergeResult(ctx([{ startedAt: START, by: 'extension', finishedAt: FINISH }]), TASKS)!;
        expect(r.outcome).toBe('unknown');
        expect(r.openAdded).toBe(0);
    });

    it('reads an unfinished pass as running, with no duration', () => {
        const r = deriveConvergeResult(ctx([{ startedAt: START, by: 'ai', before: ['T001'] }]), TASKS)!;
        expect(r.outcome).toBe('running');
        expect(r.passes[0].durationMs).toBeUndefined();
    });

    it('drops an added task that is no longer in tasks.md', () => {
        const r = deriveConvergeResult(ctx([
            { startedAt: START, by: 'extension', finishedAt: FINISH, added: ['T013', 'T099'] },
        ]), TASKS)!;
        expect(r.addedTasks.map(t => t.id)).toEqual(['T013']);
        expect(r.openAdded).toBe(1);
    });

    it('counts a repeated added id once', () => {
        const r = deriveConvergeResult(ctx([
            { startedAt: START, by: 'extension', finishedAt: FINISH, added: ['T013', 'T013'] },
        ]), TASKS)!;
        expect(r.addedTasks.map(t => t.id)).toEqual(['T013']);
        expect(r.passes[0].addedIds).toEqual(['T013']);
    });

    it('ignores malformed passes and ids', () => {
        expect(deriveConvergeResult(ctx('garbage'), TASKS)).toBeUndefined();
        const r = deriveConvergeResult(ctx([
            null, 7, { by: 'ai' },
            { startedAt: START, by: 'extension', finishedAt: FINISH, added: ['T015', 3, null] },
        ]), TASKS)!;
        expect(r.passCount).toBe(1);
        expect(r.addedTasks.map(t => t.id)).toEqual(['T015']);
    });
});
