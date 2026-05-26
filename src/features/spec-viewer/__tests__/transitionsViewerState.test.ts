import { deriveViewerState } from '../stateDerivation';
import type { HistoryEntry, SpecContext } from '../../../core/types/specContext';

jest.mock('../footerActions', () => ({
    getFooterActions: jest.fn().mockReturnValue([]),
}));

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

const h = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-01T00:00:00Z',
    ...overrides,
});

describe('deriveViewerState — history', () => {
    it('copies a populated history array verbatim and preserves order', () => {
        const history: HistoryEntry[] = [
            h({ step: 'specify', at: '2026-04-01T00:00:00Z' }),
            h({ step: 'plan', at: '2026-04-02T00:00:00Z', from: { step: 'specify', substep: null } }),
            h({ step: 'tasks', at: '2026-04-03T00:00:00Z', from: { step: 'plan', substep: null } }),
        ];
        const ctx = makeContext({ history });
        const state = deriveViewerState(ctx);
        expect(state.history).toEqual(history);
        expect(state.history[0]).toBe(history[0]);
        expect(state.history[2].step).toBe('tasks');
    });

    it('defaults to [] when history is missing on the context', () => {
        const ctx = makeContext();
        delete (ctx as Record<string, unknown>).history;
        const state = deriveViewerState(ctx as SpecContext);
        expect(state.history).toEqual([]);
    });

    it('returns [] when history is an empty array', () => {
        const ctx = makeContext({ history: [] });
        const state = deriveViewerState(ctx);
        expect(state.history).toEqual([]);
    });
});
