import { inFlightStepFor, isSettledStatus, isStepInFlight } from '../stepInFlight';

describe('inFlightStepFor', () => {
    it('names the running step for each in-flight status', () => {
        expect(inFlightStepFor('specifying')).toBe('specify');
        expect(inFlightStepFor('planning')).toBe('plan');
        expect(inFlightStepFor('tasking')).toBe('tasks');
        expect(inFlightStepFor('implementing')).toBe('implement');
    });

    it('names no step for a settled, unknown, or missing status', () => {
        expect(inFlightStepFor('completed')).toBeUndefined();
        expect(inFlightStepFor('draft')).toBeUndefined();
        expect(inFlightStepFor(undefined)).toBeUndefined();
    });

    it('names no step for a status that collides with an Object prototype key', () => {
        expect(inFlightStepFor('constructor')).toBeUndefined();
        expect(inFlightStepFor('toString')).toBeUndefined();
    });
});

describe('isSettledStatus', () => {
    it('settles every terminal and step-complete status', () => {
        for (const status of ['specified', 'planned', 'ready-to-implement', 'implemented', 'completed', 'archived']) {
            expect(isSettledStatus(status)).toBe(true);
        }
        expect(isSettledStatus('implementing')).toBe(false);
        expect(isSettledStatus('draft')).toBe(false);
    });
});

describe('isStepInFlight', () => {
    it('runs only the step the in-flight status names', () => {
        const run = { status: 'implementing', currentStep: 'implement', taskCompletionPercent: 40 };
        expect(isStepInFlight('implement', run)).toBe(true);
        expect(isStepInFlight('tasks', run)).toBe(false);
        expect(isStepInFlight('plan', run)).toBe(false);
    });

    it('ignores a stale activeStep while the status names a different step', () => {
        expect(isStepInFlight('plan', { status: 'implementing', activeStep: 'plan' })).toBe(false);
    });

    it('runs no step on a settled status, whatever the percent says', () => {
        const run = { status: 'completed', currentStep: 'implement', taskCompletionPercent: 95 };
        expect(isStepInFlight('implement', run)).toBe(false);
        expect(isStepInFlight('tasks', run)).toBe(false);
    });

    it('falls back to local signals when the status gives no guidance', () => {
        expect(isStepInFlight('plan', { status: 'draft', activeStep: 'plan' })).toBe(true);
        expect(isStepInFlight('implement', { currentStep: 'implement', taskCompletionPercent: 60 })).toBe(true);
        expect(isStepInFlight('implement', { currentStep: 'implement', taskCompletionPercent: 100 })).toBe(false);
    });

    it('settles a step whose completion is recorded, even without status guidance', () => {
        expect(isStepInFlight('plan', {
            activeStep: 'plan',
            stepHistory: { plan: { startedAt: '2026-07-10T10:00:00Z', completedAt: '2026-07-10T10:05:00Z' } },
        })).toBe(false);
        expect(isStepInFlight('implement', {
            currentStep: 'implement',
            taskCompletionPercent: 60,
            stepBadges: { implement: 'completed' },
        })).toBe(false);
    });

    // #491: the tasks step finished (its completion is in history / its badge is
    // `completed`) but the top-level status still lags at `tasking`. A recorded
    // completion must win, so the panel settles instead of staying locked.
    it('settles the current step from history even when the status still names it running', () => {
        const fromBadge = {
            status: 'tasking',
            currentStep: 'tasks',
            activeStep: 'tasks',
            stepBadges: { tasks: 'completed' as const },
        };
        expect(isStepInFlight('tasks', fromBadge)).toBe(false);

        const fromHistory = {
            status: 'tasking',
            currentStep: 'tasks',
            activeStep: 'tasks',
            stepHistory: { tasks: { startedAt: '2026-07-10T10:00:00Z', completedAt: '2026-07-10T10:05:00Z' } },
        };
        expect(isStepInFlight('tasks', fromHistory)).toBe(false);
    });

    it('keeps a genuinely-running tasks step in flight when no completion is recorded', () => {
        const run = {
            status: 'tasking',
            currentStep: 'tasks',
            activeStep: 'tasks',
            stepHistory: { tasks: { startedAt: '2026-07-10T10:00:00Z', completedAt: null } },
        };
        expect(isStepInFlight('tasks', run)).toBe(true);
    });
});
