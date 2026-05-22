/**
 * One-time reconciliation for `.spec-context.json`.
 *
 * When the extension reads a spec context and finds gaps (e.g., `currentStep`
 * is past steps that have no `stepHistory` entries), this module repairs the
 * file once so subsequent reads see clean data.
 *
 * Returns the corrected context if changes were made, or `null` if clean.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    SpecContext,
    StepName,
    StepHistoryEntry,
    STEP_NAMES,
    STATUSES,
    Status,
} from '../../core/types/specContext';
import { updateSpecContext } from './specContextWriter';

/** Core steps that correspond to files (skip clarify/analyze sub-phases). */
const CORE_STEPS: StepName[] = ['specify', 'plan', 'tasks', 'implement'];

function deriveStatusFromCurrentStep(currentStep: StepName): Status {
    switch (currentStep) {
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

function deriveCompletedStatus(currentStep: StepName): Status {
    switch (currentStep) {
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
 * Pure function: detect and fix gaps in a SpecContext.
 * Returns a corrected copy if changes were needed, or `null` if clean.
 *
 * Backfilling uses a best-available REAL timestamp rather than a synthesized
 * "written now" instant (which gave every backfilled step one shared time and
 * thus zero/garbage durations). Precedence:
 *   1. the last transition's `at` for this ctx (the truest signal when present)
 *   2. `fallbackTimestamp` (caller-supplied source, e.g. file mtime — used for
 *      transition-less legacy specs)
 *   3. absent — leave the value missing (except for the required, non-null
 *      `startedAt` on a freshly-created entry; see the dedicated note below).
 */
export function reconcile(
    ctx: SpecContext,
    fallbackTimestamp?: string
): SpecContext | null {
    let changed = false;
    let result = { ...ctx, stepHistory: { ...ctx.stepHistory } };

    const currentIdx = STEP_NAMES.indexOf(ctx.currentStep);
    if (currentIdx < 0) return null;

    // Best-available REAL timestamp for backfill: caller-supplied source first,
    // then the most recent transition's `at`. May be undefined if neither
    // exists — callers below decide whether absence is acceptable.
    const lastTransitionAt = ctx.transitions?.[ctx.transitions.length - 1]?.at;
    const realFill: string | undefined = lastTransitionAt ?? fallbackTimestamp;

    // Backfill stepHistory for core steps that precede currentStep
    for (const step of CORE_STEPS) {
        const stepIdx = STEP_NAMES.indexOf(step);
        if (stepIdx >= currentIdx) continue; // not before currentStep

        const entry = result.stepHistory[step];

        if (!entry) {
            // Step has no history at all but workflow moved past it. We can only
            // create an entry if a real timestamp is available — `startedAt` is
            // required/non-null, so without one we leave the gap rather than
            // synthesize a coarse `new Date()`.
            if (realFill) {
                result.stepHistory[step] = {
                    startedAt: realFill,
                    completedAt: realFill,
                } as StepHistoryEntry;
                changed = true;
            }
        } else if (!entry.completedAt) {
            // Step was started but never completed, yet workflow moved past it.
            // Only fill from a real source; never overwrite an existing real
            // value, and never synthesize `new Date()`.
            if (realFill) {
                result.stepHistory[step] = {
                    ...entry,
                    completedAt: realFill,
                };
                changed = true;
            }
        }
    }

    // Ensure currentStep itself has startedAt if it has no entry.
    // `StepHistoryEntry.startedAt` is required (non-null), so if we must create
    // this entry we use the best real timestamp; only as a FINAL fallback, when
    // no real source exists at all, do we synthesize `new Date()` (documented
    // exception — the entry cannot legally exist without a startedAt).
    const currentEntry = result.stepHistory[ctx.currentStep];
    if (!currentEntry && CORE_STEPS.includes(ctx.currentStep)) {
        result.stepHistory[ctx.currentStep] = {
            startedAt: realFill ?? new Date().toISOString(),
            completedAt: null,
        } as StepHistoryEntry;
        changed = true;
    }

    // Fix non-canonical status
    if (!(STATUSES as string[]).includes(ctx.status)) {
        // Determine correct status from currentStep
        const currentHasCompleted = result.stepHistory[ctx.currentStep]?.completedAt;
        result = {
            ...result,
            status: currentHasCompleted
                ? deriveCompletedStatus(ctx.currentStep)
                : deriveStatusFromCurrentStep(ctx.currentStep),
        };
        changed = true;
    }

    return changed ? result : null;
}

/** Core artifact files whose mtime is a real proxy for step timing. */
const ARTIFACT_FILES = ['spec.md', 'plan.md', 'tasks.md'];

/**
 * Best-available real timestamp from the spec's artifact files: the latest
 * mtime among `spec.md`/`plan.md`/`tasks.md` in `specDir`. Returns `undefined`
 * if none exist. Uses the same `fs.promises` idiom as specContextWriter.ts.
 */
async function latestArtifactMtime(specDir: string): Promise<string | undefined> {
    const mtimes = await Promise.all(
        ARTIFACT_FILES.map(name =>
            fs.promises
                .stat(path.join(specDir, name))
                .then(s => s.mtimeMs)
                .catch(() => 0)
        )
    );
    const latest = Math.max(0, ...mtimes);
    return latest > 0 ? new Date(latest).toISOString() : undefined;
}

/**
 * Read, reconcile, and persist a spec context.
 * Returns the (possibly corrected) context.
 */
export async function reconcileAndPersist(
    specDir: string,
    ctx: SpecContext
): Promise<SpecContext> {
    // The file-mtime fallback is only needed for transition-less legacy specs;
    // when transitions exist their `at` is the real source, so skip the stats.
    // This runs on a watcher-driven hot path (every viewer refresh), so avoid
    // the I/O whenever possible.
    const fallbackTimestamp = ctx.transitions?.length
        ? undefined
        : await latestArtifactMtime(specDir);
    const fixed = reconcile(ctx, fallbackTimestamp);
    if (!fixed) return ctx;

    try {
        await updateSpecContext(
            specDir,
            () => fixed,
            fixed
        );
    } catch {
        // Non-fatal — use the corrected context in memory even if write fails
    }

    return fixed;
}
