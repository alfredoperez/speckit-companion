import {
    shouldSettleArtifactStep,
    ArtifactSettleContext,
} from '../artifactSettleGuard';

describe('shouldSettleArtifactStep (Issue #324 — settle specify/plan from artifact stability)', () => {
    describe('specify', () => {
        it('settles a stock spec stuck at specifying (start, no complete)', () => {
            const ctx: ArtifactSettleContext = {
                currentStep: 'specify',
                status: 'specifying',
                history: [{ step: 'specify', substep: null, kind: 'start' }],
            };
            expect(shouldSettleArtifactStep(ctx, 'specify')).toBe(true);
        });

        it('does NOT settle once specify is already specified (no double-write)', () => {
            const ctx: ArtifactSettleContext = {
                currentStep: 'specify',
                status: 'specified',
                history: [
                    { step: 'specify', substep: null, kind: 'start' },
                    { step: 'specify', substep: null, kind: 'complete' },
                ],
            };
            expect(shouldSettleArtifactStep(ctx, 'specify')).toBe(false);
        });

        it('is idempotent — does NOT re-close when a step-level complete already exists', () => {
            // Status left at specifying to isolate the history idempotency guard
            // from the status guard.
            const ctx: ArtifactSettleContext = {
                currentStep: 'specify',
                status: 'specifying',
                history: [
                    { step: 'specify', substep: null, kind: 'start' },
                    { step: 'specify', substep: null, kind: 'complete' },
                ],
            };
            expect(shouldSettleArtifactStep(ctx, 'specify')).toBe(false);
        });

        it('does NOT settle a fast-path spec that folded past specify (currentStep moved)', () => {
            const ctx: ArtifactSettleContext = {
                currentStep: 'tasks',
                status: 'ready-to-implement',
                history: [
                    { step: 'specify', substep: null, kind: 'complete' },
                    { step: 'plan', substep: 'fast-path', kind: 'complete' },
                    { step: 'tasks', substep: 'fast-path', kind: 'complete' },
                ],
            };
            expect(shouldSettleArtifactStep(ctx, 'specify')).toBe(false);
        });
    });

    describe('plan', () => {
        it('settles a stock spec stuck at planning (start, no complete)', () => {
            const ctx: ArtifactSettleContext = {
                currentStep: 'plan',
                status: 'planning',
                history: [
                    { step: 'specify', substep: null, kind: 'complete' },
                    { step: 'plan', substep: null, kind: 'start' },
                ],
            };
            expect(shouldSettleArtifactStep(ctx, 'plan')).toBe(true);
        });

        it('does NOT settle plan while the spec is still on specify', () => {
            // A spec.md write must not close plan; currentStep gates it.
            const ctx: ArtifactSettleContext = {
                currentStep: 'specify',
                status: 'specifying',
                history: [{ step: 'specify', substep: null, kind: 'start' }],
            };
            expect(shouldSettleArtifactStep(ctx, 'plan')).toBe(false);
        });
    });

    it('does NOT settle when status disagrees with the in-flight form (e.g. planning while on specify)', () => {
        const ctx: ArtifactSettleContext = {
            currentStep: 'specify',
            status: 'planning',
            history: [{ step: 'specify', substep: null, kind: 'start' }],
        };
        expect(shouldSettleArtifactStep(ctx, 'specify')).toBe(false);
    });

    it.each(['implemented', 'completed', 'archived'])(
        'does NOT settle a terminal spec (status %s) — no backward clobber',
        status => {
            const ctx: ArtifactSettleContext = {
                currentStep: 'specify',
                status,
                history: [{ step: 'specify', substep: null, kind: 'start' }],
            };
            expect(shouldSettleArtifactStep(ctx, 'specify')).toBe(false);
        },
    );

    it('handles a null/missing context (no recorded state yet)', () => {
        expect(shouldSettleArtifactStep(null, 'specify')).toBe(false);
        expect(shouldSettleArtifactStep(undefined, 'plan')).toBe(false);
    });
});
