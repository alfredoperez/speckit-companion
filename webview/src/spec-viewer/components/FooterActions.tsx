import { navState, viewerState } from '../signals';
import { inFlightStepFor, isStepInFlight } from '../stepInFlight';
import { CatalogFooter } from './footer/CatalogFooter';

export interface FooterActionsProps {
    initialSpecStatus: string;
}

/**
 * The footer is a pure function of one `viewerState` snapshot (INV-1). The
 * in-flight ("Generating…") footer pill was removed (#277 Child 4): the single
 * source of in-flight motion is the spinning step tab. The only render shape is
 * `CatalogFooter`; while the current step is in flight, its forward-motion
 * button is suppressed so the user can't advance a step that hasn't settled.
 */
export function FooterActions(_props: FooterActionsProps) {
    const vs = viewerState.value;
    const ns = navState.value;

    if (!vs) return null;

    const status = vs.status;
    // The spec is still active (so refinement/enhancement buttons may show) until
    // it reaches the closure gate. CatalogFooter additionally suppresses them once
    // the footer offers a closure action.
    const isActive = status !== 'implemented' && status !== 'completed' && status !== 'archived';
    // Ask the resilient (history-aware) derivation, not the status string, so a lagging status can't lock the button.
    const runningStep = inFlightStepFor(status);
    const stepInFlight = runningStep !== undefined && isStepInFlight(runningStep, {
        status,
        activeStep: vs.activeStep,
        currentStep: vs.activeStep,
        stepHistory: vs.stepHistory,
        stepBadges: vs.steps,
    });
    const enhancementButtons = ns?.enhancementButtons ?? [];

    return (
        <CatalogFooter
            vs={vs}
            isActive={isActive}
            stepInFlight={stepInFlight}
            enhancementButtons={enhancementButtons}
        />
    );
}
