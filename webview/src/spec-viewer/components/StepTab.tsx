import type { SpecDocument, StalenessMap } from '../types';
import { viewerState } from '../signals';
import { IMPLEMENT_STEP, isStepInFlight } from '../stepInFlight';
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
    currentDoc: string;
    taskCompletionPercent: number;
    isViewingRelatedDoc: boolean;
    parentPhaseForRelated: string;
    activeStep?: string | null;
    currentStep?: string | null;
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    stalenessMap?: StalenessMap;
    hasRelatedChildren?: boolean;
    runningStepIndex?: number | null;
    /** This tab renders the live implement percent (the implement entry, or the last tab). */
    isPercentHost?: boolean;
    /**
     * For an action step: the document it runs from (Implement runs from
     * tasks.md). Selecting the action opens that document, so no rail entry is
     * ever a dead click.
     */
    sourceDoc?: { type: string; label: string };
    onClick: (phase: string) => void;
}

export function StepTab(props: StepTabProps) {
    const { doc, index, currentDoc,
        taskCompletionPercent, isViewingRelatedDoc, parentPhaseForRelated,
        activeStep, currentStep, stepHistory, stalenessMap, hasRelatedChildren,
        runningStepIndex, isPercentHost, sourceDoc, onClick } = props;

    const phase = doc.type;
    const isAction = doc.category === 'action';
    const stepDocExists = doc.exists;
    const exists = stepDocExists || !!hasRelatedChildren;
    const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
    const isStale = stalenessMap?.[phase]?.isStale ?? false;

    // `activeStep` / `stepHistory` are keyed by step name ('specify'), not doc type ('spec').
    const stepName = DOC_TO_STEP[phase] ?? phase;

    const vs = viewerState.value;

    const run = {
        status: vs?.status,
        activeStep,
        currentStep,
        stepBadges: vs?.steps,
        stepHistory,
        taskCompletionPercent,
    };
    // The percent host stands in for implement when the rail has no implement entry.
    const hostsRunningImplement = !!isPercentHost && isStepInFlight(IMPLEMENT_STEP, run);
    const isWorking = isStepInFlight(stepName, run) || hostsRunningImplement;
    const isLocked = runningStepIndex != null
        && index > runningStepIndex
        && !isViewing
        && !stepDocExists;
    // An action step produces no document of its own, so it opens the one it
    // runs from (Implement → tasks.md). Without such a source it stays inert —
    // and the index-0 escape hatch must not apply to it (a workflow can lead
    // with an action step, e.g. GSD's discuss).
    const isClickable = isAction
        ? !!sourceDoc && !isLocked
        : (exists || index === 0) && !isLocked;
    // R003: checkmark only when completed AND the step's document exists.
    const vsCompleted = (vs?.highlights?.includes(stepName) ?? false) && stepDocExists;
    // An action step has no document, so completion reads from the derived
    // step badges (lifecycle names) or step history (custom names).
    const actionDone = isAction && (
        vs?.steps?.[stepName] === 'completed'
        || !!stepHistory?.[stepName]?.completedAt
    );
    const vsSubstep = vs?.activeSubstep?.step === stepName ? vs.activeSubstep.name : null;

    // Collapse to four canonical states (R007, R008).
    // Precedence: locked > in-flight > done > current; default = untouched.
    let canonicalState: 'current' | 'done' | 'in-flight' | 'locked' | null = null;
    if (isLocked) {
        canonicalState = 'locked';
    } else if (isWorking) {
        canonicalState = 'in-flight';
    } else if (stepDocExists || vsCompleted || actionDone) {
        canonicalState = 'done';
    } else if (isViewing || (isAction && currentStep === stepName)) {
        canonicalState = 'current';
    }

    const classes = [
        'step-tab',
        canonicalState,
        canonicalState !== 'current' && isViewing && 'current',
        isAction && 'action',
        isStale && 'stale',
    ].filter(Boolean).join(' ');

    // The implement-step percentage is a live label (right-aligned, color-ramping)
    // rendered AFTER the step label — not stuffed into the round `.step-status`
    // badge. It advances as `tasks.md` boxes are checked (taskCompletionPercent is
    // file-watched and capture-independent). When it's showing, the badge itself is
    // empty so we don't double-render the number.
    const showPercentLabel = canonicalState === 'in-flight' && hostsRunningImplement;

    // Status content: ✓ done, empty otherwise. The percentage is its own label.
    const statusIcon = canonicalState === 'done' && !showPercentLabel ? '✓' : '';

    // The in-flight indicator renders a spinning `sync` codicon: looping arrows
    // that read as "actively working" at a glance. It now fires for EVERY
    // in-flight step including implement — during implement it sits next to the
    // percent label so the tab has motion instead of a static "Tasks 0%"
    // (#277 Child 4). It vanishes the instant `canonicalState` is no longer
    // `in-flight` (completion recorded or status settled), so a done step never
    // keeps the glyph.
    const showSyncGlyph = canonicalState === 'in-flight';

    const baseTooltip = isAction
        ? sourceDoc
            ? `${doc.label} — action step; opens ${sourceDoc.label}, the document it runs from`
            : `${doc.label} — action step (no document)`
        : STEP_TOOLTIPS[phase] ?? doc.label;
    const tooltip = isLocked
        ? `${baseTooltip} (disabled while ${activeStep} is running)`
        : baseTooltip;

    // A hosted implement run already carries its progress in the percent label.
    const runEntry = stepHistory?.[stepName];
    const runningStartedAt = canonicalState === 'in-flight'
        && runEntry?.startedAt
        && !runEntry.completedAt
        && !hostsRunningImplement
        ? runEntry.startedAt
        : null;

    return (
        <button
            class={classes}
            data-phase={phase}
            title={tooltip}
            aria-current={isViewing ? 'page' : undefined}
            aria-disabled={!isClickable}
            disabled={!isClickable}
            onClick={() => isClickable && phase !== 'done' && onClick(isAction && sourceDoc ? sourceDoc.type : phase)}
        >
            {!showPercentLabel && (
                <span class="step-status">
                    {showSyncGlyph
                        ? <span class="codicon codicon-sync step-status__sync" aria-hidden="true" />
                        : isAction && !statusIcon
                            ? <span class="codicon codicon-zap" aria-hidden="true" />
                            : statusIcon}
                </span>
            )}
            <span class="step-label">{doc.label}</span>
            {showPercentLabel && (
                <span
                    class="step-tab__percent"
                    style={{ '--impl-progress': taskCompletionPercent / 100 } as Record<string, string | number>}
                    aria-label={`${taskCompletionPercent}% of tasks complete`}
                >
                    {showSyncGlyph && (
                        <span class="codicon codicon-sync step-status__sync" aria-hidden="true" />
                    )}
                    {taskCompletionPercent}%
                </span>
            )}
            {vsSubstep && <span class="step-tab__substep">{vsSubstep}</span>}
            {runningStartedAt && <ElapsedTimer startedAt={runningStartedAt} />}
            {isStale && <span class="stale-badge">!</span>}
        </button>
    );
}
