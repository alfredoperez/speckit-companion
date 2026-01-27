/**
 * Custom Workflows API Contract
 *
 * This file defines the public API surface for the custom workflows feature.
 * Implementation should adhere to these contracts.
 *
 * Feature: 001-custom-workflows
 * Date: 2026-01-26
 */

import * as vscode from 'vscode';

// ============================================================================
// Configuration Types (from VS Code settings)
// ============================================================================

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

// ============================================================================
// Workflow Manager API
// ============================================================================

/**
 * Workflow manager interface for loading and managing workflows
 */
export interface IWorkflowManager {
  /**
   * Get all configured workflows including the default workflow
   * @returns Array of workflow configurations
   */
  getWorkflows(): WorkflowConfig[];

  /**
   * Get a specific workflow by name
   * @param name Workflow name
   * @returns Workflow configuration or undefined if not found
   */
  getWorkflow(name: string): WorkflowConfig | undefined;

  /**
   * Validate a workflow configuration
   * @param config Workflow configuration to validate
   * @returns Validation result with errors if invalid
   */
  validateWorkflow(config: WorkflowConfig): ValidationResult;

  /**
   * Get the selected workflow for a feature
   * @param featureDir Path to feature directory
   * @returns Workflow context or undefined if not selected
   */
  getFeatureWorkflow(featureDir: string): Promise<FeatureWorkflowContext | undefined>;

  /**
   * Save workflow selection for a feature
   * @param featureDir Path to feature directory
   * @param workflowName Name of selected workflow
   */
  saveFeatureWorkflow(featureDir: string, workflowName: string): Promise<void>;

  /**
   * Resolve the command for a workflow step
   * @param workflow Workflow configuration
   * @param step Step name (specify, plan, implement)
   * @returns Resolved command name
   */
  resolveStepCommand(workflow: WorkflowConfig, step: WorkflowStep): string;
}

/**
 * Validation result for workflow configurations
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Workflow step identifiers
 */
export type WorkflowStep = 'specify' | 'plan' | 'implement';

// ============================================================================
// Workflow Selector API
// ============================================================================

/**
 * Workflow selector interface for UI interactions
 */
export interface IWorkflowSelector {
  /**
   * Show workflow selection picker
   * @param featureDir Path to feature directory (for context)
   * @returns Selected workflow or undefined if cancelled
   */
  selectWorkflow(featureDir: string): Promise<WorkflowConfig | undefined>;

  /**
   * Check if workflow selection is needed
   * @returns True if multiple workflows are configured
   */
  needsSelection(): boolean;
}

// ============================================================================
// Checkpoint Handler API
// ============================================================================

/**
 * Checkpoint execution result
 */
export interface CheckpointResult {
  status: CheckpointStatus;
  error?: string;
  output?: string;
}

/**
 * Checkpoint handler interface for commit/PR operations
 */
export interface ICheckpointHandler {
  /**
   * Execute a checkpoint
   * @param checkpoint Checkpoint configuration
   * @param featureDir Path to feature directory
   * @param context Additional context for the checkpoint
   * @returns Execution result
   */
  executeCheckpoint(
    checkpoint: CheckpointConfig,
    featureDir: string,
    context: CheckpointContext
  ): Promise<CheckpointResult>;

  /**
   * Prompt user for checkpoint approval
   * @param checkpoint Checkpoint configuration
   * @param featureDir Path to feature directory
   * @returns True if approved, false if declined
   */
  promptForApproval(
    checkpoint: CheckpointConfig,
    featureDir: string
  ): Promise<boolean>;

  /**
   * Get checkpoints triggered after a specific event
   * @param workflow Workflow configuration
   * @param trigger Trigger event
   * @returns Array of checkpoints to execute
   */
  getTriggeredCheckpoints(
    workflow: WorkflowConfig,
    trigger: CheckpointTrigger
  ): CheckpointConfig[];
}

/**
 * Context passed to checkpoint execution
 */
export interface CheckpointContext {
  featureName: string;
  branchName: string;
  commitMessage?: string;
}

// ============================================================================
// VS Code Command Handlers
// ============================================================================

/**
 * Command handler signatures for workflow-related commands
 */
export interface WorkflowCommandHandlers {
  /**
   * Execute the specify step with workflow selection
   * @param specDir Optional spec directory
   * @param refinementContext Optional refinement context
   */
  'speckit.specify': (specDir?: string, refinementContext?: string) => Promise<void>;

  /**
   * Execute the plan step with workflow selection
   * @param specDir Optional spec directory
   * @param refinementContext Optional refinement context
   */
  'speckit.plan': (specDir?: string, refinementContext?: string) => Promise<void>;

  /**
   * Execute the implement step with workflow selection and checkpoints
   * @param specDir Optional spec directory
   * @param refinementContext Optional refinement context
   */
  'speckit.implement': (specDir?: string, refinementContext?: string) => Promise<void>;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Event emitted when workflow selection changes
 */
export interface WorkflowChangedEvent {
  featureDir: string;
  workflowName: string;
  previousWorkflow?: string;
}

/**
 * Event emitted when a checkpoint completes
 */
export interface CheckpointCompletedEvent {
  featureDir: string;
  checkpointId: CheckpointId;
  status: CheckpointStatus;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW: WorkflowConfig = {
  name: 'default',
  displayName: 'Default',
  description: 'Standard SpecKit workflow',
  'step-specify': 'speckit.specify',
  'step-plan': 'speckit.plan',
  'step-implement': 'speckit.implement',
  checkpoints: [],
};

/**
 * Configuration key for custom workflows
 */
export const CONFIG_KEY_CUSTOM_WORKFLOWS = 'speckit.customWorkflows';

/**
 * File name for feature workflow context
 */
export const FEATURE_CONTEXT_FILE = '.speckit.json';

/**
 * Workflow name validation pattern
 */
export const WORKFLOW_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
