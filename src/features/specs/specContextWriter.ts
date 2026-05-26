/**
 * Writer for `.spec-context.json`.
 *
 * Guarantees:
 * - Read-modify-write to preserve unknown top-level fields (FR-013).
 * - Atomic rename (temp-file + rename) on POSIX + Windows.
 * - Append-only `history` array (FR-005, FR-012): helpers refuse to
 *   rewrite existing entries.
 *
 * `stepHistory` is NOT persisted: the viewer derives per-step timing from
 * `history[]` on every render. See ViewerState.stepHistory.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    HistoryEntry,
    HistoryEntryBy,
    HistoryEntryFrom,
    SpecContext,
    StepName,
} from '../../core/types/specContext';
import { SPEC_CONTEXT_FILENAME, normalizeSpecContext } from './specContextReader';

export async function writeSpecContext(
    specDir: string,
    ctx: SpecContext
): Promise<void> {
    const target = path.join(specDir, SPEC_CONTEXT_FILENAME);

    // Read existing for unknown-field preservation + append-only enforcement.
    let existing: Record<string, unknown> | null = null;
    try {
        const raw = await fs.promises.readFile(target, 'utf-8');
        existing = JSON.parse(raw);
    } catch {
        existing = null;
    }

    if (existing) {
        // The canonical log lives under `history`, but legacy files may only
        // carry the old `transitions` field. Treat whichever is present as
        // the prior log for append-only checking, so a buggy mutator can't
        // silently drop legacy entries on the migration write.
        const priorLog =
            (existing.history as HistoryEntry[] | undefined) ??
            (existing.transitions as HistoryEntry[] | undefined) ??
            [];
        assertAppendOnly(priorLog, ctx.history);
    }

    // Strip legacy `stepHistory` / `transitions` fields if present — `history`
    // is the only persisted record, and the writer never re-emits the old
    // names so files migrate themselves on the next write.
    const cleanedExisting: Record<string, unknown> = { ...(existing ?? {}) };
    delete cleanedExisting.stepHistory;
    delete cleanedExisting.transitions;

    const merged: Record<string, unknown> = { ...cleanedExisting, ...ctx };
    delete merged.stepHistory;
    delete merged.transitions;
    const json = JSON.stringify(merged, null, 2);

    await atomicWrite(target, json);
}

async function atomicWrite(target: string, content: string): Promise<void> {
    const dir = path.dirname(target);
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
    await fs.promises.writeFile(tmp, content, 'utf-8');
    try {
        await fs.promises.rename(tmp, target);
        return;
    } catch {
        // Fall through to Windows fallbacks.
    }
    try {
        fs.renameSync(tmp, target);
        return;
    } catch {
        // Last-resort: copy + unlink. On success the write landed; don't throw.
        await fs.promises.copyFile(tmp, target);
        try {
            await fs.promises.unlink(tmp);
        } catch {
            /* leftover temp is non-fatal */
        }
    }
}

function assertAppendOnly(prev: HistoryEntry[], next: HistoryEntry[]): void {
    if (next.length < prev.length) {
        throw new Error('history is append-only; cannot shrink');
    }
    for (let i = 0; i < prev.length; i++) {
        if (JSON.stringify(prev[i]) !== JSON.stringify(next[i])) {
            throw new Error(
                `history is append-only; entry at index ${i} was modified`
            );
        }
    }
}

// ---------- Pure draft mutators (used by skills / callers to build ctx) ----------

export function appendHistory(ctx: SpecContext, t: HistoryEntry): SpecContext {
    // Plain append — the writer records every lifecycle boundary (step-started,
    // step-completed, substep) faithfully. Redundant *display* rows (the
    // SDD-implement loop's repeated `phase1`, which is written directly to the
    // JSON by the skill and never flows through here) are collapsed downstream:
    // `dedupeConsecutive` in stepHistoryDerivation feeds the viewer, and
    // PhasesCard de-dups rows. De-duping here would wrongly drop legitimate
    // start/complete boundaries that can share (step, substep, from).
    return {
        ...ctx,
        history: [...ctx.history, t],
    };
}

export function setStepStarted(
    ctx: SpecContext,
    step: StepName,
    by: HistoryEntryBy,
    at: string = new Date().toISOString()
): SpecContext {
    // Disambiguate start vs completion entries by their `from.step` shape:
    //   - completion: from.step === step  (setStepCompleted, below)
    //   - start:      from.step !== step  (either the prior step, or null on
    //                 the very first start / a restart of the current step).
    // If ctx.currentStep already equals `step` (fresh spec from buildFallback,
    // or a Regenerate that restarts the same step), set from.step = null so
    // the derivation's `lastOwnIsCompletion` check can't misfire on it.
    const prevStep: StepName | null =
        ctx.currentStep && ctx.currentStep !== step ? ctx.currentStep : null;
    const from: HistoryEntryFrom = { step: prevStep, substep: null };
    const entry: HistoryEntry = { step, substep: null, from, by, at };
    return appendHistory(
        {
            ...ctx,
            currentStep: step,
            status: deriveInProgressStatus(step),
        },
        entry
    );
}

export function setStepCompleted(
    ctx: SpecContext,
    step: StepName,
    by: HistoryEntryBy,
    at: string = new Date().toISOString()
): SpecContext {
    const from: HistoryEntryFrom = { step, substep: null };
    const entry: HistoryEntry = { step, substep: null, from, by, at };
    return appendHistory(
        {
            ...ctx,
            status: deriveCompletedStatus(step),
        },
        entry
    );
}

export function setSubstepStarted(
    ctx: SpecContext,
    step: StepName,
    substep: string,
    by: HistoryEntryBy,
    at: string = new Date().toISOString()
): SpecContext {
    const from: HistoryEntryFrom = { step, substep: null };
    const entry: HistoryEntry = { step, substep, from, by, at };
    return appendHistory(ctx, entry);
}

export function setSubstepCompleted(
    ctx: SpecContext,
    step: StepName,
    substep: string,
    by: HistoryEntryBy,
    at: string = new Date().toISOString()
): SpecContext {
    const from: HistoryEntryFrom = { step, substep };
    const entry: HistoryEntry = { step, substep, from, by, at };
    return appendHistory(ctx, entry);
}

/** @deprecated Renamed to `appendHistory`. */
export const appendTransition = appendHistory;

// `clarify` is a sub-phase of specify → reuses `specifying`.
// `analyze` is a sub-phase of tasks  → reuses `tasking`.
// Keeps the 10-entry status vocab from data-model.md.
function deriveInProgressStatus(step: StepName): SpecContext['status'] {
    switch (step) {
        case 'specify':
        case 'clarify':
            return 'specifying';
        case 'plan':
            return 'planning';
        case 'tasks':
        case 'analyze':
            return 'tasking';
        case 'implement':
            return 'implementing';
    }
}

function deriveCompletedStatus(step: StepName): SpecContext['status'] {
    switch (step) {
        case 'specify':
        case 'clarify':
            return 'specified';
        case 'plan':
            return 'planned';
        case 'tasks':
        case 'analyze':
            return 'ready-to-implement';
        case 'implement':
            // The implement step finishing means the AI is done writing code,
            // but the spec is not yet terminally completed. The user has to
            // click "Mark Completed" to advance from `implemented` →
            // `completed`. That final approval gate keeps the user in
            // control of when the spec is truly closed.
            return 'implemented';
    }
}

/**
 * Convenience wrapper: take an existing raw file (or missing), apply a
 * draft-mutation callback, and persist atomically.
 */
export async function updateSpecContext(
    specDir: string,
    mutate: (ctx: SpecContext) => SpecContext,
    fallback: SpecContext
): Promise<SpecContext> {
    const target = path.join(specDir, SPEC_CONTEXT_FILENAME);
    let current: SpecContext;
    try {
        const raw = await fs.promises.readFile(target, 'utf-8');
        current = normalizeSpecContext(JSON.parse(raw));
    } catch {
        current = fallback;
    }
    const next = mutate(current);
    await writeSpecContext(specDir, next);
    return next;
}
