import { deriveStepHistory } from '../stepHistoryDerivation';
import type { Transition } from '../../../core/types/specContext';

const tx = (overrides: Partial<Transition>): Transition => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('deriveStepHistory', () => {
    it('returns {} for an empty transitions array', () => {
        expect(deriveStepHistory([])).toEqual({});
    });

    it('emits an entry for each step seen, with startedAt = first transition for that step', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            tx({ step: 'tasks',   at: '2026-04-29T00:02:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'tasks');
        expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
        expect(out.plan.startedAt).toBe('2026-04-29T00:01:00Z');
        expect(out.tasks.startedAt).toBe('2026-04-29T00:02:00Z');
    });

    it('sets completedAt to the first transition of the next step', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing', by: 'sdd', at: '2026-04-29T00:00:05Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        expect(out.specify.completedAt).toBe('2026-04-29T00:01:00Z');
    });

    it('marks the current step as in-flight when it is the most recent', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        expect(out.plan.completedAt).toBeNull();
    });

    it('falls back to the step\'s last transition when the step was left without a successor', () => {
        // currentStep is undefined and no later step exists — best we have.
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing', by: 'sdd', at: '2026-04-29T00:00:05Z' }),
        ];
        const out = deriveStepHistory(transitions);
        expect(out.specify.completedAt).toBe('2026-04-29T00:00:05Z');
    });

    it('builds substeps from non-null transitions, with completedAt = next substep at', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing',   by: 'sdd', at: '2026-04-29T00:00:05Z' }),
            tx({ step: 'specify', substep: 'exploring', by: 'sdd', at: '2026-04-29T00:00:10Z' }),
            tx({ step: 'specify', substep: 'detecting', by: 'sdd', at: '2026-04-29T00:00:15Z' }),
            tx({ step: 'plan', at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        const subs = out.specify.substeps!;
        expect(subs).toHaveLength(3);
        expect(subs[0]).toEqual({ name: 'parsing',   startedAt: '2026-04-29T00:00:05Z', completedAt: '2026-04-29T00:00:10Z' });
        expect(subs[1]).toEqual({ name: 'exploring', startedAt: '2026-04-29T00:00:10Z', completedAt: '2026-04-29T00:00:15Z' });
        // Last substep falls back to the step's completedAt
        expect(subs[2]).toEqual({ name: 'detecting', startedAt: '2026-04-29T00:00:15Z', completedAt: '2026-04-29T00:01:00Z' });
    });

    it('omits substeps[] when the step has no non-null transitions', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        expect(out.specify.substeps).toBeUndefined();
    });

    it('preserves step order across non-contiguous transitions for the same step', () => {
        // Edge: a step appears, jumps to another, then comes back. Real-life
        // transitions[] doesn't usually do this but we shouldn't crash.
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            tx({ step: 'specify', substep: 'rewriting', by: 'sdd', at: '2026-04-29T00:02:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'specify');
        // specify is current and gets completedAt: null when it's the most-recently-seen
        expect(out.specify.completedAt).toBeNull();
        // Order in the output respects first-appearance: specify, plan
        expect(Object.keys(out)).toEqual(['specify', 'plan']);
    });
});
