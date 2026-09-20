/**
 * Step progress recording for the "user clicks a step command" path.
 *
 * For lifecycle steps (specify / clarify / plan / tasks / analyze / implement),
 * `setStepStarted` / `setStepCompleted` in `specContextWriter` already handle
 * the complete-on-advance + start atomically — this function fills `specName`
 * when missing and enforces the idempotent re-advance rule (re-advancing to
 * the step that's already current is a no-op). For non-lifecycle (custom
 * workflow) steps, applies a generic partial merge so a project's own step
 * name can still be recorded without emitting a canonical history entry for
 * it (only lifecycle boundaries append to `history`).
 */

import {
    HistoryEntry,
    SpecContext,
    Status,
    StepName,
    STEP_NAMES,
} from '../../core/types/specContext';
import { SpecStatuses } from '../../core/constants';
import { deriveSpecName } from '../../core/utils/specDisplayName';
import {
    setStepStarted as canonicalSetStepStarted,
    setStepCompleted as canonicalSetStepCompleted,
    updateSpecContext as canonicalUpdateSpecContext,
} from './specContextWriter';
import { readSpecContext, normalizeSpecContext, SpecContextParseError } from './specContextReader';
import { isStepLevelEntry, lastEntryIsCompletionFor } from './historyHelpers';

function isStepName(value: string | undefined): value is StepName {
    return !!value && (STEP_NAMES as readonly string[]).includes(value);
}

/** True iff `history` contains any *start* entry for `step` (not a completion). */
function stepHasBeenStarted(history: HistoryEntry[], step: StepName): boolean {
    for (const e of history) {
        if (e.step !== step) continue;
        if (!isStepLevelEntry(e)) continue;
        if (e.kind === 'start') return true;
    }
    return false;
}

export async function updateStepProgress(
    specDir: string,
    stepName: string,
    _workflowStepNames: string[]
): Promise<void> {
    const isLifecycle = isStepName(stepName);
    let ctx: SpecContext | null;
    try {
        ctx = await readSpecContext(specDir);
    } catch (err) {
        if (!(err instanceof SpecContextParseError)) throw err;
        ctx = null;
    }
    const specName = ctx?.specName || deriveSpecName(specDir);

    if (isLifecycle) {
        // Complete any in-flight prior lifecycle step + start the new one,
        // atomically, via the canonical writer. Idempotent: re-advancing
        // to the step that's already current is a no-op.
        await canonicalUpdateSpecContext(
            specDir,
            (c) => {
                let next = { ...c, specName };
                const prevStep = c.currentStep;
                if (prevStep === stepName && stepHasBeenStarted(c.history ?? [], stepName as StepName)) {
                    return next;
                }
                if (
                    isStepName(prevStep) &&
                    prevStep !== stepName &&
                    !lastEntryIsCompletionFor(c.history ?? [], prevStep)
                ) {
                    next = canonicalSetStepCompleted(next, prevStep, 'extension');
                }
                next = canonicalSetStepStarted(next, stepName as StepName, 'extension');
                return next;
            },
            normalizeSpecContext({
                specName,
                branch: '',
                currentStep: 'specify',
                status: 'draft',
                history: [],
            }),
        );
        return;
    }

    // Non-lifecycle (custom) step — record it in `currentStep` without a
    // canonical history entry (only recognized lifecycle steps append one).
    await canonicalUpdateSpecContext(
        specDir,
        (c) => ({
            ...c,
            currentStep: stepName as StepName,
            status: (ctx?.status ?? c.status ?? SpecStatuses.ACTIVE) as Status,
            specName,
        }),
        normalizeSpecContext({
            specName,
            branch: '',
            currentStep: 'specify',
            status: 'draft',
            history: [],
        }),
    );
}
