/**
 * Derive `stepHistory` from a spec's `transitions[]` array.
 *
 * The on-disk `stepHistory` written by AI assistants carries unreliable
 * timestamps (round-minute strings the AI typed by hand). We derive a
 * fresh `stepHistory` from `transitions[]` instead — extension-written
 * boundaries (`by: "extension"`) are real `Date.now()` values, and even
 * AI-typed substep `at` values preserve the correct *sequence* even
 * when the absolute time is rough. The derived structure is what the
 * spec viewer reads; the on-disk version is ignored.
 *
 * Rules:
 *   - For each step seen in transitions (in order of first appearance),
 *     emit a `StepHistoryEntry`.
 *   - `startedAt` = `at` of the first transition for that step.
 *   - `completedAt` = `at` of the first transition for the *next* step
 *     in the array, OR `null` if this is the most recently seen step
 *     and `currentStep` matches it (i.e. step is in flight). If the
 *     step has been left behind without a successor in transitions[],
 *     fall back to the last transition for that step (best available).
 *   - `substeps[]` = transitions for that step where `substep` is
 *     non-null, with `startedAt` = the transition's `at` and
 *     `completedAt` = the next non-null-substep transition's `at` for
 *     the same step (or the step's own `completedAt` if it's the last
 *     substep).
 */

import {
    Transition,
    StepHistoryEntry,
    SubstepEntry,
    StepName,
} from '../../core/types/specContext';

interface RawStep {
    step: string;
    transitions: Transition[];
    /** Index of the first transition for the *next* step, or -1 if this is the last seen step. */
    nextStepFirstIdx: number;
}

function groupStepsInOrder(transitions: Transition[]): RawStep[] {
    const out: RawStep[] = [];
    const seen = new Map<string, RawStep>();
    for (let i = 0; i < transitions.length; i++) {
        const t = transitions[i];
        let entry = seen.get(t.step);
        if (!entry) {
            entry = { step: t.step, transitions: [], nextStepFirstIdx: -1 };
            seen.set(t.step, entry);
            out.push(entry);
        }
        entry.transitions.push(t);
    }
    // Walk the transitions a second time to compute `nextStepFirstIdx`:
    // for each step we already have, find the index of the first transition
    // whose step is different *and* appears later than any of this step's
    // own transitions in the absolute order. Simpler: linear scan.
    for (let g = 0; g < out.length; g++) {
        const cur = out[g];
        // Index of the last own-transition in the global array.
        const lastOwn = transitions.lastIndexOf(cur.transitions[cur.transitions.length - 1]);
        for (let j = lastOwn + 1; j < transitions.length; j++) {
            if (transitions[j].step !== cur.step) {
                cur.nextStepFirstIdx = j;
                break;
            }
        }
    }
    return out;
}

function buildSubsteps(stepTxs: Transition[], fallbackEnd: string | null): SubstepEntry[] {
    const subs = stepTxs.filter(t => t.substep !== null && t.substep !== undefined);
    const out: SubstepEntry[] = [];
    for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        const next = subs[i + 1];
        out.push({
            name: s.substep as string,
            startedAt: s.at,
            completedAt: next ? next.at : fallbackEnd,
        });
    }
    return out;
}

export function deriveStepHistory(
    transitions: Transition[],
    currentStep?: StepName
): Record<string, StepHistoryEntry> {
    const out: Record<string, StepHistoryEntry> = {};
    if (!transitions || transitions.length === 0) return out;

    const groups = groupStepsInOrder(transitions);

    for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const isCurrent = currentStep === g.step;
        const isLastSeen = i === groups.length - 1;

        const startedAt = g.transitions[0].at;

        let completedAt: string | null = null;
        if (g.nextStepFirstIdx !== -1) {
            // A later step exists in transitions — that step's first transition
            // is this step's real boundary.
            completedAt = transitions[g.nextStepFirstIdx].at;
        } else if (isLastSeen && isCurrent) {
            // Most recently seen step, and currentStep matches → in flight.
            completedAt = null;
        } else if (isLastSeen) {
            // Last seen step but we've already moved past it (currentStep
            // points elsewhere or is undefined). Best fallback: the last
            // transition for that step.
            completedAt = g.transitions[g.transitions.length - 1].at;
        }

        const substeps = buildSubsteps(g.transitions, completedAt);

        const entry: StepHistoryEntry = { startedAt, completedAt };
        if (substeps.length > 0) entry.substeps = substeps;
        out[g.step] = entry;
    }

    return out;
}
