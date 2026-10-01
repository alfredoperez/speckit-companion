import { STATUS_OWNING_STEP, isInFlightStatus, isSettledStatus, type Status } from '../../../src/core/types/specContext';

export const IMPLEMENT_STEP = 'implement';
export const CONVERGE_STEP = 'converge';

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

/** Converge owns no status, so it reads as running from its history alone: a start with no finish on an unshipped spec. */
export function isConvergeInFlight(run: StepRunState): boolean {
    const entry = run.stepHistory?.[CONVERGE_STEP];
    if (!entry?.startedAt || entry.completedAt) return false;
    if (run.stepBadges?.[CONVERGE_STEP] === 'completed') return false;
    return run.status !== 'completed' && run.status !== 'archived';
}
