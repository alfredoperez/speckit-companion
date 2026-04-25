import {
    isStepCompleted,
    deriveStepBadges,
    derivePulse,
    deriveHighlights,
    deriveActiveSubstep,
    deriveViewerState,
} from '../stateDerivation';
import type { SpecContext, StepName } from '../../../core/types/specContext';

// Mock footerActions to avoid pulling in vscode dependency
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
        const ctx = makeContext({ currentStep: 'tasks', stepHistory: {} });
        const badges = deriveStepBadges(ctx);
        expect(badges['specify']).toBe('completed');
        expect(badges['plan']).toBe('completed');
        expect(badges['tasks']).toBe('not-started');
    });

    it('marks step with startedAt at currentStep as in-progress', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            stepHistory: { tasks: { startedAt: '2026-01-01', completedAt: null } },
        });
        const badges = deriveStepBadges(ctx);
        expect(badges['tasks']).toBe('in-progress');
    });

    it('marks all steps completed when all have completedAt', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' },
                plan: { startedAt: '2026-01-02', completedAt: '2026-01-03' },
                tasks: { startedAt: '2026-01-03', completedAt: '2026-01-04' },
            },
        });
        const badges = deriveStepBadges(ctx);
        expect(badges['specify']).toBe('completed');
        expect(badges['plan']).toBe('completed');
        expect(badges['tasks']).toBe('completed');
    });
});

describe('derivePulse', () => {
    it('returns null when no step has startedAt without completion', () => {
        const ctx = makeContext({ currentStep: 'tasks', stepHistory: {} });
        expect(derivePulse(ctx)).toBeNull();
    });

    it('returns the in-progress step', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            stepHistory: { plan: { startedAt: '2026-01-01', completedAt: null } },
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
        const ctx = makeContext({ currentStep: 'tasks', stepHistory: {} });
        const highlights = deriveHighlights(ctx);
        expect(highlights).toContain('specify');
        expect(highlights).toContain('plan');
        expect(highlights).not.toContain('tasks');
    });
});

describe('deriveActiveSubstep', () => {
    it('falls back to top-level `progress` when stepHistory.substeps is empty', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            stepHistory: {},
            // top-level `progress` is a tolerated extra field on .spec-context.json
            progress: 'exploring',
        } as Partial<SpecContext> as SpecContext);
        expect(deriveActiveSubstep(ctx)).toEqual({ step: 'specify', name: 'exploring' });
    });

    it('returns null when neither stepHistory.substeps nor progress is present', () => {
        const ctx = makeContext({ currentStep: 'plan', stepHistory: {} });
        expect(deriveActiveSubstep(ctx)).toBeNull();
    });

    it('prefers stepHistory.substeps over top-level progress', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            stepHistory: {
                specify: {
                    startedAt: '2026-01-01',
                    completedAt: null,
                    substeps: [{ name: 'writing-spec', startedAt: '2026-01-01', completedAt: null }],
                },
            },
            progress: 'exploring',
        } as Partial<SpecContext> as SpecContext);
        expect(deriveActiveSubstep(ctx)).toEqual({ step: 'specify', name: 'writing-spec' });
    });
});

describe('deriveViewerState', () => {
    it('produces correct state for SDD auto incomplete stepHistory', () => {
        // Simulates what SDD auto leaves behind
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'implementing', // coerced from "active"
            stepHistory: { specify: { startedAt: '2026-01-01', completedAt: null } },
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
