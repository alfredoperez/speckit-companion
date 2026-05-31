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
 *   - Consecutive identical `(step, substep)` transitions are collapsed
 *     before any grouping/duration logic runs, so duplicated rows can't
 *     distort durations or substep lists. Two adjacent transitions are
 *     duplicates only when BOTH `step` and `substep` are equal (null and
 *     undefined substep are treated as equal).
 *   - For each step seen in (de-duplicated) transitions, in order of first
 *     appearance, emit a `StepHistoryEntry`.
 *   - `startedAt` = `at` of the first transition for that step.
 *   - `completedAt` = `at` of the first transition for the *next* step
 *     in the array, OR `null` if this is the most recently seen step
 *     and `currentStep` matches it (i.e. step is in flight). If the spec
 *     is in a TERMINAL status (`completed`/`archived`), that last-seen
 *     current step is finalized instead to the `at` of its own last
 *     transition (best available real end timestamp). If the step has
 *     been left behind without a successor in transitions[], fall back to
 *     the last transition for that step (best available).
 *   - `substeps[]` = transitions for that step where `substep` is
 *     non-null, with `startedAt` = the transition's `at` and
 *     `completedAt` = the next non-null-substep transition's `at` for
 *     the same step (or the step's own `completedAt` if it's the last
 *     substep).
 */

import {
    HistoryEntry,
    StepHistoryEntry,
    STEP_NAMES,
    StepName,
    Status,
    SubstepEntry,
} from '../../core/types/specContext';
import { SpecStatuses } from '../../core/constants';

/**
 * Determine whether a step should be treated as completed.
 *
 * Pure query over `stepHistory` + the current step. A step is completed when:
 *   1. Its history entry has an explicit `completedAt`, OR
 *   2. Its position in `STEP_NAMES` is *before* `currentStep` (the workflow
 *      moved past it — inferred completion, used when the AI-written history
 *      missed a `completedAt`).
 *
 * Lives here in `features/specs/` rather than in `spec-viewer/` because the
 * sidebar query (specExplorerProvider) needs it and the sidebar shouldn't
 * depend on the viewer module. The viewer also reads this function — both
 * import from `specs/` now.
 */
export function isStepCompleted(
    step: StepName,
    currentStep: StepName,
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }>,
): boolean {
    const entry = stepHistory[step];
    if (entry?.completedAt) return true;
    const stepIdx = STEP_NAMES.indexOf(step);
    const currentIdx = STEP_NAMES.indexOf(currentStep);
    if (stepIdx >= 0 && currentIdx >= 0 && stepIdx < currentIdx) return true;
    if (!entry?.startedAt) return false;
    return false;
}

interface RawStep {
    step: string;
    transitions: HistoryEntry[];
    /** Index of the first transition for the *next* step, or -1 if this is the last seen step. */
    nextStepFirstIdx: number;
}

/**
 * Collapse CONSECUTIVE identical transitions. Two adjacent transitions are
 * duplicates only when step, substep, AND `from` all match — comparing `from`
 * keeps real boundaries that share (step, substep=null) but differ in origin
 * (e.g. step-started vs step-completed) while still collapsing genuine
 * redundant repeats (e.g. implement/phase1 written 3× with identical origin).
 * null/undefined substep/from is treated as equal only to null/undefined. The
 * first of each run is kept (preserving its real `at`), later duplicates are
 * dropped so durations/substep lists aren't distorted.
 */
function dedupeConsecutive(transitions: HistoryEntry[]): HistoryEntry[] {
    const out: HistoryEntry[] = [];
    for (const t of transitions) {
        const prev = out[out.length - 1];
        const sameStep = prev !== undefined && prev.step === t.step;
        const sameSubstep = (prev?.substep ?? null) === (t.substep ?? null);
        const sameKind = (prev?.kind ?? null) === (t.kind ?? null);
        const sameFromStep = (prev?.from?.step ?? null) === (t.from?.step ?? null);
        const sameFromSubstep = (prev?.from?.substep ?? null) === (t.from?.substep ?? null);
        if (sameStep && sameSubstep && sameKind && sameFromStep && sameFromSubstep) continue;
        out.push(t);
    }
    return out;
}

function groupStepsInOrder(transitions: HistoryEntry[]): RawStep[] {
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

/**
 * Build substep rows. Substep entries come in two shapes per the writers:
 *   - start:      `{ substep: 'X', from: { substep: null } }`
 *   - completion: `{ substep: 'X', from: { substep: 'X'  } }`  // self-loop
 * Pair a start with its matching completion (same substep name, completion
 * shape) when adjacent. Without a paired completion, fall through to
 * "started, ended at next substep's start" so legacy entries that only
 * record substep boundaries still render correctly.
 */
function buildSubsteps(stepTxs: HistoryEntry[], fallbackEnd: string | null): SubstepEntry[] {
    const subs = stepTxs.filter(t => t.substep !== null && t.substep !== undefined);
    const out: SubstepEntry[] = [];
    for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        // A completion entry has `from.substep === substep`. A start has
        // `from.substep == null` (or a different name). Skip completion
        // entries here — they're consumed by the preceding start, not
        // rendered as their own row.
        const isCompletion = s.kind === 'complete';
        if (isCompletion) continue;

        const next = subs[i + 1];
        const nextIsMatchingCompletion =
            next && next.substep === s.substep && next.kind === 'complete';
        out.push({
            name: s.substep as string,
            startedAt: s.at,
            completedAt: nextIsMatchingCompletion
                ? next.at
                : next
                    ? next.at  // legacy: next substep's start ends this one
                    : fallbackEnd,
        });
    }
    return out;
}

export function deriveStepHistory(
    transitions: HistoryEntry[],
    currentStep?: StepName,
    status?: Status
): Record<string, StepHistoryEntry> {
    const out: Record<string, StepHistoryEntry> = {};
    if (!transitions || transitions.length === 0) return out;

    const deduped = dedupeConsecutive(transitions);
    const isTerminal = status === SpecStatuses.COMPLETED || status === SpecStatuses.ARCHIVED;

    const groups = groupStepsInOrder(deduped);

    for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const isCurrent = currentStep === g.step;
        const isLastSeen = i === groups.length - 1;

        const startedAt = g.transitions[0].at;

        let completedAt: string | null = null;
        // A "completion" entry is one whose `from.step` matches its own
        // `step` — that's how setStepCompleted writes the close-boundary.
        // If the most recent entry for this step is a completion, the step
        // is done even if currentStep is still pointed at it.
        const lastOwn = g.transitions[g.transitions.length - 1];
        const lastOwnIsCompletion = lastOwn?.kind === 'complete' && lastOwn?.substep == null;

        if (g.nextStepFirstIdx !== -1) {
            // A later step exists in transitions — that step's first transition
            // is this step's real boundary. Index refers to the de-duplicated
            // array that `groupStepsInOrder` walked.
            completedAt = deduped[g.nextStepFirstIdx].at;
        } else if (lastOwnIsCompletion) {
            // No later step yet, but this step has a real completion entry —
            // honor it (covers `setStepCompleted` calls before the user has
            // clicked the next-phase button).
            completedAt = lastOwn.at;
        } else if (isLastSeen && isCurrent && isTerminal) {
            // Most recently seen step, currentStep matches, AND the spec is in
            // a terminal status → finalize to this step's last real transition
            // instead of leaving it in flight.
            completedAt = g.transitions[g.transitions.length - 1].at;
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
