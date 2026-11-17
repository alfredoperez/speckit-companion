/**
 * The `.spec-context.json` contract lives in the `speckit-viewer` package. The extension's
 * own view of it, with footer predicates that never cross to the webview, stays here.
 */
import type {
    CheckpointStatus,
    ClassificationEntry,
    ConcernEntry,
    ConvergeResult,
    FooterScope,
    HistoryEntry,
    LivingSpecsView,
    ReviewComment,
    RiskEntry,
    SpecContext,
    Status,
    StepBadgeState,
    StepHistoryEntry,
    StepName,
    TaskSummary,
    TimingSummary,
    ViewerCoverageRow,
    ViewerDecision,
    ViewerVerification,
} from 'speckit-viewer/contract/specContext';

export * from 'speckit-viewer/contract/specContext';

/**
 * Visibility predicate for a footer action.
 *
 * `stepHistory` is the in-memory derived view (from `ctx.history`) — passed
 * in so each predicate doesn't redo the derivation. Optional for callers
 * that don't need per-step timing.
 */
export type FooterVisibleWhen = (
    ctx: SpecContext,
    step: StepName,
    stepHistory: Record<string, StepHistoryEntry>,
    // Ordered active-workflow steps, structural to avoid a core→feature import.
    // Lets step-scoped actions answer "is there a later step" from the custom
    // workflow's own order rather than the hardcoded lifecycle.
    workflowSteps?: readonly { name: string }[]
) => boolean;

export interface FooterAction {
    id: string;
    label: string;
    scope: FooterScope;
    visibleWhen: FooterVisibleWhen;
    /** Base tooltip; the renderer appends the scope phrase. */
    tooltip: string;
}

export interface ViewerState {
    status: Status;
    activeStep: StepName;
    steps: Record<string, StepBadgeState>;
    pulse: StepName | null;
    highlights: StepName[];
    activeSubstep: { step: StepName; name: string } | null;
    footer: FooterAction[];
    history: HistoryEntry[];
    stepHistory: Record<string, StepHistoryEntry>;
    timing: TimingSummary;
    /** Activity panel — passthroughs from `.spec-context.json`. */
    approach?: string;
    lastAction?: string;
    taskSummaries?: Record<string, TaskSummary>;
    /** Normalized: legacy string entries fold into `{decision}`. */
    decisions?: ViewerDecision[];
    concerns?: ConcernEntry[];
    filesModified?: string[];
    prUrl?: string;
    prNumber?: number;
    checkpointStatus?: CheckpointStatus;
    stepSummaries?: Record<string, Record<string, unknown>>;
    /** Reasoning-trail capture, normalized for rendering. */
    intent?: string;
    request?: string;
    /** The ticket the spec came from, an id or a URL. */
    source?: string;
    /** True when `source` names an idea folder, so the Overview can open that idea. */
    sourceIsIdea?: boolean;
    /** An earlier spec folder this one extends. */
    extends?: string;
    /** An earlier spec folder this one replaces. */
    supersedes?: string;
    expectations?: string[];
    context?: string[];
    verified?: ViewerVerification[];
    coverage?: ViewerCoverageRow[];
    classification?: ClassificationEntry;
    risk?: RiskEntry;
    /** Persisted inline review comments, surfaced for restore + Activity. */
    reviewComments?: ReviewComment[];
    /** Living specs loaded/synced for this feature (LS·7). Absent when none. */
    livingSpecs?: LivingSpecsView;
    /** Converge result; absent when converge never ran. */
    converge?: ConvergeResult;
}
