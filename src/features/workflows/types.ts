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
 * Workflow configuration from VS Code settings
 */
export interface WorkflowConfig {
    name: string;
    displayName?: string;
    description?: string;
    'step-specify'?: string;
    'step-plan'?: string;
    'step-tasks'?: string;
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
 */
export type WorkflowStep = 'specify' | 'plan' | 'tasks' | 'implement';

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
