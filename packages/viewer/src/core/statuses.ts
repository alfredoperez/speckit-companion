/** Workflow step identifiers. */
export const WorkflowSteps = {
    SPECIFY: 'specify',
    PLAN: 'plan',
    TASKS: 'tasks',
    IMPLEMENT: 'implement',
    CONFIG_SPECIFY: 'step-specify',
    CONFIG_PLAN: 'step-plan',
    CONFIG_TASKS: 'step-tasks',
    CONFIG_IMPLEMENT: 'step-implement',
} as const;

/**
 * Spec lifecycle status values. `implemented` is the terminal status written when the pipeline
 * finishes implement autonomously; `completed` is reserved for the explicit Mark Completed action.
 */
export const SpecStatuses = {
    ACTIVE: 'active',
    TASKS_DONE: 'tasks-done',
    IMPLEMENTED: 'implemented',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
} as const;

/** What a document's file holds on disk. */
export type DocumentStatus = 'empty' | 'partial' | 'complete';

/** What a document row renders — one value drives both its icon and its tooltip. */
export type DocumentState = 'missing' | 'pending' | 'in-progress' | 'complete';
