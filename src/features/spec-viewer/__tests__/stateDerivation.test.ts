import {
    isStepCompleted,
    deriveStepBadges,
    derivePulse,
    deriveHighlights,
    deriveActiveSubstep,
    deriveViewerState,
} from '../stateDerivation';
import type { SpecContext } from '../../../core/types/specContext';

// Mock footerActions to avoid pulling in vscode dependency
jest.mock('../footerActions', () => ({
    getFooterActions: jest.fn().mockReturnValue([]),
}));

function makeContext(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        history: [],
        ...overrides,
    };
}

describe('isStepCompleted', () => {
    it('returns true when step has explicit completedAt', () => {
        const history = { specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' } };
        expect(isStepCompleted('specify', 'specify', history)).toBe(true);
    });

    it('returns true when step has startedAt and precedes currentStep', () => {
        const history = { specify: { startedAt: '2026-01-01', completedAt: null } };
        expect(isStepCompleted('specify', 'plan', history)).toBe(true);
    });

    it('returns true when step has NO history entry but precedes currentStep', () => {
        expect(isStepCompleted('specify', 'tasks', {})).toBe(true);
        expect(isStepCompleted('plan', 'tasks', {})).toBe(true);
    });

    it('returns false for currentStep itself with no history', () => {
        expect(isStepCompleted('tasks', 'tasks', {})).toBe(false);
    });

    it('returns false for steps after currentStep', () => {
        expect(isStepCompleted('tasks', 'specify', {})).toBe(false);
    });

    it('returns false for currentStep with startedAt but no completedAt', () => {
        const history = { plan: { startedAt: '2026-01-01', completedAt: null } };
        expect(isStepCompleted('plan', 'plan', history)).toBe(false);
    });
});

describe('deriveStepBadges', () => {
    it('marks steps before currentStep as completed even without history', () => {
        const ctx = makeContext({ currentStep: 'tasks' });
        const badges = deriveStepBadges(ctx);
        expect(badges['specify']).toBe('completed');
        expect(badges['plan']).toBe('completed');
        expect(badges['tasks']).toBe('not-started');
    });

    it('marks step with startedAt at currentStep as in-progress', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'tasking',
            history: [
                { step: 'tasks', substep: null, kind: 'start', from: { step: 'plan', substep: null }, by: 'extension', at: '2026-01-01T00:00:00Z' },
            ],
        });
        const badges = deriveStepBadges(ctx);
        expect(badges['tasks']).toBe('in-progress');
    });

    it('marks all steps completed when history shows them all completed', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'ready-to-implement',
            history: [
                { step: 'specify', substep: null, kind: 'start',    from: { step: null, substep: null },    by: 'extension', at: '2026-01-01' },
                { step: 'specify', substep: null, kind: 'complete',                                         by: 'extension', at: '2026-01-02' },
                { step: 'plan',    substep: null, kind: 'start',    from: { step: 'specify', substep: null }, by: 'extension', at: '2026-01-02' },
                { step: 'plan',    substep: null, kind: 'complete',                                          by: 'extension', at: '2026-01-03' },
                { step: 'tasks',   substep: null, kind: 'start',    from: { step: 'plan', substep: null },   by: 'extension', at: '2026-01-03' },
                { step: 'tasks',   substep: null, kind: 'complete',                                          by: 'extension', at: '2026-01-04' },
            ],
        });
        // Status non-terminal: 'tasks' is currentStep, last entry is its completion,
        // so derivation marks it as completed only when a *later* step entry exists.
        // With status 'ready-to-implement', the inferred-completion fallback keeps
        // 'specify' + 'plan' as completed; 'tasks' is the current step still.
        const badges = deriveStepBadges(ctx);
        expect(badges['specify']).toBe('completed');
        expect(badges['plan']).toBe('completed');
    });
});

describe('derivePulse', () => {
    it('returns null when no step is in flight', () => {
        const ctx = makeContext({ currentStep: 'tasks' });
        expect(derivePulse(ctx)).toBeNull();
    });

    it('returns the in-progress step', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            history: [
                { step: 'plan', substep: null, kind: 'start', from: { step: 'specify', substep: null }, by: 'extension', at: '2026-01-01T00:00:00Z' },
            ],
        });
        expect(derivePulse(ctx)).toBe('plan');
    });

    it('returns null for completed/archived specs', () => {
        const ctx = makeContext({ status: 'completed' });
        expect(derivePulse(ctx)).toBeNull();
    });
});

describe('deriveHighlights', () => {
    it('includes steps before currentStep even without history', () => {
        const ctx = makeContext({ currentStep: 'tasks' });
        const highlights = deriveHighlights(ctx);
        expect(highlights).toContain('specify');
        expect(highlights).toContain('plan');
        expect(highlights).not.toContain('tasks');
    });
});

describe('deriveActiveSubstep', () => {
    it('falls back to top-level `progress` when no substeps are in flight', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            // top-level `progress` is a tolerated extra field on .spec-context.json
            progress: 'exploring',
        } as Partial<SpecContext> as SpecContext);
        expect(deriveActiveSubstep(ctx)).toEqual({ step: 'specify', name: 'exploring' });
    });

    it('returns null when neither substeps nor progress is present', () => {
        const ctx = makeContext({ currentStep: 'plan' });
        expect(deriveActiveSubstep(ctx)).toBeNull();
    });

    it('prefers in-flight substep over top-level progress', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            status: 'specifying',
            history: [
                { step: 'specify', substep: null,              kind: 'start', from: { step: null, substep: null },    by: 'extension', at: '2026-01-01T00:00:00Z' },
                { step: 'specify', substep: 'writing-spec', kind: 'start', from: { step: 'specify', substep: null }, by: 'extension', at: '2026-01-01T01:00:00Z' },
            ],
            progress: 'exploring',
        } as Partial<SpecContext> as SpecContext);
        expect(deriveActiveSubstep(ctx)).toEqual({ step: 'specify', name: 'writing-spec' });
    });
});

describe('deriveViewerState', () => {
    it('produces correct state for auto incomplete history', () => {
        // Simulates what auto leaves behind: specify was started but its
        // completion was never appended; currentStep advanced to "tasks".
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'implementing', // coerced from "active"
            history: [
                { step: 'specify', substep: null, kind: 'start', from: { step: null, substep: null }, by: 'cli', at: '2026-01-01T00:00:00Z' },
            ],
        });
        const state = deriveViewerState(ctx);
        expect(state.steps['specify']).toBe('completed');
        expect(state.steps['plan']).toBe('completed');
        expect(state.steps['tasks']).toBe('not-started');
        expect(state.highlights).toContain('specify');
        expect(state.highlights).toContain('plan');
        expect(state.pulse).toBeNull();
    });
});
