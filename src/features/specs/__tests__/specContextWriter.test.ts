import { appendHistory } from '../specContextWriter';
import type { HistoryEntry, SpecContext } from '../../../core/types/specContext';

function makeContext(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'sdd',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        history: [],
        ...overrides,
    };
}

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('appendHistory', () => {
    // The writer is a faithful append-only log of every lifecycle boundary.
    // Redundant *display* rows are collapsed downstream (stepHistoryDerivation
    // `dedupeConsecutive` + PhasesCard), not here — de-duping in the writer
    // would wrongly drop legitimate start/complete boundaries that share
    // (step, substep, from). See stepHistoryDerivation.test.ts for the
    // view-layer dedup.
    it('appends even when (step, substep, from) matches the last one (boundaries are preserved)', () => {
        const last = entry({ step: 'specify', substep: null, at: '2026-04-29T00:00:00Z' });
        const ctx = makeContext({ history: [last] });
        const same = entry({ step: 'specify', substep: null, at: '2026-04-29T00:01:00Z' });

        const result = appendHistory(ctx, same);

        expect(result.history).toHaveLength(2);
    });

    it('appends an entry with a distinct substep on the same step', () => {
        const last = entry({ step: 'specify', substep: null });
        const ctx = makeContext({ history: [last] });
        const next = entry({ step: 'specify', substep: 'outline', by: 'sdd', at: '2026-04-29T00:00:05Z' });

        const result = appendHistory(ctx, next);

        expect(result.history).toHaveLength(2);
        expect(result.history[1].substep).toBe('outline');
    });

    it('appends the first entry into an empty array', () => {
        const ctx = makeContext({ history: [] });
        const first = entry({ step: 'specify' });

        const result = appendHistory(ctx, first);

        expect(result.history).toHaveLength(1);
        expect(result.history[0]).toEqual(first);
    });
});
