/**
 * Run-recovery detection (issue #418).
 *
 * When a step is in flight but nothing on disk has changed for a long time, the
 * run may have quietly died (the terminal was closed, the agent crashed, the
 * one-shot host stopped). The viewer surfaces a hedged "still running?" strip so
 * the user can Resume or set the status by hand — it NEVER changes status on its
 * own, and it is computed purely at render time from the newest file mtime, so
 * there is no polling.
 *
 * The thresholds are deliberately generous and per-step: `specify`/`plan` do a
 * lot of thinking between writes, so they get a long fuse; `implement` writes
 * frequently (one journal entry per task), so a long quiet there is a stronger
 * signal something stalled. Heeds the #281 false-positive precedent — err toward
 * NOT nagging.
 */

import { isInFlightStatus } from '../../core/types/specContext';

/** Per-step quiet thresholds, in minutes, before the affordance appears. */
const STEP_QUIET_MINUTES: Record<string, number> = {
    specify: 45,
    clarify: 45,
    plan: 45,
    analyze: 40,
    tasks: 30,
    implement: 25,
};

/** Fallback threshold for any step not listed above. */
const DEFAULT_QUIET_MINUTES = 40;

export interface RunRecoveryInput {
    /** Current step name from `.spec-context.json` (e.g. "implement"). */
    currentStep: string | undefined;
    /** Current status from `.spec-context.json` (e.g. "implementing"). */
    status: string | undefined;
    /** Newest mtime (ms epoch) across spec-context, events log, and spec `*.md`. */
    newestActivityMs: number | undefined;
    /** Now, in ms epoch (injected so the derivation stays pure/testable). */
    nowMs: number;
}

export interface RunRecoveryState {
    /** Whether to render the "still running?" strip. */
    show: boolean;
    /** Human-readable line, e.g. "No activity for 34m — still running?". */
    message: string;
    /** Whole minutes since the newest activity. */
    minutesQuiet: number;
}

const HIDDEN: RunRecoveryState = { show: false, message: '', minutesQuiet: 0 };

/** Threshold (minutes) for a given step. */
export function quietThresholdMinutes(step: string | undefined): number {
    if (step && step in STEP_QUIET_MINUTES) return STEP_QUIET_MINUTES[step];
    return DEFAULT_QUIET_MINUTES;
}

/**
 * Decide whether to show the run-recovery affordance. Only fires when a step is
 * genuinely in flight and the newest on-disk activity is older than the step's
 * quiet threshold.
 */
export function computeRunRecovery(input: RunRecoveryInput): RunRecoveryState {
    const { currentStep, status, newestActivityMs, nowMs } = input;

    if (!isInFlightStatus(status)) return HIDDEN;
    if (newestActivityMs === undefined || !Number.isFinite(newestActivityMs)) return HIDDEN;

    const elapsedMs = nowMs - newestActivityMs;
    if (elapsedMs <= 0) return HIDDEN;

    const minutesQuiet = Math.floor(elapsedMs / 60_000);
    if (minutesQuiet < quietThresholdMinutes(currentStep)) return HIDDEN;

    return {
        show: true,
        message: `No activity for ${minutesQuiet}m — still running?`,
        minutesQuiet,
    };
}
