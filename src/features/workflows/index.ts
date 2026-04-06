/**
 * Custom Workflows Module
 *
 * Provides workflow configuration, selection, and checkpoint handling
 * for spec-driven development workflows.
 */

// Types
export type {
    CheckpointId,
    CheckpointTrigger,
    CheckpointStatus,
    CheckpointConfig,
    WorkflowStepConfig,
    WorkflowConfig,
    FeatureWorkflowContext,
    WorkflowStep,
    ValidationResult,
    CheckpointResult,
    CheckpointContext,
    SpecStatus,
    StepHistoryEntry,
} from './types';

export { WORKFLOW_NAME_PATTERN, FEATURE_CONTEXT_FILE } from './types';

// Workflow Manager
export {
    DEFAULT_WORKFLOW,
    getWorkflows,
    getWorkflow,
    getStepFile,
    normalizeWorkflowConfig,
    validateWorkflow,
    getWorkflowCommands,
    getFeatureWorkflow,
    saveFeatureWorkflow,
    resolveStepCommand,
    validateWorkflowsOnActivation,
    registerWorkflowConfigChangeListener,
} from './workflowManager';

// Workflow Selector
export { needsSelection, selectWorkflow, getOrSelectWorkflow, resolveWorkflow } from './workflowSelector';

// Checkpoint Handler
export {
    getTriggeredCheckpoints,
    promptForApproval,
    executeCheckpoint,
    executeCheckpointsForTrigger,
} from './checkpointHandler';
