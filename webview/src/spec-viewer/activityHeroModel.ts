import type { ViewerState } from './types';

/**
 * Hero-strip stats derived from ViewerState. Pure functions; every count is
 * absent (undefined) rather than zeroed when its source data doesn't exist,
 * so the hero never fabricates a "0/0".
 */

export interface HeroStats {
    tasksDone?: number;
    tasksTotal?: number;
    covered?: number;
    coverageTotal?: number;
    checks?: number;
    concerns?: number;
    /** Milliseconds of extension-stamped (trusted) step time; undefined when none. */
    trustedActiveMs?: number;
}

// Writers vary: the script emits DONE/DONE_WITH_CONCERNS, legacy AI writers
// used COMPLETED/COMPLETE. All count as done; REVERTED/IN_PROGRESS do not.
const DONE_STATUSES = new Set(['DONE', 'DONE_WITH_CONCERNS', 'COMPLETED', 'COMPLETE']);

export function heroStats(state: ViewerState): HeroStats {
    const stats: HeroStats = {};

    const tasks = Object.values(state.taskSummaries ?? {});
    if (tasks.length > 0) {
        stats.tasksTotal = tasks.length;
        stats.tasksDone = tasks.filter(t => DONE_STATUSES.has(String(t.status).toUpperCase())).length;
    }

    if (state.coverage && state.coverage.length > 0) {
        stats.coverageTotal = state.coverage.length;
        stats.covered = state.coverage.filter(r => r.tests.length > 0).length;
    }

    if (state.verified && state.verified.length > 0) {
        stats.checks = state.verified.length;
    }

    if (state.concerns && state.concerns.length > 0) {
        stats.concerns = state.concerns.length;
    }

    let trusted = 0;
    for (const entry of Object.values(state.stepHistory ?? {})) {
        if (!entry.durationTrusted || !entry.completedAt) continue;
        const span = new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime();
        if (Number.isFinite(span) && span > 0) trusted += span;
    }
    if (trusted > 0) stats.trustedActiveMs = trusted;

    return stats;
}

/** Compact human duration: 42m, 1h 12m, 38s. */
export function formatActiveTime(ms: number): string {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
