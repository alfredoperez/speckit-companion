/**
 * Merge `stepHistory.substeps` (carries duration) with non-null history
 * substeps (carries actor) into a single chronological event list per step.
 *
 * - Tracked events come from `stepHistory[step].substeps[]`. They have a
 *   `startedAt` and `completedAt` so we can render a duration.
 * - Logged-only events come from history entries whose `substep` is non-null
 *   and whose name isn't already in the tracked set. They only carry an `at`
 *   timestamp; render as a single moment.
 *
 * Every event also gets an optional `by` actor, looked up from the matching
 * history entry by `(step, substep-name)`.
 */

import type { HistoryEntry, StepHistoryEntry, SubstepEntry } from './types';

export type TimelineEventSource = 'tracked' | 'logged';

/**
 * Step-level vs per-task discriminators. Intentionally duplicated from the
 * extension's `historyHelpers` (the webview must not import from `src/`); the
 * rule is trivial and kept symmetric with the extension side.
 */
type DiscriminatorEntry = { substep?: string | null; task?: string | null };
const isStepLevelEntry = (e: DiscriminatorEntry): boolean =>
    e.substep == null && e.task == null;
const isPerTaskEntry = (e: DiscriminatorEntry): boolean => e.task != null;

/**
 * Substeps land on disk in two shapes:
 *   - array form: `Array<{name, startedAt, completedAt}>`
 *   - record form: `Record<name, {startedAt, completedAt}>`
 *
 * Normalize both into the array form so consumers don't branch.
 */
export function normalizeSubsteps(
    substeps: StepHistoryEntry['substeps']
): SubstepEntry[] {
    if (!substeps) return [];
    if (Array.isArray(substeps)) return substeps;
    return Object.entries(substeps).map(([name, entry]) => ({
        name,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt ?? null,
    }));
}

export interface TimelineEventModel {
    name: string;
    startedAt: string;
    completedAt: string | null;
    source: TimelineEventSource;
    by?: string;
    /** Task id when this event is a per-task entry (T001…), else null. */
    task?: string | null;
}

export function buildHistoryIndex(
    history: HistoryEntry[]
): Map<string, HistoryEntry> {
    const map = new Map<string, HistoryEntry>();
    for (const t of history) {
        // Skip step-level boundaries; index substep and per-task entries. Per-task
        // entries carry a null `substep` + a `task` id, so they index by task —
        // the tracked row (named after the task) resolves its actor.
        if (isStepLevelEntry(t)) continue;
        const name = t.substep || t.task;
        if (!name) continue;
        const key = `${t.step}:${name}`;
        // Last write wins — most recent entry for the same (step, name) pair
        // carries the freshest actor info.
        map.set(key, t);
    }
    return map;
}

/** @deprecated Renamed to `buildHistoryIndex`. */
export const buildTransitionIndex = buildHistoryIndex;

export function mergeStepEvents(
    step: string,
    stepEntry: StepHistoryEntry | undefined,
    history: HistoryEntry[],
    historyIndex: Map<string, HistoryEntry> = buildHistoryIndex(history),
): TimelineEventModel[] {
    const out: TimelineEventModel[] = [];
    const trackedNames = new Set<string>();

    for (const sub of normalizeSubsteps(stepEntry?.substeps)) {
        trackedNames.add(sub.name);
        const tx = historyIndex.get(`${step}:${sub.name}`);
        out.push({
            name: sub.name,
            startedAt: sub.startedAt,
            completedAt: sub.completedAt ?? null,
            source: 'tracked',
            by: tx?.by,
            task: tx && isPerTaskEntry(tx) ? tx.task : null,
        });
    }

    for (const tx of history) {
        if (tx.step !== step) continue;
        // Logged-only events are substep-bearing; skip step-level boundaries and
        // per-task finishes (both substep null) — they surface via tracked rows.
        if (isStepLevelEntry(tx) || isPerTaskEntry(tx)) continue;
        if (!tx.substep) continue;
        if (trackedNames.has(tx.substep)) continue;
        // A completion entry's `from.substep === substep` (self-loop). Skip;
        // the start entry already produced the row.
        if (tx.from?.substep === tx.substep) continue;
        out.push({
            name: tx.substep,
            startedAt: tx.at,
            completedAt: null,
            source: 'logged',
            by: tx.by,
        });
    }

    out.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    return out;
}
