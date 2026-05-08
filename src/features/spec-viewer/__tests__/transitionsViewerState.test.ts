import { deriveViewerState } from '../stateDerivation';
import type { SpecContext, Transition } from '../../../core/types/specContext';

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
        stepHistory: {},
        transitions: [],
        ...overrides,
    };
}

const t = (overrides: Partial<Transition> = {}): Transition => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-01T00:00:00Z',
    ...overrides,
});

describe('deriveViewerState — transitions', () => {
    it('copies a populated transitions array verbatim and preserves order', () => {
        const transitions: Transition[] = [
            t({ step: 'specify', at: '2026-04-01T00:00:00Z' }),
            t({ step: 'plan', at: '2026-04-02T00:00:00Z', from: { step: 'specify', substep: null } }),
            t({ step: 'tasks', at: '2026-04-03T00:00:00Z', from: { step: 'plan', substep: null } }),
        ];
        const ctx = makeContext({ transitions });
        const state = deriveViewerState(ctx);
        expect(state.transitions).toEqual(transitions);
        expect(state.transitions[0]).toBe(transitions[0]);
        expect(state.transitions[2].step).toBe('tasks');
    });

    it('defaults to [] when transitions is missing on the context', () => {
        const ctx = makeContext();
        delete (ctx as Record<string, unknown>).transitions;
        const state = deriveViewerState(ctx as SpecContext);
        expect(state.transitions).toEqual([]);
    });

    it('returns [] when transitions is an empty array', () => {
        const ctx = makeContext({ transitions: [] });
        const state = deriveViewerState(ctx);
        expect(state.transitions).toEqual([]);
    });
});
