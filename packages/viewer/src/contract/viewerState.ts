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
    StepBadgeState,
    StepHistoryEntry,
    TaskSummary,
    TimingSummary,
    ViewerCoverageRow,
    ViewerDecision,
    ViewerVerification,
} from './specContext';

/** A footer action as it crosses to the viewer: the host's visibility predicate is stripped. */
export interface SerializedFooterAction {
    id: string;
    label: string;
    scope: FooterScope;
    tooltip: string;
}

/** What the viewer draws for a spec, derived by the host from `.spec-context.json`. */
export interface ViewerState {
    status: string;
    activeStep: string;
    steps: Record<string, StepBadgeState>;
    pulse: string | null;
    highlights: string[];
    activeSubstep: { step: string; name: string } | null;
    footer: SerializedFooterAction[];
    history: HistoryEntry[];
    stepHistory: Record<string, StepHistoryEntry>;
    timing?: TimingSummary;
    approach?: string;
    lastAction?: string;
    taskSummaries?: Record<string, TaskSummary>;
    /** Normalized: legacy string entries arrive as `{decision}`. */
    decisions?: ViewerDecision[];
    concerns?: ConcernEntry[];
    filesModified?: string[];
    prUrl?: string;
    prNumber?: number;
    checkpointStatus?: CheckpointStatus;
    stepSummaries?: Record<string, Record<string, unknown>>;
    /** Persisted inline review comments, for restore + the Activity list. */
    reviewComments?: ReviewComment[];
    /** Living specs this feature loaded/synced. Absent when none. */
    livingSpecs?: LivingSpecsView;
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
    /** Converge result; absent when converge never ran. */
    converge?: ConvergeResult;
}
