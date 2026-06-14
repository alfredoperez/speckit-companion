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

/**
 * Per-substep timing entry. Derived in-memory by the viewer from
 * `history[]`; not persisted on disk.
 */
export interface SubstepEntry {
    name: string;
    startedAt: string;
    completedAt: string | null;
}

/**
 * Per-step timing entry. Derived in-memory by the viewer from `history[]`;
 * not persisted on disk. (See `ViewerState.stepHistory`.)
 */
export interface StepHistoryEntry {
    startedAt: string;
    completedAt: string | null;
    substeps?: SubstepEntry[];
}

export interface HistoryEntryFrom {
    step: StepName | null;
    substep: string | null;
}

export type HistoryEntryBy = 'extension' | 'user' | 'cli' | 'ai' | 'derive';

/** Discriminates between a step/substep start and a step/substep completion. */
export type HistoryEntryKind = 'start' | 'complete';

/**
 * A single entry in the append-only `history[]` log. Replaces the previous
 * `transitions[]` field — the on-disk source of truth for the spec's
 * lifecycle. Per-step timing (`stepHistory`) is derived from this in-memory
 * by the viewer; it is not persisted.
 *
 * `kind` explicitly tags the entry as a start or completion event.
 */
export interface HistoryEntry {
    step: StepName;
    substep: string | null;
    /** Per-task id on implement entries. The canonical per-task identifier; `substep` is null on these. */
    task?: string;
    kind: HistoryEntryKind;
    /**
     * Legacy, read-only: derivable from the previous entry's step. Writers no
     * longer emit it; kept here so old records still parse. Never write it.
     */
    from?: HistoryEntryFrom;
    by: HistoryEntryBy;
    at: string;
}

// Type-only aliases retained so call sites that import `Transition` keep
// compiling. The on-disk field is `history` only — these are pure imports.
export type Transition = HistoryEntry;
export type TransitionFrom = HistoryEntryFrom;
export type TransitionBy = HistoryEntryBy;


/**
 * Document a review comment is anchored to. Was previously restricted to the
 * three core docs (`spec`/`plan`/`tasks`); now accepts any document type
 * string the viewer exposes (e.g. `data-model`, `research`,
 * `checklists/requirements`) so comments persist on non-core docs too.
 */
export type ReviewCommentDoc = string;

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
    history: HistoryEntry[];
    /** Persisted inline review comments (replaces `<doc>-extra.md`). */
    reviewComments?: ReviewComment[];
    // Skill-authored fields, viewer-relevant — declared optional;
    // other unknown fields remain tolerated via the index signature.
    /** Last action one-liner written by the implement skill. */
    last_action?: string;
    /**
     * Legacy per-spec profile field from before the workflow-choice collapse.
     * No longer written or read for dispatch — the `workflow` field now drives the
     * command family. Kept optional so older specs that still carry it are tolerated
     * and preserved on write.
     */
    profile?: 'standard' | 'turbo';
    /**
     * Random per-spec correlation id for anonymous telemetry. A UUID, never the
     * spec name or path. Minted at spec creation (or lazily on the first
     * telemetry event for a pre-existing spec) and persisted so the same id
     * rides every later event for this spec, enabling a per-spec funnel.
     */
    telemetryInstanceId?: string;
    /**
     * Per-task summaries (skill-authored). Loosely typed at the raw on-disk
     * layer because writers emit varied shapes; the reader normalizes them and
     * the viewer exposes the strongly-typed form via `ViewerState.taskSummaries`.
     */
    task_summaries?: Record<string, unknown>;
    /** Per-step summaries (specify/plan/etc., skill-authored). */
    step_summaries?: Record<string, Record<string, unknown>>;
    // Unknown / legacy fields tolerated and preserved.
    [key: string]: unknown;
}

/** Viewer-side step badge */
export type StepBadgeState = 'not-started' | 'in-progress' | 'completed';

/** Scope of a footer action */
export type FooterScope = 'spec' | 'step';

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
    stepHistory: Record<string, StepHistoryEntry>
) => boolean;

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
    history: HistoryEntry[];
    stepHistory: Record<string, StepHistoryEntry>;
    /** Whether the running step's artifact exists on disk with non-trivial content (100% tasks for implement). Drives the footer's Generating→ready transition. */
    runningStepArtifactReady: boolean;
    /** `startedAt` of the running step, anchoring the footer's recovery-timeout window. `null` when no step is in flight. */
    runningStepStartedAt: string | null;
    /** Human label of the running step (e.g. "Plan", "Implementation"). `null` when no step is in flight. */
    runningStepLabel: string | null;
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
    clarify: [],
    plan: ['research', 'design'],
    tasks: ['generate'],
    analyze: [],
    implement: ['run-tests'],
} as const;
