import { appendTransition } from '../specContextWriter';
import type { SpecContext, Transition } from '../../../core/types/specContext';

function makeContext(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'sdd',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        stepHistory: {},
        transitions: [],
        ...overrides,
    };
}

const tx = (overrides: Partial<Transition> = {}): Transition => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('appendTransition', () => {
    // The writer is a faithful append-only log of every lifecycle boundary.
    // Redundant *display* rows are collapsed downstream (stepHistoryDerivation
    // `dedupeConsecutive` + PhasesCard), not here — de-duping in the writer would
    // wrongly drop legitimate start/complete boundaries that share (step,
    // substep, from). See stepHistoryDerivation.test.ts for the view-layer dedup.
    it('appends even when (step, substep, from) matches the last one (boundaries are preserved)', () => {
        const last = tx({ step: 'specify', substep: null, at: '2026-04-29T00:00:00Z' });
        const ctx = makeContext({ transitions: [last] });
        const same = tx({ step: 'specify', substep: null, at: '2026-04-29T00:01:00Z' });

        const result = appendTransition(ctx, same);

        expect(result.transitions).toHaveLength(2);
    });

    it('appends a transition with a distinct substep on the same step', () => {
        const last = tx({ step: 'specify', substep: null });
        const ctx = makeContext({ transitions: [last] });
        const next = tx({ step: 'specify', substep: 'outline', by: 'sdd', at: '2026-04-29T00:00:05Z' });

        const result = appendTransition(ctx, next);

        expect(result.transitions).toHaveLength(2);
        expect(result.transitions[1].substep).toBe('outline');
    });

    it('appends the first transition into an empty array', () => {
        const ctx = makeContext({ transitions: [] });
        const first = tx({ step: 'specify' });

        const result = appendTransition(ctx, first);

        expect(result.transitions).toHaveLength(1);
        expect(result.transitions[0]).toEqual(first);
    });
});
