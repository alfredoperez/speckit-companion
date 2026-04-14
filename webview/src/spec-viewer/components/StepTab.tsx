import type { SpecDocument, StalenessMap } from '../types';
import { viewerState } from '../signals';

const DOC_TO_STEP: Record<string, string> = {
    spec: 'specify',
    plan: 'plan',
    tasks: 'tasks',
};

export interface StepTabProps {
    doc: SpecDocument;
    index: number;
    totalSteps: number;
    currentDoc: string;
    workflowPhase: string;
    taskCompletionPercent: number;
    isViewingRelatedDoc: boolean;
    parentPhaseForRelated: string;
    activeStep?: string | null;
    stepHistory?: Record<string, { completedAt?: string | null }>;
    stalenessMap?: StalenessMap;
    hasRelatedChildren?: boolean;
    onClick: (phase: string) => void;
}

export function StepTab(props: StepTabProps) {
    const { doc, index, totalSteps, currentDoc, workflowPhase,
        taskCompletionPercent, isViewingRelatedDoc, parentPhaseForRelated,
        activeStep, stepHistory, stalenessMap, hasRelatedChildren, onClick } = props;

    const phase = doc.type;
    const exists = doc.exists || !!hasRelatedChildren;
    const stepDocExists = doc.exists;
    const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
    const isLastStep = index === totalSteps - 1;
    const inProgress = isLastStep && taskCompletionPercent > 0 && taskCompletionPercent < 100;

    const vs = viewerState.value;
    const stepName = DOC_TO_STEP[phase] ?? phase;
    const vsPulse = vs?.pulse === stepName;
    // R003: checkmark only when completed AND the step's document exists.
    const vsCompleted = (vs?.highlights?.includes(stepName) ?? false) && stepDocExists;
    const vsSubstep = vs?.activeSubstep?.step === stepName ? vs.activeSubstep.name : null;

    // R006: `reviewing` when the user is viewing a step other than the active one.
    const viewedStepName = vs?.viewedStep ?? null;
    const activeStepName = vs?.activeStep ?? null;
    const isReviewing = !!viewedStepName
        && stepName === viewedStepName
        && stepName !== activeStepName;
    const isTasksActive = isLastStep && isViewing && inProgress && !isReviewing;
    const isStale = stalenessMap?.[phase]?.isStale ?? false;
    const isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt && !isReviewing;
    const isClickable = exists || index === 0;

    const classes = [
        'step-tab',
        exists && 'exists',
        isReviewing ? 'reviewing' : (isViewing && 'viewing'),
        isTasksActive && 'tasks-active',
        workflowPhase === phase && !isViewing && 'workflow',
        isWorking && 'working',
        !isClickable && 'disabled',
        inProgress && !isTasksActive && 'in-progress',
        isStale && 'stale',
        vsPulse && 'pulse',
        vsCompleted && 'completed',
    ].filter(Boolean).join(' ');

    // R003/R004: only show ✓ when the step's document actually exists.
    const statusIcon = inProgress ? `${taskCompletionPercent}%` : (stepDocExists ? '✓' : '');

    return (
        <button
            class={classes}
            data-phase={phase}
            disabled={!isClickable}
            onClick={() => isClickable && phase !== 'done' && onClick(phase)}
        >
            <span class="step-status">{statusIcon}</span>
            <span class="step-label">{doc.label}</span>
            {vsSubstep && <span class="step-tab__substep">{vsSubstep}</span>}
            {isStale && <span class="stale-badge">!</span>}
        </button>
    );
}
