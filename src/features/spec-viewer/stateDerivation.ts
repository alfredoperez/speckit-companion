/**
 * Pure derivation from `SpecContext` → `ViewerState`.
 *
 * Never touches the filesystem. `deriveStepBadges` uses only `stepHistory`.
 * `pulse` is null when `status` ∈ {completed, archived}.
 *
 * **Inferred completion**: a step is treated as completed when it has
 * `startedAt` set and precedes `currentStep` in `STEP_NAMES` ordering,
 * even if `completedAt` was never explicitly written (common with external
 * SDD skills that only emit `startedAt`).
 */

import {
    SpecContext,
    StepName,
    StepBadgeState,
    STEP_NAMES,
    ViewerState,
} from '../../core/types/specContext';
import { getFooterActions } from './footerActions';

/**
 * Determine whether a step should be treated as completed.
 *
 * A step is completed if:
 * 1. It has explicit `completedAt`, OR
 * 2. It has `startedAt` AND its index in STEP_NAMES is before `currentStep`
 *    (the workflow moved past it — inferred completion).
 */
export function isStepCompleted(
    step: StepName,
    currentStep: StepName,
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }>
): boolean {
    const entry = stepHistory[step];
    if (!entry?.startedAt) return false;
    if (entry.completedAt) return true;
    const stepIdx = STEP_NAMES.indexOf(step);
    const currentIdx = STEP_NAMES.indexOf(currentStep);
    return stepIdx >= 0 && currentIdx >= 0 && stepIdx < currentIdx;
}

export function deriveStepBadges(
    ctx: SpecContext
): Record<string, StepBadgeState> {
    const out: Record<string, StepBadgeState> = {};
    for (const step of STEP_NAMES) {
        const entry = ctx.stepHistory[step];
        if (!entry || !entry.startedAt) {
            out[step] = 'not-started';
        } else if (isStepCompleted(step, ctx.currentStep, ctx.stepHistory)) {
            out[step] = 'completed';
        } else {
            out[step] = 'in-progress';
        }
    }
    return out;
}

export function derivePulse(ctx: SpecContext): StepName | null {
    if (ctx.status === 'completed' || ctx.status === 'archived') {
        return null;
    }
    for (const step of STEP_NAMES) {
        const entry = ctx.stepHistory[step];
        if (entry?.startedAt && !isStepCompleted(step, ctx.currentStep, ctx.stepHistory)) {
            return step;
        }
    }
    return null;
}

export function deriveHighlights(ctx: SpecContext): StepName[] {
    return STEP_NAMES.filter(s => isStepCompleted(s, ctx.currentStep, ctx.stepHistory));
}

export function deriveActiveSubstep(
    ctx: SpecContext
): ViewerState['activeSubstep'] {
    for (const step of STEP_NAMES) {
        const entry = ctx.stepHistory[step];
        const active = entry?.substeps?.find(s => !s.completedAt);
        if (active) return { step, name: active.name };
    }
    return null;
}

export function deriveViewerState(
    ctx: SpecContext,
    activeStep: StepName = ctx.currentStep
): ViewerState {
    return {
        status: ctx.status,
        activeStep,
        steps: deriveStepBadges(ctx),
        pulse: derivePulse(ctx),
        highlights: deriveHighlights(ctx),
        activeSubstep: deriveActiveSubstep(ctx),
        footer: getFooterActions(ctx, activeStep),
    };
}
