/**
 * One-time reconciliation for `.spec-context.json`.
 *
 * When the extension reads a spec context and finds gaps (e.g., `currentStep`
 * is past steps that have no `stepHistory` entries), this module repairs the
 * file once so subsequent reads see clean data.
 *
 * Returns the corrected context if changes were made, or `null` if clean.
 */

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
 */
export function reconcile(ctx: SpecContext): SpecContext | null {
    let changed = false;
    let result = { ...ctx, stepHistory: { ...ctx.stepHistory } };

    const currentIdx = STEP_NAMES.indexOf(ctx.currentStep);
    if (currentIdx < 0) return null;

    const now = new Date().toISOString();

    // Backfill stepHistory for core steps that precede currentStep
    for (const step of CORE_STEPS) {
        const stepIdx = STEP_NAMES.indexOf(step);
        if (stepIdx >= currentIdx) continue; // not before currentStep

        const entry = result.stepHistory[step];

        if (!entry) {
            // Step has no history at all but workflow moved past it
            result.stepHistory[step] = {
                startedAt: now,
                completedAt: now,
            } as StepHistoryEntry;
            changed = true;
        } else if (!entry.completedAt) {
            // Step was started but never completed, yet workflow moved past it
            result.stepHistory[step] = {
                ...entry,
                completedAt: now,
            };
            changed = true;
        }
    }

    // Ensure currentStep itself has startedAt if it has no entry
    const currentEntry = result.stepHistory[ctx.currentStep];
    if (!currentEntry && CORE_STEPS.includes(ctx.currentStep)) {
        result.stepHistory[ctx.currentStep] = {
            startedAt: now,
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

/**
 * Read, reconcile, and persist a spec context.
 * Returns the (possibly corrected) context.
 */
export async function reconcileAndPersist(
    specDir: string,
    ctx: SpecContext
): Promise<SpecContext> {
    const fixed = reconcile(ctx);
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
