/**
 * Format an ISO timestamp as a relative-time string for the timeline.
 *
 * Buckets (round down):
 *   <60s         → "just now"
 *   <60min       → "Xm ago"
 *   <24h         → "Xh ago"
 *   >=1d         → "Xd ago"
 *
 * Invalid input returns "unknown".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
    if (!iso) return 'unknown';
    const past = new Date(iso).getTime();
    if (Number.isNaN(past)) return 'unknown';

    const deltaMs = now.getTime() - past;
    if (deltaMs < 0) return 'just now';

    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Format a millisecond span into a compact human string.
 *
 * Buckets:
 *   <1s          → "<1s"
 *   <60s         → "Xs"
 *   <60min       → "Xm Ys"  (Y omitted when 0)
 *   <24h         → "Xh Ym"
 *   >=24h        → "Xd Yh"
 *
 * Negative or NaN clamps to "<1s" / "unknown".
 */
export function formatElapsed(ms: number): string {
    if (Number.isNaN(ms)) return 'unknown';
    const clamped = Math.max(0, ms);
    if (clamped < 1000) return '<1s';

    const seconds = Math.floor(clamped / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    if (minutes < 60) return remSec === 0 ? `${minutes}m` : `${minutes}m ${remSec}s`;

    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    if (hours < 24) return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;

    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}

/**
 * Render a duration between two ISO timestamps. Pass `endIso = null` to use
 * `now` as the end (live duration of an in-flight step/substep).
 *
 * Invalid input returns "unknown". Negative deltas clamp to "<1s".
 */
export function formatDuration(
    startIso: string,
    endIso: string | null,
    now: Date = new Date()
): string {
    if (!startIso) return 'unknown';
    const start = new Date(startIso).getTime();
    if (Number.isNaN(start)) return 'unknown';

    const end = endIso === null ? now.getTime() : new Date(endIso).getTime();
    if (Number.isNaN(end)) return 'unknown';

    return formatElapsed(end - start);
}

/**
 * Idle threshold for active-time totals. A gap between two recorded activity
 * timestamps longer than this is treated as "not working" and contributes only
 * up to the cap — so an overnight pause between transitions doesn't inflate a
 * step's elapsed time. Five minutes: AI/skill substeps log far more frequently
 * than that during real work, while idle gaps are minutes-to-hours.
 */
export const IDLE_GAP_CAP_MS = 5 * 60 * 1000;

/**
 * Active working time across an ordered set of activity timestamps: the sum of
 * the gaps between consecutive points, with each gap capped at `capMs`. Long
 * idle gaps therefore count only up to the cap. Returns milliseconds.
 */
export function activeDurationMs(
    pointsIso: string[],
    capMs: number = IDLE_GAP_CAP_MS
): number {
    const ts = pointsIso
        .map(s => new Date(s).getTime())
        .filter(n => !Number.isNaN(n))
        .sort((a, b) => a - b);
    let sum = 0;
    for (let i = 1; i < ts.length; i++) {
        sum += Math.min(ts[i] - ts[i - 1], capMs);
    }
    return sum;
}

/**
 * Format an ISO timestamp as a compact absolute date+time (e.g. "May 21, 14:32").
 * Used for the PHASES card overall start/end header. Invalid input → "unknown".
 */
export function formatAbsolute(iso: string): string {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'unknown';
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Render an in-step offset from the step's `startedAt`. Used inside a
 * timeline group so consecutive entries read as `+0s`, `+5s`, `+1m 20s`.
 *
 * Negative deltas (clock skew) clamp to "+0s". Invalid input → "unknown".
 */
export function formatStepOffset(startIso: string, atIso: string): string {
    if (!startIso || !atIso) return 'unknown';
    const start = new Date(startIso).getTime();
    const at = new Date(atIso).getTime();
    if (Number.isNaN(start) || Number.isNaN(at)) return 'unknown';

    const ms = Math.max(0, at - start);
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `+${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    if (minutes < 60) return remSec === 0 ? `+${minutes}m` : `+${minutes}m ${remSec}s`;

    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return remMin === 0 ? `+${hours}h` : `+${hours}h ${remMin}m`;
}
