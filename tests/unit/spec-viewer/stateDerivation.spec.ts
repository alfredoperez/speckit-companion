import {
    deriveStepBadges,
    derivePulse,
    deriveHighlights,
    deriveViewerState,
    deriveActiveSubstep,
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

    it('startedAt set + completedAt null → in-progress', () => {
        const ctx = baseCtx({
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
