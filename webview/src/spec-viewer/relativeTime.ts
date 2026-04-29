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
