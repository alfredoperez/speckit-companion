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
        const result = reconcile(ctx)!;
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
        const result = reconcile(ctx)!;
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
        const result = reconcile(ctx)!;
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
});
