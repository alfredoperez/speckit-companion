import { STATUS_OWNING_STEP, isInFlightStatus, isSettledStatus, type Status } from '../../../src/core/types/specContext';

export const IMPLEMENT_STEP = 'implement';

export { isSettledStatus };

export interface StepRunState {
    status?: string | null;
    activeStep?: string | null;
    currentStep?: string | null;
    stepBadges?: Record<string, 'not-started' | 'in-progress' | 'completed'>;
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    taskCompletionPercent?: number;
}

/** The step a spec-level `status` says is running, or undefined when it names none. */
export function inFlightStepFor(status?: string | null): string | undefined {
    return status && isInFlightStatus(status) ? STATUS_OWNING_STEP.get(status as Status)!.step : undefined;
}

/** The single derivation of "is this step in flight" — every surface reads this one answer. */
export function isStepInFlight(stepName: string, run: StepRunState): boolean {
    // A recorded completion settles the step even when the top-level status still lags it.
    if (run.stepBadges?.[stepName] === 'completed') return false;
    if (run.stepHistory?.[stepName]?.completedAt) return false;

    const statusStep = inFlightStepFor(run.status);
    if (statusStep !== undefined) return statusStep === stepName;
    if (isSettledStatus(run.status)) return false;

    if (run.activeStep === stepName) return true;

    // Implement writes no document of its own, so without status guidance its
    // only local signal is unchecked boxes in tasks.md.
    return stepName === IMPLEMENT_STEP
        && run.currentStep === IMPLEMENT_STEP
        && (run.taskCompletionPercent ?? 0) < 100;
}
