import type { ViewerState } from './types';

/**
 * Hero-strip stats derived from ViewerState. Pure functions; every count is
 * absent (undefined) rather than zeroed when its source data doesn't exist,
 * so the hero never fabricates a "0/0".
 */

export interface HeroStats {
    covered?: number;
    coverageTotal?: number;
    checks?: number;
    concerns?: number;
    /** Milliseconds of extension-stamped (trusted) step time; undefined when none. */
    trustedActiveMs?: number;
}

export function heroStats(state: ViewerState): HeroStats {
    const stats: HeroStats = {};

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
