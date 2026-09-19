import {
    deriveStepBadges,
    derivePulse,
    deriveHighlights,
    deriveViewerState,
    deriveActiveSubstep,
    isStepCompleted,
} from '../../../src/features/spec-viewer/stateDerivation';
import {
    SpecContext,
    StepHistoryEntry,
} from '../../../src/core/types/specContext';

function baseCtx(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit-companion',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        history: [],
        ...overrides,
    };
}

// Helper: build a `stepHistory` map for tests that exercise the derived-shape
// code paths directly. (`stepHistory` is no longer on disk; the viewer
// derives it from `history[]` — but the derivation functions all accept it as
// an optional explicit argument so tests can drive them deterministically.)
type SH = Record<string, StepHistoryEntry>;

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
            history: [
                { step: 'specify',   substep: null, kind: 'start',    from: { step: null, substep: null },        by: 'extension', at: 't1' },
                { step: 'specify',   substep: null, kind: 'complete',                                             by: 'extension', at: 't2' },
                { step: 'plan',      substep: null, kind: 'start',    from: { step: 'specify', substep: null },   by: 'extension', at: 't3' },
                { step: 'plan',      substep: null, kind: 'complete',                                             by: 'extension', at: 't4' },
                { step: 'tasks',     substep: null, kind: 'start',    from: { step: 'plan', substep: null },      by: 'extension', at: 't5' },
                { step: 'tasks',     substep: null, kind: 'complete',                                             by: 'extension', at: 't6' },
                { step: 'implement', substep: null, kind: 'start',    from: { step: 'tasks', substep: null },     by: 'extension', at: 't7' },
                { step: 'implement', substep: null, kind: 'complete',                                             by: 'extension', at: 't8' },
            ],
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
    it('plan with no history → not-started', () => {
        const ctx = baseCtx();
        expect(deriveStepBadges(ctx).plan).toBe('not-started');
    });

    it('startedAt set + completedAt null on currentStep → in-progress', () => {
        const ctx = baseCtx({ currentStep: 'plan' });
        const sh: SH = { plan: { startedAt: '2026-04-01T00:00:00Z', completedAt: null } };
        expect(deriveStepBadges(ctx, sh).plan).toBe('in-progress');
    });

    it('both startedAt and completedAt → completed', () => {
        const ctx = baseCtx();
        const sh: SH = { plan: { startedAt: 'a', completedAt: 'b' } };
        expect(deriveStepBadges(ctx, sh).plan).toBe('completed');
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
        const ctx = baseCtx({ status: 'planning', currentStep: 'plan' });
        const sh: SH = {
            specify: { startedAt: 'a', completedAt: 'b' },
            plan: { startedAt: 'c', completedAt: null },
        };
        expect(derivePulse(ctx, sh)).toBe('plan');
    });

    it('highlights contains only steps with completedAt set', () => {
        const ctx = baseCtx();
        const sh: SH = {
            specify: { startedAt: 'a', completedAt: 'b' },
            plan: { startedAt: 'c', completedAt: null },
        };
        expect(deriveHighlights(ctx, sh)).toEqual(['specify']);
    });
});

describe('deriveActiveSubstep (US4)', () => {
    it('surfaces first in-progress substep', () => {
        const ctx = baseCtx();
        const sh: SH = {
            specify: {
                startedAt: 'a',
                completedAt: null,
                substeps: [
                    { name: 'outline', startedAt: 'a', completedAt: 'a2' },
                    { name: 'validate-checklist', startedAt: 'b', completedAt: null },
                ],
            },
        };
        expect(deriveActiveSubstep(ctx, sh)).toEqual({
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

    it('step with no startedAt → true if before currentStep (inferred completion)', () => {
        const history = {};
        expect(isStepCompleted('specify', 'implement', history)).toBe(true);
    });
});

describe('deriveStepBadges — inferred completion', () => {
    it('currentStep=implement, all steps startedAt only → specify/plan/tasks completed, implement in-progress', () => {
        const ctx = baseCtx({ currentStep: 'implement' });
        const sh: SH = {
            specify: { startedAt: 't1', completedAt: null },
            plan: { startedAt: 't2', completedAt: null },
            tasks: { startedAt: 't3', completedAt: null },
            implement: { startedAt: 't4', completedAt: null },
        };
        const badges = deriveStepBadges(ctx, sh);
        expect(badges.specify).toBe('completed');
        expect(badges.plan).toBe('completed');
        expect(badges.tasks).toBe('completed');
        expect(badges.implement).toBe('in-progress');
    });

    it('currentStep=tasks, specify and plan startedAt only → both completed', () => {
        const ctx = baseCtx({ currentStep: 'tasks' });
        const sh: SH = {
            specify: { startedAt: 't1', completedAt: null },
            plan: { startedAt: 't2', completedAt: null },
            tasks: { startedAt: 't3', completedAt: null },
        };
        const badges = deriveStepBadges(ctx, sh);
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
        });
        const sh: SH = {
            specify: { startedAt: 'a', completedAt: null },
            plan: { startedAt: 'b', completedAt: null },
            tasks: { startedAt: 'c', completedAt: null },
            implement: { startedAt: 'd', completedAt: null },
        };
        expect(derivePulse(ctx, sh)).toBe('implement');
    });
});

describe('deriveHighlights — includes inferred-completed steps', () => {
    it('highlights steps before currentStep even without completedAt', () => {
        const ctx = baseCtx({ currentStep: 'implement' });
        const sh: SH = {
            specify: { startedAt: 'a', completedAt: null },
            plan: { startedAt: 'b', completedAt: null },
            tasks: { startedAt: 'c', completedAt: null },
            implement: { startedAt: 'd', completedAt: null },
        };
        const highlights = deriveHighlights(ctx, sh);
        expect(highlights).toContain('specify');
        expect(highlights).toContain('plan');
        expect(highlights).toContain('tasks');
        expect(highlights).not.toContain('implement');
    });
});

describe('deriveViewerState — Activity refresh payload completeness (#278)', () => {
    it('carries full history, per-task taskSummaries, and filesModified from the context', () => {
        const history = [
            { step: 'implement', substep: null, kind: 'start', from: { step: 'tasks', substep: null }, by: 'extension', at: 't1' },
            { step: 'implement', substep: null, kind: 'complete', by: 'ai', at: 't2' },
        ];
        const ctx = baseCtx({
            currentStep: 'implement',
            status: 'implementing',
            history: history as any,
            task_summaries: {
                T001: { status: 'DONE', did: 'wired the mock', files: ['a.ts'] },
                T002: { status: 'DONE_WITH_CONCERNS', did: 'added the test', files: ['b.ts'], concerns: ['flaky'] },
            },
            files_modified: ['a.ts', 'b.ts'],
        } as any);

        const vs = deriveViewerState(ctx, 'implement');

        // Full step history — the step-progression view re-renders from this, not a partial.
        expect(vs.history).toEqual(history);
        // Per-task summaries — the Tasks card reads these.
        expect(vs.taskSummaries).toEqual((ctx as any).task_summaries);
        expect(Object.keys(vs.taskSummaries ?? {})).toEqual(['T001', 'T002']);
        // Modified-files list — the Files card reads this.
        expect(vs.filesModified).toEqual(['a.ts', 'b.ts']);
    });
});
