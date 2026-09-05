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
export type { WorkflowChoice } from './workflowManager';
export {
    DEFAULT_WORKFLOW,
    buildWorkflowChoices,
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
    isWorkflowSupportedForProvider,
    isCompanionSelectable,
    resolveEffectiveDefaultWorkflow,
    pickEffectiveDefaultWorkflow,
} from './workflowManager';

// Pipeline Resolution — the one place a spec's pipeline is resolved
export { resolveSpecPipeline, resolveCompanionSteps, shouldRecordStepStart } from './pipelineResolution';

// Workflow Selector
export { getOrSelectWorkflow, resolveWorkflow } from './workflowSelector';

// Checkpoint Handler
export {
    getTriggeredCheckpoints,
    promptForApproval,
    executeCheckpoint,
    executeCheckpointsForTrigger,
} from './checkpointHandler';
