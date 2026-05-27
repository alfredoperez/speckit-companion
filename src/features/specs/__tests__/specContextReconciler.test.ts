import { reconcile, detectCurrentStepDrift } from '../specContextReconciler';
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

const h = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('reconcile', () => {
    it('returns null when context is already clean', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            history: [
                h({ step: 'specify', from: { step: null, substep: null } }),
                h({ step: 'specify', from: { step: 'specify', substep: null }, at: '2026-04-29T00:01:00Z' }),
                h({ step: 'plan', from: { step: 'specify', substep: null }, at: '2026-04-29T00:02:00Z' }),
            ],
        });
        expect(reconcile(ctx)).toBeNull();
    });

    it('fixes non-canonical status based on currentStep', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'active' as any,
            history: [],
        });
        const result = reconcile(ctx)!;
        expect(result).not.toBeNull();
        expect(result.status).toBe('tasking');
    });

    it('uses completed status when last history entry for currentStep is a completion', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            status: 'bogus' as any,
            history: [
                h({ step: 'specify', from: { step: null, substep: null }, at: '2026-01-01' }),
                h({ step: 'specify', from: { step: 'specify', substep: null }, at: '2026-01-02' }),
            ],
        });
        const result = reconcile(ctx)!;
        expect(result.status).toBe('specified');
    });

    it('leaves a valid status alone even with mismatched history', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            history: [
                // last entry is for "specify", not "plan" — drift, but status is valid
                h({ step: 'specify', from: { step: null, substep: null } }),
            ],
        });
        expect(reconcile(ctx)).toBeNull();
    });

    // Regression: the user's exact production file. Old preamble (d) told the
    // AI to atomically append `plan-start` + flip currentStep="plan" on the
    // /speckit.specify completion, leaving the AI's specify-completion status
    // ("specified") inconsistent with currentStep ("plan"). The viewer then
    // renders a phantom "Generating Plan…" forever. Reconciler must roll
    // currentStep back to match the completed-form status.
    it('rolls currentStep back when status indicates a different (earlier) step', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'specified',
            history: [
                h({ step: 'specify', from: { step: null, substep: null } }),
                h({ step: 'specify', from: { step: 'specify', substep: null }, at: '2026-04-29T00:01:00Z' }),
                h({ step: 'plan',    from: { step: 'specify', substep: null }, at: '2026-04-29T00:01:00Z' }),
            ],
        });
        const result = reconcile(ctx)!;
        expect(result).not.toBeNull();
        expect(result.currentStep).toBe('specify');
        expect(result.status).toBe('specified');
    });

    it('rolls currentStep back from tasks→plan when status=planned', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'planned',
            history: [
                h({ step: 'plan', from: { step: 'specify', substep: null } }),
                h({ step: 'plan', from: { step: 'plan',    substep: null }, at: '2026-04-29T00:01:00Z' }),
                h({ step: 'tasks',from: { step: 'plan',    substep: null }, at: '2026-04-29T00:01:00Z' }),
            ],
        });
        const result = reconcile(ctx)!;
        expect(result.currentStep).toBe('plan');
        expect(result.status).toBe('planned');
    });

    it('does NOT roll back when currentStep already matches the status owner', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            status: 'specified',
            history: [
                h({ step: 'specify', from: { step: null, substep: null } }),
                h({ step: 'specify', from: { step: 'specify', substep: null }, at: '2026-04-29T00:01:00Z' }),
            ],
        });
        // Clean state — no rollback needed.
        expect(reconcile(ctx)).toBeNull();
    });
});

describe('detectCurrentStepDrift', () => {
    it('returns null when last history entry matches currentStep', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            history: [
                h({ step: 'specify', from: { step: null, substep: null } }),
                h({ step: 'plan', from: { step: 'specify', substep: null }, at: '2026-04-29T00:02:00Z' }),
            ],
        });
        expect(detectCurrentStepDrift(ctx)).toBeNull();
    });

    it('returns the drifting currentStep when no matching history entry exists', () => {
        // The exact failure mode the user hit: AI flipped currentStep to "plan"
        // without appending a plan-start entry to history.
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'specified',
            history: [
                h({ step: 'specify', from: { step: null, substep: null } }),
                h({ step: 'specify', from: { step: 'specify', substep: null }, at: '2026-04-29T00:01:00Z' }),
            ],
        });
        expect(detectCurrentStepDrift(ctx)).toBe('plan');
    });

    it('returns null when history is empty', () => {
        const ctx = makeContext({ history: [] });
        expect(detectCurrentStepDrift(ctx)).toBeNull();
    });
});
