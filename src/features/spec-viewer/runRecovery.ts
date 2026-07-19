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
 *
 * Past a much longer horizon the "did it die?" hypothesis stops being true —
 * nothing has been running for a month, so the strip switches to a `stale` mode
 * that says so and leads with marking the spec done instead of resuming (#452).
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

/**
 * Upper horizon, in minutes, past which "still running?" is the wrong question.
 * Three days: long enough that a run parked on a Friday evening and picked back
 * up on Monday morning is still framed as a live run, short enough that a spec
 * abandoned mid-pipeline stops asking a question nobody can answer yes to.
 */
const STALE_AFTER_MINUTES = 3 * 24 * 60;

/**
 * Terse elapsed-time label: minutes up to an hour, then hours, days, weeks.
 * Raw minutes read fine at 45m and become noise at 52633m (#452).
 */
export function formatQuiet(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 14) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
}

export interface RunRecoveryInput {
    /** Current step name from `.spec-context.json` (e.g. "implement"). */
    currentStep: string | undefined;
    /** Current status from `.spec-context.json` (e.g. "implementing"). */
    status: string | undefined;
    /** Newest mtime (ms epoch) across spec-context, events log, and spec `*.md`. */
    newestActivityMs: number | undefined;
    /** Now, in ms epoch (injected so the derivation stays pure/testable). */
    nowMs: number;
    /** Task completion of the tasks doc, 0-100. 100 while in flight = done-but-unmarked. */
    taskCompletionPercent?: number;
}

/**
 * `stalled` asks whether the run is still alive (Resume leads).
 * `stale` states that it is not (marking it done leads).
 */
export type RunRecoveryMode = 'stalled' | 'stale';

export interface RunRecoveryState {
    /** Whether to render the strip. */
    show: boolean;
    /** Which framing — and therefore which actions — the strip renders. */
    mode: RunRecoveryMode;
    /** Human-readable line, e.g. "No activity for 34m — still running?". */
    message: string;
    /** Whole minutes since the newest activity. */
    minutesQuiet: number;
}

const HIDDEN: RunRecoveryState = { show: false, mode: 'stalled', message: '', minutesQuiet: 0 };

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
    const { currentStep, status, newestActivityMs, nowMs, taskCompletionPercent } = input;

    if (!isInFlightStatus(status)) return HIDDEN;
    if (newestActivityMs === undefined || !Number.isFinite(newestActivityMs)) return HIDDEN;

    const elapsedMs = nowMs - newestActivityMs;
    if (elapsedMs <= 0) return HIDDEN;

    const minutesQuiet = Math.floor(elapsedMs / 60_000);
    if (minutesQuiet < quietThresholdMinutes(currentStep)) return HIDDEN;

    const quiet = formatQuiet(minutesQuiet);

    // Every task is checked off but the spec is still in flight: the work is
    // done and nobody marked it. That's a stronger signal than elapsed time, so
    // it wins the framing at any age past the lower bound.
    if (taskCompletionPercent === 100) {
        return {
            show: true,
            mode: 'stale',
            message: `All tasks done, quiet for ${quiet} — mark it complete?`,
            minutesQuiet,
        };
    }

    if (minutesQuiet >= STALE_AFTER_MINUTES) {
        return {
            show: true,
            mode: 'stale',
            message: `No activity for ${quiet} — this run looks abandoned.`,
            minutesQuiet,
        };
    }

    return {
        show: true,
        mode: 'stalled',
        message: `No activity for ${quiet} — still running?`,
        minutesQuiet,
    };
}
