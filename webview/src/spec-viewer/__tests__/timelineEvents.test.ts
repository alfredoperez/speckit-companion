import { mergeStepEvents, buildTransitionIndex, normalizeSubsteps } from '../timelineEvents';
import type { Transition, StepHistoryEntry } from '../types';

const tx = (overrides: Partial<Transition>): Transition => ({
    step: 'plan',
    substep: 'research',
    from: { step: null, substep: null },
    by: 'ai',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('buildTransitionIndex', () => {
    it('skips null-substep transitions', () => {
        const idx = buildTransitionIndex([
            tx({ substep: null }),
            tx({ substep: 'research' }),
        ]);
        expect(idx.size).toBe(1);
        expect(idx.get('plan:research')?.substep).toBe('research');
    });

    it('keys by step + substep', () => {
        const idx = buildTransitionIndex([
            tx({ step: 'plan', substep: 'research' }),
            tx({ step: 'tasks', substep: 'research' }),
        ]);
        expect(idx.get('plan:research')?.step).toBe('plan');
        expect(idx.get('tasks:research')?.step).toBe('tasks');
    });
});

describe('mergeStepEvents', () => {
    const history: StepHistoryEntry = {
        startedAt: '2026-04-29T00:00:00Z',
        completedAt: '2026-04-29T00:10:00Z',
        substeps: [
            { name: 'research', startedAt: '2026-04-29T00:01:00Z', completedAt: '2026-04-29T00:04:00Z' },
            { name: 'design',   startedAt: '2026-04-29T00:04:00Z', completedAt: '2026-04-29T00:09:00Z' },
        ],
    };

    it('emits tracked events from stepHistory.substeps with their durations', () => {
        const events = mergeStepEvents('plan', history, []);
        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({
            name: 'research',
            source: 'tracked',
            startedAt: '2026-04-29T00:01:00Z',
            completedAt: '2026-04-29T00:04:00Z',
        });
        expect(events[1].name).toBe('design');
    });

    it('attaches the actor from a matching transition', () => {
        const transitions = [
            tx({ step: 'plan', substep: 'research', by: 'ai' }),
            tx({ step: 'plan', substep: 'design',   by: 'cli' }),
        ];
        const events = mergeStepEvents('plan', history, transitions);
        expect(events[0].by).toBe('ai');
        expect(events[1].by).toBe('cli');
    });

    it('uses the journal finish as recordedAt without treating it as a task duration', () => {
        const transitions = [
            tx({ step: 'plan', substep: 'research', kind: 'complete', by: 'ai', at: '2026-04-29T00:04:00Z' }),
        ];
        const events = mergeStepEvents('plan', history, transitions);
        expect(events[0].recordedAt).toBe('2026-04-29T00:04:00Z');
        expect(events[0].startedAt).toBe('2026-04-29T00:01:00Z');
    });

    it('emits logged-only events for transitions not present in substeps[]', () => {
        const transitions = [
            tx({ step: 'specify', substep: 'parsing',   by: 'cli', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'exploring', by: 'cli', at: '2026-04-29T00:00:05Z' }),
        ];
        const events = mergeStepEvents('specify', undefined, transitions);
        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({ name: 'parsing',   source: 'logged', by: 'cli', completedAt: null });
        expect(events[1]).toMatchObject({ name: 'exploring', source: 'logged', by: 'cli' });
    });

    it('drops null-substep transitions (boundary markers)', () => {
        const transitions = [
            tx({ step: 'specify', substep: null, by: 'extension' }),
            tx({ step: 'specify', substep: 'parsing', by: 'cli' }),
        ];
        const events = mergeStepEvents('specify', undefined, transitions);
        expect(events).toHaveLength(1);
        expect(events[0].name).toBe('parsing');
    });

    it('returns events sorted by their recorded timestamp', () => {
        const transitions = [
            tx({ step: 'plan', substep: 'late',  by: 'ai', at: '2026-04-29T00:08:00Z' }),
            tx({ step: 'plan', substep: 'early', by: 'ai', at: '2026-04-29T00:00:30Z' }),
        ];
        const events = mergeStepEvents('plan', history, transitions);
        expect(events.map(e => e.name)).toEqual(['early', 'research', 'late', 'design']);
    });

    it('prefers tracked source when name overlaps with a transition', () => {
        const transitions = [
            tx({ step: 'plan', substep: 'research', by: 'ai', at: '2026-04-29T00:01:00Z' }),
        ];
        const events = mergeStepEvents('plan', history, transitions);
        const research = events.find(e => e.name === 'research')!;
        expect(research.source).toBe('tracked');
        expect(research.completedAt).toBe('2026-04-29T00:04:00Z');
        expect(research.by).toBe('ai');
    });

    it('returns [] when both inputs are empty', () => {
        expect(mergeStepEvents('plan', undefined, [])).toEqual([]);
    });

    it('handles Record-shaped substeps (speckit specs)', () => {
        const recordHistory: StepHistoryEntry = {
            startedAt: '2026-04-25T11:13:42Z',
            completedAt: '2026-04-25T11:18:37Z',
            substeps: {
                research: { startedAt: '2026-04-25T11:14:30Z', completedAt: '2026-04-25T11:16:30Z' },
                design:   { startedAt: '2026-04-25T11:16:30Z', completedAt: '2026-04-25T11:18:00Z' },
            },
        };
        const events = mergeStepEvents('plan', recordHistory, []);
        expect(events.map(e => e.name)).toEqual(['research', 'design']);
        expect(events[0].source).toBe('tracked');
        expect(events[0].completedAt).toBe('2026-04-25T11:16:30Z');
    });
});

describe('normalizeSubsteps', () => {
    it('returns [] for undefined', () => {
        expect(normalizeSubsteps(undefined)).toEqual([]);
    });

    it('passes Array shape through', () => {
        const arr = [
            { name: 'research', startedAt: 'a', completedAt: 'b' },
        ];
        expect(normalizeSubsteps(arr)).toBe(arr);
    });

    it('converts Record shape into an array preserving keys as names', () => {
        const rec = {
            research: { startedAt: 'a', completedAt: 'b' },
            design: { startedAt: 'c', completedAt: null as string | null },
        };
        const out = normalizeSubsteps(rec);
        expect(out).toEqual([
            { name: 'research', startedAt: 'a', completedAt: 'b' },
            { name: 'design',   startedAt: 'c', completedAt: null },
        ]);
    });
});
