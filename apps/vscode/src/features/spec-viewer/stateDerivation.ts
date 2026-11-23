import type { ConvergeResult, StepName, SpecContext, ViewerState } from '../../core/types/specContext';
import { deriveViewerState as deriveCoreViewerState } from 'speckit-viewer/core/stateDerivation';
import { clarificationsIn } from 'speckit-viewer/core/clarificationsIn';
import type { WorkflowStepConfig } from '../workflows/types';
import { getFooterActions } from './footerActions';

export * from 'speckit-viewer/core/stateDerivation';

export function deriveViewerState(
    ctx: SpecContext,
    activeStep: StepName = ctx.currentStep,
    workflowSteps?: WorkflowStepConfig[],
    converge?: ConvergeResult
): ViewerState {
    return deriveCoreViewerState(ctx, activeStep, workflowSteps, converge,
        (c, step, steps, cv) => getFooterActions(c, step, steps, undefined, cv));
}

/** How many `[NEEDS CLARIFICATION]` markers the spec still carries, or undefined when none. */
export function openQuestionsOf(specMarkdown: string): number | undefined {
    const count = clarificationsIn(specMarkdown).length;
    return count > 0 ? count : undefined;
}
