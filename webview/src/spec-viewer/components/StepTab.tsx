import type { SpecDocument, StalenessMap } from '../types';

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
    const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
    const isLastStep = index === totalSteps - 1;
    const inProgress = isLastStep && taskCompletionPercent > 0 && taskCompletionPercent < 100;
    const isReviewing = isViewing && exists && phase !== workflowPhase && !isViewingRelatedDoc;
    const isTasksActive = isLastStep && isViewing && inProgress;
    const isStale = stalenessMap?.[phase]?.isStale ?? false;
    const isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt;
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
    ].filter(Boolean).join(' ');

    const statusIcon = inProgress ? `${taskCompletionPercent}%` : (exists ? '✓' : '');

    return (
        <button
            class={classes}
            data-phase={phase}
            disabled={!isClickable}
            onClick={() => isClickable && phase !== 'done' && onClick(phase)}
        >
            <span class="step-status">{statusIcon}</span>
            <span class="step-label">{doc.label}</span>
            {isStale && <span class="stale-badge">!</span>}
        </button>
    );
}
