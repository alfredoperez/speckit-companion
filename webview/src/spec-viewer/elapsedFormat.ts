const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export function formatElapsed(ms: number): string {
    const clamped = Math.max(0, Math.floor(ms));

    if (clamped < MINUTE) {
        const s = Math.floor(clamped / SECOND);
        return `${s}s`;
    }

    if (clamped < HOUR) {
        const m = Math.floor(clamped / MINUTE);
        const s = Math.floor((clamped % MINUTE) / SECOND);
        return `${m}m ${String(s).padStart(2, '0')}s`;
    }

    const h = Math.floor(clamped / HOUR);
    const m = Math.floor((clamped % HOUR) / MINUTE);
    return `${h}h ${String(m).padStart(2, '0')}m`;
}
