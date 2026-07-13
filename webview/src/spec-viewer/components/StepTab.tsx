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

// Spec-level transition `status` → the step that is actively running for it.
// An in-flight status spins ONLY its matching step; a settled status spins none.
// (#255 — drive the in-flight glyph off `status`, not just history `completedAt`,
// so a step stops spinning the moment its status settles even if the self-close
// `complete` history entry never landed.)
const STATUS_TO_INFLIGHT_STEP: Record<string, string> = {
    specifying: 'specify',
    planning: 'plan',
    tasking: 'tasks',
    implementing: 'implement',
};

// Settled statuses: no step spins. The in-flight counterparts above are the only
// statuses that drive a spinner; everything else (incl. completed / archived) is
// settled.
const SETTLED_STATUSES = new Set([
    'specified', 'planned', 'ready-to-implement', 'implemented', 'completed', 'archived',
]);

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
    /** This tab renders the live implement percent (the implement entry, or the last tab). */
    isPercentHost?: boolean;
    onClick: (phase: string) => void;
}

export function StepTab(props: StepTabProps) {
    const { doc, index, currentDoc, workflowPhase,
        taskCompletionPercent, isViewingRelatedDoc, parentPhaseForRelated,
        activeStep, currentStep, stepHistory, stalenessMap, hasRelatedChildren,
        runningStepIndex, isPercentHost, onClick } = props;

    const phase = doc.type;
    const isAction = doc.category === 'action';
    const stepDocExists = doc.exists;
    const exists = stepDocExists || !!hasRelatedChildren;
    const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
    const inProgress = !!isPercentHost && currentStep === 'implement' && taskCompletionPercent < 100;
    const isStale = stalenessMap?.[phase]?.isStale ?? false;

    const stepName = DOC_TO_STEP[phase] ?? phase;

    const vs = viewerState.value;

    // Drive the in-flight indicator off the transition `status` first, falling
    // back to step-history for a live dispatch that hasn't moved `status` yet.
    // `activeStep` and `stepHistory` are keyed by step name (e.g. 'specify'),
    // not doc type (e.g. 'spec'). Compare against the mapped name so the
    // in-flight visual fires correctly during specifying / planning / etc.
    const statusStep = vs?.status ? STATUS_TO_INFLIGHT_STEP[vs.status] : undefined;
    const statusInFlight = statusStep === stepName;
    // A settled status means NO step spins — even this one, even if its
    // self-close `complete` history entry (a `completedAt`) never landed (#255).
    const statusSettled = vs?.status ? SETTLED_STATUSES.has(vs.status) : false;
    // When the status is itself in-flight (`statusStep` defined), it is
    // authoritative: ONLY the step it points at spins. The history fallback is
    // for statuses that give no in-flight guidance (e.g. `draft`/unknown) — using
    // it while status is in-flight could spin a second tab if `activeStep` and
    // `status` momentarily disagree (#255 review).
    const statusGivesGuidance = statusStep !== undefined || statusSettled;
    const isWorking = statusInFlight
        || (!statusGivesGuidance
            && activeStep === stepName
            && !stepHistory?.[stepName]?.completedAt);
    const isLocked = runningStepIndex != null
        && index > runningStepIndex
        && !isViewing
        && !stepDocExists;
    // Action steps are never openable — the index-0 escape hatch must not
    // apply (a workflow can lead with an action step, e.g. GSD's discuss).
    const isClickable = !isAction && (exists || index === 0) && !isLocked;
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
    } else if (isWorking || inProgress) {
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
    const showPercentLabel = canonicalState === 'in-flight' && inProgress;

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
        ? `${doc.label} — action step (no document)`
        : STEP_TOOLTIPS[phase] ?? doc.label;
    const tooltip = isLocked
        ? `${baseTooltip} (disabled while ${activeStep} is running)`
        : baseTooltip;

    // Only show the elapsed ticker for a live dispatch run — not for the
    // last-step `inProgress` case, which is driven by task-completion percent.
    // Use the mapped stepName (matches activeStep / stepHistory keys),
    // not the doc-type phase.
    const runEntry = stepHistory?.[stepName];
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
            aria-current={isViewing ? 'page' : undefined}
            aria-disabled={!isClickable}
            disabled={!isClickable}
            onClick={() => isClickable && phase !== 'done' && onClick(phase)}
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
