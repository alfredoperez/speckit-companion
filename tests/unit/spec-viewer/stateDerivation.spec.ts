import {
    deriveStepBadges,
    derivePulse,
    deriveHighlights,
    deriveViewerState,
    deriveActiveSubstep,
    isStepCompleted,
} from '../../../src/features/spec-viewer/stateDerivation';
import { SpecContext } from '../../../src/core/types/specContext';

function baseCtx(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit-companion',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        stepHistory: {},
        transitions: [],
        ...overrides,
    };
}

describe('deriveViewerState (US1 — single status passthrough)', () => {
    it('returns ctx.status unchanged regardless of active step', () => {
        const ctx = baseCtx({ status: 'planning', currentStep: 'plan' });
        const onSpec = deriveViewerState(ctx, 'specify');
        const onPlan = deriveViewerState(ctx, 'plan');
        expect(onSpec.status).toBe('planning');
        expect(onPlan.status).toBe('planning');
    });

    it('pulse is null and highlights list all completed steps when status=completed', () => {
        const ctx = baseCtx({
            status: 'completed',
            currentStep: 'implement',
            stepHistory: {
                specify: { startedAt: 't1', completedAt: 't2' },
                plan: { startedAt: 't3', completedAt: 't4' },
                tasks: { startedAt: 't5', completedAt: 't6' },
                implement: { startedAt: 't7', completedAt: 't8' },
            },
        });
        const v = deriveViewerState(ctx);
        expect(v.pulse).toBeNull();
        expect(v.highlights).toEqual(
            expect.arrayContaining(['specify', 'plan', 'tasks', 'implement'])
        );
    });

    it('acceptance 1: Planning status invariant across Specify/Plan tabs', () => {
        const ctx = baseCtx({ status: 'planning', currentStep: 'plan' });
        expect(deriveViewerState(ctx, 'specify').status).toBe('planning');
        expect(deriveViewerState(ctx, 'plan').status).toBe('planning');
    });
});

describe('deriveStepBadges (US2 — history-driven, no file existence)', () => {
    it('plan with no stepHistory entry → not-started even if file-existence logic would say otherwise', () => {
        const ctx = baseCtx();
        expect(deriveStepBadges(ctx).plan).toBe('not-started');
    });

    it('startedAt set + completedAt null on currentStep → in-progress', () => {
        const ctx = baseCtx({
            currentStep: 'plan',
            stepHistory: {
                plan: { startedAt: '2026-04-01T00:00:00Z', completedAt: null },
            },
        });
        expect(deriveStepBadges(ctx).plan).toBe('in-progress');
    });

    it('both startedAt and completedAt → completed', () => {
        const ctx = baseCtx({
            stepHistory: {
                plan: { startedAt: 'a', completedAt: 'b' },
            },
        });
        expect(deriveStepBadges(ctx).plan).toBe('completed');
    });
});

describe('derivePulse / deriveHighlights (US5)', () => {
    it('pulse is null for status=completed', () => {
        const ctx = baseCtx({ status: 'completed' });
        expect(derivePulse(ctx)).toBeNull();
    });

    it('pulse is null for status=archived', () => {
        const ctx = baseCtx({ status: 'archived' });
        expect(derivePulse(ctx)).toBeNull();
    });

    it('pulse equals the step with startedAt set and completedAt null', () => {
        const ctx = baseCtx({
            status: 'planning',
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'c', completedAt: null },
            },
        });
        expect(derivePulse(ctx)).toBe('plan');
    });

    it('highlights contains only steps with completedAt set', () => {
        const ctx = baseCtx({
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'c', completedAt: null },
            },
        });
        expect(deriveHighlights(ctx)).toEqual(['specify']);
    });
});

describe('deriveActiveSubstep (US4)', () => {
    it('surfaces first in-progress substep', () => {
        const ctx = baseCtx({
            stepHistory: {
                specify: {
                    startedAt: 'a',
                    completedAt: null,
                    substeps: [
                        { name: 'outline', startedAt: 'a', completedAt: 'a2' },
                        { name: 'validate-checklist', startedAt: 'b', completedAt: null },
                    ],
                },
            },
        });
        expect(deriveActiveSubstep(ctx)).toEqual({
            step: 'specify',
            name: 'validate-checklist',
        });
    });

    it('returns null when no substep is active', () => {
        expect(deriveActiveSubstep(baseCtx())).toBeNull();
    });
});

describe('isStepCompleted — inferred completion from step ordering', () => {
    it('step before currentStep with startedAt but no completedAt → true', () => {
        const history = {
            specify: { startedAt: 't1', completedAt: null },
            plan: { startedAt: 't2', completedAt: null },
        };
        expect(isStepCompleted('specify', 'plan', history)).toBe(true);
    });

    it('step at currentStep with startedAt but no completedAt → false', () => {
        const history = {
            plan: { startedAt: 't1', completedAt: null },
        };
        expect(isStepCompleted('plan', 'plan', history)).toBe(false);
    });

    it('step after currentStep with startedAt but no completedAt → false', () => {
        const history = {
            tasks: { startedAt: 't1', completedAt: null },
        };
        expect(isStepCompleted('tasks', 'plan', history)).toBe(false);
    });

    it('step with explicit completedAt → true regardless of ordering', () => {
        const history = {
            implement: { startedAt: 't1', completedAt: 't2' },
        };
        expect(isStepCompleted('implement', 'specify', history)).toBe(true);
    });

    it('step with no startedAt → false even if before currentStep', () => {
        const history = {};
        expect(isStepCompleted('specify', 'implement', history)).toBe(false);
    });
});

describe('deriveStepBadges — inferred completion', () => {
    it('currentStep=implement, all steps startedAt only → specify/plan/tasks completed, implement in-progress', () => {
        const ctx = baseCtx({
            currentStep: 'implement',
            stepHistory: {
                specify: { startedAt: 't1', completedAt: null },
                plan: { startedAt: 't2', completedAt: null },
                tasks: { startedAt: 't3', completedAt: null },
                implement: { startedAt: 't4', completedAt: null },
            },
        });
        const badges = deriveStepBadges(ctx);
        expect(badges.specify).toBe('completed');
        expect(badges.plan).toBe('completed');
        expect(badges.tasks).toBe('completed');
        expect(badges.implement).toBe('in-progress');
    });

    it('currentStep=tasks, specify and plan startedAt only → both completed', () => {
        const ctx = baseCtx({
            currentStep: 'tasks',
            stepHistory: {
                specify: { startedAt: 't1', completedAt: null },
                plan: { startedAt: 't2', completedAt: null },
                tasks: { startedAt: 't3', completedAt: null },
            },
        });
        const badges = deriveStepBadges(ctx);
        expect(badges.specify).toBe('completed');
        expect(badges.plan).toBe('completed');
        expect(badges.tasks).toBe('in-progress');
    });
});

describe('derivePulse — inferred completion suppresses pulse on past steps', () => {
    it('does not pulse a step that has been passed by currentStep', () => {
        const ctx = baseCtx({
            status: 'implementing',
            currentStep: 'implement',
            stepHistory: {
                specify: { startedAt: 'a', completedAt: null },
                plan: { startedAt: 'b', completedAt: null },
                tasks: { startedAt: 'c', completedAt: null },
                implement: { startedAt: 'd', completedAt: null },
            },
        });
        expect(derivePulse(ctx)).toBe('implement');
    });
});

describe('deriveHighlights — includes inferred-completed steps', () => {
    it('highlights steps before currentStep even without completedAt', () => {
        const ctx = baseCtx({
            currentStep: 'implement',
            stepHistory: {
                specify: { startedAt: 'a', completedAt: null },
                plan: { startedAt: 'b', completedAt: null },
                tasks: { startedAt: 'c', completedAt: null },
                implement: { startedAt: 'd', completedAt: null },
            },
        });
        const highlights = deriveHighlights(ctx);
        expect(highlights).toContain('specify');
        expect(highlights).toContain('plan');
        expect(highlights).toContain('tasks');
        expect(highlights).not.toContain('implement');
    });
});
