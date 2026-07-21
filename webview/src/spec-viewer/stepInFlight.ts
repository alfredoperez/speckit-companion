export const IMPLEMENT_STEP = 'implement';

// A Map, not an object: `status` is user-authored data, and an object lookup
// would resolve `constructor`/`toString` off the prototype.
const STATUS_TO_INFLIGHT_STEP = new Map<string, string>([
    ['specifying', 'specify'],
    ['planning', 'plan'],
    ['tasking', 'tasks'],
    ['implementing', IMPLEMENT_STEP],
]);

const SETTLED_STATUSES = new Set([
    'specified', 'planned', 'ready-to-implement', 'implemented', 'completed', 'archived',
]);

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
    return status ? STATUS_TO_INFLIGHT_STEP.get(status) : undefined;
}

export function isSettledStatus(status?: string | null): boolean {
    return status ? SETTLED_STATUSES.has(status) : false;
}

/** The single derivation of "is this step in flight" — every surface reads this one answer. */
export function isStepInFlight(stepName: string, run: StepRunState): boolean {
    // A recorded completion settles the step, even when the top-level `status`
    // still names it running — status can lag a journal-only `--finish` when no
    // hook flips it. History is the truth; a lagging status must not lock the panel.
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
