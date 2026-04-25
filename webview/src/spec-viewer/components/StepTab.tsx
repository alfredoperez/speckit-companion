import type { SpecDocument, StalenessMap } from '../types';
import { viewerState } from '../signals';
import { ElapsedTimer } from './ElapsedTimer';

const DOC_TO_STEP: Record<string, string> = {
    spec: 'specify',
    plan: 'plan',
    tasks: 'tasks',
};

const STEP_TOOLTIPS: Record<string, string> = {
    spec: 'Specify — define requirements and scenarios',
    plan: 'Plan — design the implementation approach',
    tasks: 'Tasks — break the plan into work items',
    done: 'Implement — execute and ship',
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
    currentStep?: string | null;
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    stalenessMap?: StalenessMap;
    hasRelatedChildren?: boolean;
    runningStepIndex?: number | null;
    onClick: (phase: string) => void;
}

export function StepTab(props: StepTabProps) {
    const { doc, index, totalSteps, currentDoc, workflowPhase,
        taskCompletionPercent, isViewingRelatedDoc, parentPhaseForRelated,
        activeStep, currentStep, stepHistory, stalenessMap, hasRelatedChildren, runningStepIndex, onClick } = props;

    const phase = doc.type;
    const stepDocExists = doc.exists;
    const exists = stepDocExists || !!hasRelatedChildren;
    const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
    const isLastStep = index === totalSteps - 1;
    const inProgress = isLastStep && currentStep === 'implement' && taskCompletionPercent < 100;
    const isStale = stalenessMap?.[phase]?.isStale ?? false;
    const isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt;
    const isLocked = runningStepIndex != null
        && index > runningStepIndex
        && !isViewing
        && !stepDocExists;
    const isClickable = (exists || index === 0) && !isLocked;

    const vs = viewerState.value;
    const stepName = DOC_TO_STEP[phase] ?? phase;
    // R003: checkmark only when completed AND the step's document exists.
    const vsCompleted = (vs?.highlights?.includes(stepName) ?? false) && stepDocExists;
    const vsSubstep = vs?.activeSubstep?.step === stepName ? vs.activeSubstep.name : null;

    // Collapse to four canonical states (R007, R008).
    // Precedence: locked > in-flight > done > current; default = untouched.
    let canonicalState: 'current' | 'done' | 'in-flight' | 'locked' | null = null;
    if (isLocked) {
        canonicalState = 'locked';
    } else if (isWorking || inProgress) {
        canonicalState = 'in-flight';
    } else if (stepDocExists || vsCompleted) {
        canonicalState = 'done';
    } else if (isViewing) {
        canonicalState = 'current';
    }

    const classes = [
        'step-tab',
        canonicalState,
        canonicalState !== 'current' && isViewing && 'current',
        isStale && 'stale',
    ].filter(Boolean).join(' ');

    // Status content: percentage in-flight, ✓ done, empty otherwise.
    const statusIcon = canonicalState === 'in-flight' && inProgress
        ? `${taskCompletionPercent}%`
        : (canonicalState === 'done' ? '✓' : '');

    const baseTooltip = STEP_TOOLTIPS[phase] ?? doc.label;
    const tooltip = isLocked
        ? `${baseTooltip} (disabled while ${activeStep} is running)`
        : baseTooltip;

    // Only show the elapsed ticker for a live dispatch run — not for the
    // last-step `inProgress` case, which is driven by task-completion percent.
    const runEntry = stepHistory?.[phase];
    const runningStartedAt = canonicalState === 'in-flight'
        && runEntry?.startedAt
        && !runEntry.completedAt
        && !inProgress
        ? runEntry.startedAt
        : null;

    return (
        <button
            class={classes}
            data-phase={phase}
            title={tooltip}
            aria-disabled={!isClickable}
            disabled={!isClickable}
            onClick={() => isClickable && phase !== 'done' && onClick(phase)}
        >
            <span class="step-status">{statusIcon}</span>
            <span class="step-label">{doc.label}</span>
            {vsSubstep && <span class="step-tab__substep">{vsSubstep}</span>}
            {runningStartedAt && <ElapsedTimer startedAt={runningStartedAt} />}
            {isStale && <span class="stale-badge">!</span>}
        </button>
    );
}
