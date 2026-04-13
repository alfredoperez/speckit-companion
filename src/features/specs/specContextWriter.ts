/**
 * Writer for `.spec-context.json`.
 *
 * Guarantees:
 * - Read-modify-write to preserve unknown top-level fields (FR-013).
 * - Atomic rename (temp-file + rename) on POSIX + Windows.
 * - Append-only `transitions` array (FR-005, FR-012): helpers refuse to
 *   rewrite existing entries.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    SpecContext,
    StepHistoryEntry,
    StepName,
    SubstepEntry,
    Transition,
    TransitionBy,
    TransitionFrom,
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
        assertAppendOnly(
            (existing.transitions as Transition[] | undefined) ?? [],
            ctx.transitions
        );
    }

    const merged: Record<string, unknown> = { ...(existing ?? {}), ...ctx };
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

function assertAppendOnly(prev: Transition[], next: Transition[]): void {
    if (next.length < prev.length) {
        throw new Error('transitions is append-only; cannot shrink');
    }
    for (let i = 0; i < prev.length; i++) {
        if (JSON.stringify(prev[i]) !== JSON.stringify(next[i])) {
            throw new Error(
                `transitions is append-only; entry at index ${i} was modified`
            );
        }
    }
}

// ---------- Pure draft mutators (used by skills / callers to build ctx) ----------

export function appendTransition(ctx: SpecContext, t: Transition): SpecContext {
    const next = {
        ...ctx,
        transitions: [...ctx.transitions, t],
    };
    return next;
}

export function setStepStarted(
    ctx: SpecContext,
    step: StepName,
    by: TransitionBy,
    at: string = new Date().toISOString()
): SpecContext {
    const prevStep: StepName | null = ctx.currentStep ?? null;
    const prevEntry = ctx.stepHistory[step];
    const entry: StepHistoryEntry = {
        startedAt: at,
        completedAt: null,
        substeps: prevEntry?.substeps,
    };
    const from: TransitionFrom = { step: prevStep, substep: null };
    const transition: Transition = { step, substep: null, from, by, at };
    return appendTransition(
        {
            ...ctx,
            currentStep: step,
            status: deriveInProgressStatus(step),
            stepHistory: { ...ctx.stepHistory, [step]: entry },
        },
        transition
    );
}

export function setStepCompleted(
    ctx: SpecContext,
    step: StepName,
    by: TransitionBy,
    at: string = new Date().toISOString()
): SpecContext {
    const existing = ctx.stepHistory[step] ?? { startedAt: at, completedAt: null };
    const entry: StepHistoryEntry = {
        ...existing,
        completedAt: at,
    };
    const from: TransitionFrom = { step, substep: null };
    const transition: Transition = { step, substep: null, from, by, at };
    return appendTransition(
        {
            ...ctx,
            status: deriveCompletedStatus(step),
            stepHistory: { ...ctx.stepHistory, [step]: entry },
        },
        transition
    );
}

export function setSubstepStarted(
    ctx: SpecContext,
    step: StepName,
    substep: string,
    by: TransitionBy,
    at: string = new Date().toISOString()
): SpecContext {
    const entry =
        ctx.stepHistory[step] ?? { startedAt: at, completedAt: null, substeps: [] };
    const substeps = entry.substeps ? [...entry.substeps] : [];
    substeps.push({ name: substep, startedAt: at, completedAt: null });
    const updated: StepHistoryEntry = { ...entry, substeps };
    const from: TransitionFrom = { step, substep: null };
    const transition: Transition = { step, substep, from, by, at };
    return appendTransition(
        { ...ctx, stepHistory: { ...ctx.stepHistory, [step]: updated } },
        transition
    );
}

export function setSubstepCompleted(
    ctx: SpecContext,
    step: StepName,
    substep: string,
    by: TransitionBy,
    at: string = new Date().toISOString()
): SpecContext {
    const entry = ctx.stepHistory[step];
    if (!entry || !entry.substeps) return ctx;
    const substeps: SubstepEntry[] = entry.substeps.map(s =>
        s.name === substep && !s.completedAt ? { ...s, completedAt: at } : s
    );
    const updated: StepHistoryEntry = { ...entry, substeps };
    const from: TransitionFrom = { step, substep };
    const transition: Transition = { step, substep, from, by, at };
    return appendTransition(
        { ...ctx, stepHistory: { ...ctx.stepHistory, [step]: updated } },
        transition
    );
}

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
            return 'completed';
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
