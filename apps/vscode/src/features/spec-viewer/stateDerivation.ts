import type { ConvergeResult, StepName, SpecContext, ViewerState } from '../../core/types/specContext';
import { deriveViewerState as deriveCoreViewerState } from 'speckit-viewer/core/stateDerivation';
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
