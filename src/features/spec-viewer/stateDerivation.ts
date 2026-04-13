/**
 * Pure derivation from `SpecContext` → `ViewerState`.
 *
 * Never touches the filesystem. `deriveStepBadges` uses only `stepHistory`.
 * `pulse` is null when `status` ∈ {completed, archived}.
 */

import {
    SpecContext,
    StepName,
    StepBadgeState,
    STEP_NAMES,
    ViewerState,
} from '../../core/types/specContext';
import { getFooterActions } from './footerActions';

export function deriveStepBadges(
    ctx: SpecContext
): Record<string, StepBadgeState> {
    const out: Record<string, StepBadgeState> = {};
    for (const step of STEP_NAMES) {
        const entry = ctx.stepHistory[step];
        if (!entry || !entry.startedAt) {
            out[step] = 'not-started';
        } else if (entry.completedAt) {
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
        if (entry?.startedAt && !entry.completedAt) {
            return step;
        }
    }
    return null;
}

export function deriveHighlights(ctx: SpecContext): StepName[] {
    return STEP_NAMES.filter(s => !!ctx.stepHistory[s]?.completedAt);
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
