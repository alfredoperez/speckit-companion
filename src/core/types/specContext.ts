/**
 * Canonical SpecContext types for `.spec-context.json`.
 *
 * See specs/060-spec-context-tracking/data-model.md and
 * src/core/types/spec-context.schema.json.
 */

export type StepName =
    | 'specify'
    | 'clarify'
    | 'plan'
    | 'tasks'
    | 'analyze'
    | 'implement';

export const STEP_NAMES: StepName[] = [
    'specify',
    'clarify',
    'plan',
    'tasks',
    'analyze',
    'implement',
];

export type Status =
    | 'draft'
    | 'specifying'
    | 'specified'
    | 'planning'
    | 'planned'
    | 'tasking'
    | 'ready-to-implement'
    | 'implementing'
    | 'implemented'
    | 'completed'
    | 'archived';

export const STATUSES: Status[] = [
    'draft',
    'specifying',
    'specified',
    'planning',
    'planned',
    'tasking',
    'ready-to-implement',
    'implementing',
    'implemented',
    'completed',
    'archived',
];

export interface SubstepEntry {
    name: string;
    startedAt: string;
    completedAt: string | null;
}

export interface StepHistoryEntry {
    startedAt: string;
    completedAt: string | null;
    substeps?: SubstepEntry[];
}

export interface TransitionFrom {
    step: StepName | null;
    substep: string | null;
}

export type TransitionBy = 'extension' | 'user' | 'cli' | 'sdd' | 'ai';

export interface Transition {
    step: StepName;
    substep: string | null;
    from: TransitionFrom;
    by: TransitionBy;
    at: string;
}

/** Document a review comment is anchored to. */
export type ReviewCommentDoc = 'spec' | 'plan' | 'tasks';

/** Lifecycle of a persisted review comment. */
export type ReviewCommentStatus = 'pending' | 'applied';

/**
 * Where a review comment is anchored in its source document. `line` is the
 * 1-based line at creation time; `blockText`/`heading` let the viewer
 * re-anchor (best-effort) when the source drifts. See extractBlock.ts.
 */
export interface ReviewCommentAnchor {
    heading: string | null;
    blockText: string;
    line: number;
}

/**
 * A persisted inline review comment. Stored on `.spec-context.json` under
 * `reviewComments` so an in-progress review survives tab close / reopen and
 * is committable. Replaces the per-doc `<doc>-extra.md` scratchpad files.
 */
export interface ReviewComment {
    id: string;
    doc: ReviewCommentDoc;
    anchor: ReviewCommentAnchor;
    comment: string;
    status: ReviewCommentStatus;
    createdAt: string;
}

/**
 * Canonical `.spec-context.json` document. Unknown top-level fields MUST be
 * preserved across writes (FR-013).
 */
export interface SpecContext {
    workflow: string;
    specName: string;
    branch: string;
    workingBranch?: string | null;
    selectedAt?: string;
    currentStep: StepName;
    status: Status;
    stepHistory: Record<string, StepHistoryEntry>;
    transitions: Transition[];
    /** Persisted inline review comments (replaces `<doc>-extra.md`). */
    reviewComments?: ReviewComment[];
    // Unknown / legacy fields tolerated and preserved.
    [key: string]: unknown;
}

/** Viewer-side step badge */
export type StepBadgeState = 'not-started' | 'in-progress' | 'completed';

/** Scope of a footer action */
export type FooterScope = 'spec' | 'step';

/** Visibility predicate for a footer action */
export type FooterVisibleWhen = (ctx: SpecContext, step: StepName) => boolean;

export interface FooterAction {
    id: string;
    label: string;
    scope: FooterScope;
    visibleWhen: FooterVisibleWhen;
    /** Base tooltip; the renderer appends the scope phrase. */
    tooltip: string;
}

export interface TaskSummary {
    status: 'DONE' | 'DONE_WITH_CONCERNS' | string;
    did?: string;
    files?: string[];
    concerns?: string[];
}

export interface ConcernEntry {
    task?: string;
    note: string;
}

export interface CheckpointStatus {
    commit?: boolean;
    pr?: boolean;
}

export interface ViewerState {
    status: Status;
    activeStep: StepName;
    steps: Record<string, StepBadgeState>;
    pulse: StepName | null;
    highlights: StepName[];
    activeSubstep: { step: StepName; name: string } | null;
    footer: FooterAction[];
    transitions: Transition[];
    stepHistory: Record<string, StepHistoryEntry>;
    /** Activity panel — passthroughs from `.spec-context.json`. */
    approach?: string;
    lastAction?: string;
    taskSummaries?: Record<string, TaskSummary>;
    decisions?: string[];
    concerns?: ConcernEntry[];
    filesModified?: string[];
    prUrl?: string;
    prNumber?: number;
    checkpointStatus?: CheckpointStatus;
    stepSummaries?: Record<string, Record<string, unknown>>;
    /** Persisted inline review comments, surfaced for restore + Activity. */
    reviewComments?: ReviewComment[];
}

/** Canonical list of substep names used by Companion prompts. */
export const CANONICAL_SUBSTEPS = {
    specify: ['outline', 'validate-checklist'],
    plan: ['research', 'design'],
    tasks: ['generate'],
    implement: ['run-tests'],
} as const;
