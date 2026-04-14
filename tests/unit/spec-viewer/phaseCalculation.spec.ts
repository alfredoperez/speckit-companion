import { computeBadgeText } from '../../../src/features/spec-viewer/phaseCalculation';

describe('computeBadgeText — viewedStep awareness (R001)', () => {
    const ctx = {
        currentStep: 'tasks',
        progress: 'in-progress',
        status: 'tasking',
        stepHistory: {
            specify: { startedAt: 'a', completedAt: 'b' },
            plan: { startedAt: 'c', completedAt: 'd' },
            tasks: { startedAt: 'e', completedAt: null },
        },
    };

    it('returns current status label when viewedStep === currentStep', () => {
        expect(computeBadgeText(ctx, 'tasks')).toBe('CREATING TASKS...');
    });

    it('returns "PLAN COMPLETE" when viewing plan while tasks is in-progress', () => {
        expect(computeBadgeText(ctx, 'plan')).toBe('PLAN COMPLETE');
    });

    it('returns not-started label when viewed step has no history', () => {
        const ctx2 = { ...ctx, currentStep: 'plan', stepHistory: {
            specify: { startedAt: 'a', completedAt: 'b' },
        }};
        expect(computeBadgeText(ctx2, 'tasks')).toBe('TASKS NOT STARTED');
    });

    it('returns not-started label when viewed step is completed but doc does not exist', () => {
        expect(
            computeBadgeText(ctx, 'plan', { plan: false })
        ).toBe('PLAN NOT STARTED');
    });

    it('terminal status (completed) overrides viewedStep', () => {
        const c = { ...ctx, status: 'completed' };
        expect(computeBadgeText(c, 'plan')).toBe('COMPLETED');
    });

    it('omitting viewedStep preserves existing canonical-status behavior', () => {
        expect(computeBadgeText(ctx)).toBe('CREATING TASKS...');
    });
});
