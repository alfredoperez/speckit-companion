// Pure types and wording for a spec-kit run; safe to bundle into the webview.
export type EngineStepState = 'done' | 'paused' | 'failed' | 'running';

export interface EngineStep {
    id: string;
    state: EngineStepState;
    gate: boolean;
    /** Whole seconds between the step starting and finishing; absent while it runs or waits. */
    seconds?: number;
}

export interface EngineRun {
    runId: string;
    workflowId: string;
    slug: string;
    status: string;
    steps: EngineStep[];
    /** Seconds the engine spent in steps that finished, not counting a wait at a gate. */
    workSeconds: number;
    /** The gate the run is waiting at, when it is paused. */
    pausedAt?: string;
}

export type GateVerdict = 'approve' | 'reject';

/** The bundled bugfix workflow's review gate, whose options are `[approve, reject]` in that order. */
const BUNDLED_REVIEW_GATE = { workflow: 'bugfix', step: 'review-assessment', options: ['approve', 'reject'] as const };

const RUN_ID = /^\w[\w.-]*$/;

/**
 * The number to type at the gate's prompt for a verdict, when the run waits at the bundled review gate
 * and its id is safe to put on a command line. Any other gate gets no buttons.
 */
export function gateChoice(run: Pick<EngineRun, 'runId' | 'workflowId' | 'pausedAt'> | undefined, verdict: GateVerdict): string | undefined {
    if (!run || run.workflowId !== BUNDLED_REVIEW_GATE.workflow || run.pausedAt !== BUNDLED_REVIEW_GATE.step) return undefined;
    if (!RUN_ID.test(run.runId)) return undefined;
    return String(BUNDLED_REVIEW_GATE.options.indexOf(verdict) + 1);
}

/** The command that picks a paused run back up; undefined when the id is not safe for a command line. */
export function resumeCommand(runId: string): string | undefined {
    return RUN_ID.test(runId) ? `specify workflow resume ${runId}` : undefined;
}

/** "39s", "1m 48s", "1h 02m". */
export function formatSeconds(seconds: number): string {
    const whole = Math.max(0, Math.round(seconds));
    if (whole < 60) return `${whole}s`;
    const minutes = Math.floor(whole / 60);
    if (minutes < 60) return `${minutes}m ${String(whole % 60).padStart(2, '0')}s`;
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** "review" for `review-assessment`: the first word of the step id. */
export function gateLabel(stepId: string): string {
    return stepId.split(/[-_]/)[0] || stepId;
}
