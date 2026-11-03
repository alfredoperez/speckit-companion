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
