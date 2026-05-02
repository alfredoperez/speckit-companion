/**
 * Merge `stepHistory.substeps` (carries duration) with non-null transition
 * substeps (carries actor) into a single chronological event list per step.
 *
 * - Tracked events come from `stepHistory[step].substeps[]`. They have a
 *   `startedAt` and `completedAt` so we can render a duration.
 * - Logged-only events come from transitions whose `substep` is non-null and
 *   whose name isn't already in the tracked set. They only carry an `at`
 *   timestamp; render as a single moment.
 *
 * Every event also gets an optional `by` actor, looked up from the matching
 * transition by `(step, substep-name)`.
 */

import type { Transition, StepHistoryEntry, SubstepEntry } from './types';

export type TimelineEventSource = 'tracked' | 'logged';

/**
 * Substeps land on disk in two shapes:
 *   - SDD: `Array<{name, startedAt, completedAt}>`
 *   - speckit: `Record<name, {startedAt, completedAt}>`
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
}

export function buildTransitionIndex(
    transitions: Transition[]
): Map<string, Transition> {
    const map = new Map<string, Transition>();
    for (const t of transitions) {
        if (!t.substep) continue;
        const key = `${t.step}:${t.substep}`;
        // Last write wins — most recent transition for the same (step, substep)
        // pair carries the freshest actor info.
        map.set(key, t);
    }
    return map;
}

export function mergeStepEvents(
    step: string,
    history: StepHistoryEntry | undefined,
    transitions: Transition[],
    transitionIndex: Map<string, Transition> = buildTransitionIndex(transitions),
): TimelineEventModel[] {
    const out: TimelineEventModel[] = [];
    const trackedNames = new Set<string>();

    for (const sub of normalizeSubsteps(history?.substeps)) {
        trackedNames.add(sub.name);
        const tx = transitionIndex.get(`${step}:${sub.name}`);
        out.push({
            name: sub.name,
            startedAt: sub.startedAt,
            completedAt: sub.completedAt ?? null,
            source: 'tracked',
            by: tx?.by,
        });
    }

    for (const tx of transitions) {
        if (tx.step !== step) continue;
        if (!tx.substep) continue;
        if (trackedNames.has(tx.substep)) continue;
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
