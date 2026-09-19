import {
    shouldCloseImplement,
    ImplementCloseContext,
    ImplementCloseProgress,
} from '../implementCloseGuard';

const progress = (completed: number, total: number): ImplementCloseProgress => ({
    completedTasks: completed,
    totalTasks: total,
});

describe('shouldCloseImplement (Issue #244 — close implement when all tasks checked)', () => {
    it('closes when implement is underway (currentStep) and all tasks are checked', () => {
        const ctx: ImplementCloseContext = {
            currentStep: 'implement',
            status: 'implementing',
            history: [{ step: 'implement', substep: null, kind: 'start' }],
        };
        expect(shouldCloseImplement(ctx, progress(3, 3))).toBe(true);
    });

    it('closes when underway is inferred only from an implement history entry', () => {
        // status not yet 'implementing', currentStep stale — but implement started.
        const ctx: ImplementCloseContext = {
            currentStep: 'tasks',
            status: 'ready-to-implement',
            history: [{ step: 'implement', substep: null, kind: 'start' }],
        };
        expect(shouldCloseImplement(ctx, progress(2, 2))).toBe(true);
    });

    it('does NOT close a fast-path spec parked at ready-to-implement (no implement underway)', () => {
        // FR-008 / SC-004: every box may already be checked, but implement has not
        // started — preserve the deliberate pause that waits for a manual Implement.
        const ctx: ImplementCloseContext = {
            currentStep: 'tasks',
            status: 'ready-to-implement',
            history: [
                { step: 'specify', substep: null, kind: 'complete' },
                { step: 'plan', substep: 'fast-path', kind: 'complete' },
                { step: 'tasks', substep: 'fast-path', kind: 'complete' },
            ],
        };
        expect(shouldCloseImplement(ctx, progress(2, 2))).toBe(false);
    });

    it('does NOT close a mid-flight spec with an unchecked task', () => {
        // FR-006 / SC-003.
        const ctx: ImplementCloseContext = {
            currentStep: 'implement',
            status: 'implementing',
            history: [{ step: 'implement', substep: null, kind: 'start' }],
        };
        expect(shouldCloseImplement(ctx, progress(2, 3))).toBe(false);
    });

    it('does NOT close when there are zero task markers (0/0 is not done)', () => {
        // FR-009.
        const ctx: ImplementCloseContext = {
            currentStep: 'implement',
            status: 'implementing',
            history: [{ step: 'implement', substep: null, kind: 'start' }],
        };
        expect(shouldCloseImplement(ctx, progress(0, 0))).toBe(false);
    });

    it.each(['implemented', 'completed', 'archived'])(
        'does NOT re-close a spec already in terminal status %s',
        status => {
            // FR-007 — no re-close, no backward clobber.
            const ctx: ImplementCloseContext = {
                currentStep: 'implement',
                status,
                history: [
                    { step: 'implement', substep: null, kind: 'start' },
                    { step: 'implement', substep: null, kind: 'complete' },
                ],
            };
            expect(shouldCloseImplement(ctx, progress(3, 3))).toBe(false);
        },
    );

    it('is idempotent — does NOT append a second close when implement is already closed', () => {
        // FR-005 / SC-002: implement underway + all done, but a step-level complete
        // already exists → no second close. Status left at implementing here to
        // isolate the history-based idempotency guard from the status guard.
        const ctx: ImplementCloseContext = {
            currentStep: 'implement',
            status: 'implementing',
            history: [
                { step: 'implement', substep: null, kind: 'start' },
                { step: 'implement', substep: null, kind: 'complete' },
                // A backstop per-task finish appended AFTER the step close must not
                // hide the real completion.
                { step: 'implement', substep: null, task: 'T003', kind: 'complete' },
            ],
        };
        expect(shouldCloseImplement(ctx, progress(3, 3))).toBe(false);
    });

    it('handles a null/missing context (no recorded state yet)', () => {
        expect(shouldCloseImplement(null, progress(2, 2))).toBe(false);
        expect(shouldCloseImplement(undefined, progress(2, 2))).toBe(false);
    });
});
