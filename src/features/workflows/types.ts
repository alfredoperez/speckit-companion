/**
 * Custom Workflows Type Definitions
 *
 * Type definitions for the custom workflows feature.
 * Based on contracts from specs/001-custom-workflows/contracts/workflow-api.ts
 */

/**
 * Checkpoint type identifiers
 */
export type CheckpointId = 'commit' | 'pr';

/**
 * Checkpoint trigger points
 */
export type CheckpointTrigger = 'after-implement' | 'after-commit';

/**
 * Checkpoint status values
 */
export type CheckpointStatus = 'pending' | 'completed' | 'skipped';

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
    id: CheckpointId;
    trigger: CheckpointTrigger;
    requiresApproval?: boolean;
    excludeCoAuthor?: boolean;
    prTitleTemplate?: string;
}

/**
 * Configuration for a single workflow step
 */
export interface WorkflowStepConfig {
    /** Step identifier (e.g., "specify", "plan", "design") */
    name: string;
    /** Display label (e.g., "Specify", "Plan"). Defaults to capitalized name */
    label?: string;
    /** Command to execute for this step (e.g., "speckit.specify") */
    command: string;
    /** Primary output file (e.g., "spec.md"). Defaults to `{name}.md` */
    file?: string;
    /** If true, step is action-only (no output file) and hidden from the document tree */
    actionOnly?: boolean;
    /** Explicit list of sub-files shown as children in sidebar */
    subFiles?: string[];
    /** Subdirectory to scan for child .md files */
    subDir?: string;
    /** If true, unattached related docs are shown as children of this step */
    includeRelatedDocs?: boolean;
}

/**
 * Workflow configuration from VS Code settings
 */
export interface WorkflowConfig {
    name: string;
    displayName?: string;
    description?: string;
    /** New flexible steps array */
    steps?: WorkflowStepConfig[];
    /** @deprecated Legacy step keys — use `steps` array instead */
    'step-specify'?: string;
    /** @deprecated */
    'step-plan'?: string;
    /** @deprecated */
    'step-tasks'?: string;
    /** @deprecated */
    'step-implement'?: string;
    checkpoints?: CheckpointConfig[];
    /** Custom command buttons shown next to step actions */
    commands?: WorkflowCommandConfig[];
    /**
     * AI provider ids this workflow supports (e.g. `["claude"]`).
     * Omitted or empty = supported by all providers. When non-empty, the
     * workflow is only surfaced while the active provider id is in the list.
     */
    supportedAiProviders?: string[];
}

/**
 * Custom command button associated with a workflow step
 */
export interface WorkflowCommandConfig {
    /** Unique command identifier */
    name: string;
    /** Button label */
    title?: string;
    /** Command to execute (e.g., '/speckit.specify') */
    command: string;
    /** Which workflow step this command is associated with */
    step: string;
    /** Tooltip shown on hover */
    tooltip?: string;
}

/**
 * Previous step/substep state before a transition
 */
export interface TransitionFrom {
    step: string | null;
    substep: string | null;
}

/**
 * A single workflow step transition recorded in .spec-context.json
 */
export interface TransitionEntry {
    step: string;
    substep: string | null;
    from: TransitionFrom | null;
    by: 'extension' | string;
    at: string;
}

/**
 * Spec status for sidebar grouping. Mirrors the canonical `SpecStatuses`
 * (src/core/constants.ts) so status handling is type-checked end to end:
 * `tasks-done` (all tasks checked, pre-completion) and the terminal
 * `implemented` (pipeline finished implement; distinct from user `completed`)
 * are both first-class here, not runtime-only strings.
 */
export type SpecStatus = 'active' | 'tasks-done' | 'implemented' | 'completed' | 'archived';

/**
 * Step history entry tracking when a step was started and completed
 */
export interface StepHistoryEntry {
    startedAt: string;
    completedAt: string | null;
}

/**
 * Feature workflow context persisted in .spec-context.json
 *
 * Extension-managed fields: workflow, selectedAt, currentStep, status, stepHistory, checkpointStatus
 * Skill-enriched fields (optional): step, substep, task, next, updated, approach, last_action,
 *   task_summaries, step_summaries, files_modified
 */
export interface FeatureWorkflowContext {
    workflow: string;
    selectedAt: string;
    /** Current step in the workflow (e.g. "specify", "plan", "tasks", "done", "archived") */
    currentStep?: string;
    /** Spec status for sidebar grouping */
    status?: SpecStatus;
    /** Step history with start/completion timestamps */
    stepHistory?: Record<string, StepHistoryEntry>;
    checkpointStatus?: Record<CheckpointId, CheckpointStatus>;
    /** Human-readable spec name derived from directory slug */
    specName?: string;
    /** Git branch name associated with this spec (audit trail — branch when the spec was created) */
    branch?: string;
    /** Active feature branch where implementation runs (set when branchStage matches) */
    workingBranch?: string | null;
    /** In-progress indicator (e.g., "exploring", "phase1") */
    progress?: string | null;
    /** Current task being executed (e.g., "T001") */
    currentTask?: string | null;
    /** ISO string when the spec was first created */
    createdAt?: string;
    approach?: string;
    last_action?: string;
    task_summaries?: Record<string, unknown>;
    step_summaries?: Record<string, unknown>;
    files_modified?: string[];
    /** Append-only log of workflow step boundaries. */
    history?: TransitionEntry[];
}

/**
 * Workflow step identifiers (now accepts any string for custom steps)
 */
export type WorkflowStep = string;

/**
 * Validation result for workflow configurations
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Checkpoint execution result
 */
export interface CheckpointResult {
    status: CheckpointStatus;
    error?: string;
    output?: string;
}

/**
 * Context passed to checkpoint execution
 */
export interface CheckpointContext {
    featureName: string;
    branchName: string;
    commitMessage?: string;
}

/**
 * Workflow name validation pattern
 */
export const WORKFLOW_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * File name for feature workflow context
 */
export const FEATURE_CONTEXT_FILE = '.spec-context.json';

