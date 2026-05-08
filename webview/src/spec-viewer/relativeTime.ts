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
 * Render a duration between two ISO timestamps. Pass `endIso = null` to use
 * `now` as the end (live duration of an in-flight step/substep).
 *
 * Buckets:
 *   <1s          → "<1s"
 *   <60s         → "Xs"
 *   <60min       → "Xm Ys"  (Y omitted when 0)
 *   <24h         → "Xh Ym"
 *   >=24h        → "Xd Yh"
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

    const ms = Math.max(0, end - start);
    if (ms < 1000) return '<1s';

    const seconds = Math.floor(ms / 1000);
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
