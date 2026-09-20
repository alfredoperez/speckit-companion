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
import { hasStepStart, lastEntryIsCompletionFor } from './historyHelpers';

function isStepName(value: string | undefined): value is StepName {
    return !!value && (STEP_NAMES as readonly string[]).includes(value);
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
        // One atomic write: close any in-flight prior step and start this one.
        await canonicalUpdateSpecContext(
            specDir,
            (c) => {
                let next = { ...c, specName };
                const prevStep = c.currentStep;
                if (prevStep === stepName && hasStepStart(c.history ?? [], stepName as StepName)) {
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

    // A custom step: record it in `currentStep` without a lifecycle status.
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
