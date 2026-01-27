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
    WorkflowConfig,
    FeatureWorkflowContext,
    WorkflowStep,
    ValidationResult,
    CheckpointResult,
    CheckpointContext,
} from './types';

export { WORKFLOW_NAME_PATTERN, FEATURE_CONTEXT_FILE } from './types';

// Workflow Manager
export {
    DEFAULT_WORKFLOW,
    getWorkflows,
    getWorkflow,
    validateWorkflow,
    getFeatureWorkflow,
    saveFeatureWorkflow,
    resolveStepCommand,
    validateWorkflowsOnActivation,
    registerWorkflowConfigChangeListener,
} from './workflowManager';

// Workflow Selector
export { needsSelection, selectWorkflow, getOrSelectWorkflow } from './workflowSelector';

// Checkpoint Handler
export {
    getTriggeredCheckpoints,
    promptForApproval,
    executeCheckpoint,
    executeCheckpointsForTrigger,
} from './checkpointHandler';
