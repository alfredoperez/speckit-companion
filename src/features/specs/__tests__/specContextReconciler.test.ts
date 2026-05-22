import { reconcile } from '../specContextReconciler';
import type { SpecContext } from '../../../core/types/specContext';

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

describe('reconcile', () => {
    it('returns null when context is already clean', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' },
                plan: { startedAt: '2026-01-02', completedAt: null },
            },
        });
        expect(reconcile(ctx)).toBeNull();
    });

    it('backfills missing stepHistory entries for steps before currentStep', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'tasking',
            stepHistory: {},
        });
        // New contract: backfill needs a real timestamp source (file mtime in
        // production, supplied here) rather than synthesizing `now`.
        const result = reconcile(ctx, '2026-01-05T00:00:00.000Z')!;
        expect(result).not.toBeNull();
        expect(result.stepHistory['specify']?.startedAt).toBeTruthy();
        expect(result.stepHistory['specify']?.completedAt).toBeTruthy();
        expect(result.stepHistory['plan']?.startedAt).toBeTruthy();
        expect(result.stepHistory['plan']?.completedAt).toBeTruthy();
    });

    it('sets completedAt for started steps before currentStep', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: null },
            },
        });
        const result = reconcile(ctx, '2026-01-05T00:00:00.000Z')!;
        expect(result).not.toBeNull();
        expect(result.stepHistory['specify']?.completedAt).toBeTruthy();
    });

    it('backfills startedAt for currentStep if missing', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'tasking',
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' },
                plan: { startedAt: '2026-01-02', completedAt: '2026-01-03' },
            },
        });
        const result = reconcile(ctx)!;
        expect(result).not.toBeNull();
        expect(result.stepHistory['tasks']?.startedAt).toBeTruthy();
        expect(result.stepHistory['tasks']?.completedAt).toBeNull();
    });

    it('fixes non-canonical status based on currentStep', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'active' as any,
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' },
                plan: { startedAt: '2026-01-02', completedAt: '2026-01-03' },
                tasks: { startedAt: '2026-01-03', completedAt: null },
            },
        });
        const result = reconcile(ctx)!;
        expect(result).not.toBeNull();
        expect(result.status).toBe('tasking');
    });

    it('handles SDD auto scenario: currentStep=tasks, only specify.startedAt', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'active' as any,
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: null },
            },
        });
        const result = reconcile(ctx, '2026-01-05T00:00:00.000Z')!;
        expect(result).not.toBeNull();
        // specify should be completed
        expect(result.stepHistory['specify']?.completedAt).toBeTruthy();
        // plan should be backfilled
        expect(result.stepHistory['plan']?.startedAt).toBeTruthy();
        expect(result.stepHistory['plan']?.completedAt).toBeTruthy();
        // tasks should have startedAt
        expect(result.stepHistory['tasks']?.startedAt).toBeTruthy();
        // status should be canonical
        expect(result.status).toBe('tasking');
    });

    it('does not touch steps after currentStep', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            stepHistory: {
                specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' },
                plan: { startedAt: '2026-01-02', completedAt: null },
            },
        });
        const result = reconcile(ctx);
        expect(result).toBeNull();
    });

    it('skips clarify and analyze sub-phases', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'tasking',
            stepHistory: {},
        });
        const result = reconcile(ctx)!;
        expect(result.stepHistory['clarify']).toBeUndefined();
        expect(result.stepHistory['analyze']).toBeUndefined();
    });

    describe('idempotence', () => {
        it('returns null when run on its own output', () => {
            const ctx = makeContext({
                currentStep: 'tasks',
                status: 'active' as any,
                stepHistory: {
                    specify: { startedAt: '2026-01-01', completedAt: null },
                },
                transitions: [
                    {
                        step: 'tasks',
                        substep: null,
                        from: { step: 'plan', substep: null },
                        by: 'extension',
                        at: '2026-01-05',
                    },
                ],
            });
            const first = reconcile(ctx);
            expect(first).not.toBeNull();
            // Running reconcile again on the corrected context yields no change.
            expect(reconcile(first!)).toBeNull();
        });
    });

    describe('fills only missing completedAt', () => {
        it('fills a preceding step missing completedAt from fallbackTimestamp', () => {
            const ctx = makeContext({
                currentStep: 'plan',
                status: 'planning',
                stepHistory: {
                    specify: { startedAt: '2026-01-01', completedAt: null },
                    plan: { startedAt: '2026-01-02', completedAt: null },
                },
            });
            const result = reconcile(ctx, '2026-03-03T03:03:03Z')!;
            expect(result).not.toBeNull();
            expect(result.stepHistory['specify'].completedAt).toBe('2026-03-03T03:03:03Z');
        });

        it('falls back to the last transition `at` when no fallbackTimestamp is given', () => {
            const ctx = makeContext({
                currentStep: 'plan',
                status: 'planning',
                stepHistory: {
                    specify: { startedAt: '2026-01-01', completedAt: null },
                    plan: { startedAt: '2026-01-02', completedAt: null },
                },
                transitions: [
                    {
                        step: 'plan',
                        substep: null,
                        from: { step: 'specify', substep: null },
                        by: 'extension',
                        at: '2026-02-02T02:02:02Z',
                    },
                ],
            });
            const result = reconcile(ctx)!;
            expect(result).not.toBeNull();
            expect(result.stepHistory['specify'].completedAt).toBe('2026-02-02T02:02:02Z');
        });

        it('never overwrites a preceding step that already has a real completedAt', () => {
            const ctx = makeContext({
                currentStep: 'tasks',
                status: 'tasking',
                stepHistory: {
                    specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' },
                    plan: { startedAt: '2026-01-02', completedAt: null },
                    tasks: { startedAt: '2026-01-05', completedAt: null },
                },
            });
            const result = reconcile(ctx, '2026-09-09T09:09:09Z')!;
            expect(result).not.toBeNull();
            // The pre-existing real value survives untouched.
            expect(result.stepHistory['specify'].completedAt).toBe('2026-01-02');
            // Only the missing one is filled from the fallback.
            expect(result.stepHistory['plan'].completedAt).toBe('2026-09-09T09:09:09Z');
        });
    });

    describe('no synthetic now', () => {
        it('backfilled values equal the provided fallbackTimestamp deterministically', () => {
            const fallback = '2026-07-07T07:07:07Z';
            const ctx = makeContext({
                currentStep: 'tasks',
                status: 'tasking',
                stepHistory: {},
            });
            const result = reconcile(ctx, fallback)!;
            expect(result).not.toBeNull();
            // Created entries for preceding steps use the exact fallback, not a fresh Date.
            expect(result.stepHistory['specify'].startedAt).toBe(fallback);
            expect(result.stepHistory['specify'].completedAt).toBe(fallback);
            expect(result.stepHistory['plan'].startedAt).toBe(fallback);
            expect(result.stepHistory['plan'].completedAt).toBe(fallback);
            // currentStep entry's startedAt also uses the fallback (not new Date()).
            expect(result.stepHistory['tasks'].startedAt).toBe(fallback);
        });
    });
});
