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
    /** Display label shown in sidebar (e.g., "Specify", "Plan") */
    label?: string;
    /** Command to execute for this step (e.g., "speckit.specify") */
    command: string;
    /** Primary output file for this step (e.g., "spec.md"). Defaults to `{name}.md` */
    file?: string;
    /** Explicit list of sub-files shown as children in sidebar */
    subFiles?: string[];
    /** Directory to scan for sub-files (non-recursive, .md only) */
    subDir?: string;
    /** When true, unassigned .md files in the spec folder are grouped under this step */
    includeRelatedDocs?: boolean;
}

/**
 * Workflow configuration from VS Code settings
 */
export interface WorkflowConfig {
    name: string;
    displayName?: string;
    description?: string;
    /** Flexible steps array (new format) */
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
}

/**
 * Feature workflow context persisted in .speckit.json
 */
export interface FeatureWorkflowContext {
    workflow: string;
    selectedAt: string;
    checkpointStatus?: Record<CheckpointId, CheckpointStatus>;
}

/**
 * Workflow step identifiers
 * Now a string to support arbitrary custom step names
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
export const FEATURE_CONTEXT_FILE = '.speckit.json';
