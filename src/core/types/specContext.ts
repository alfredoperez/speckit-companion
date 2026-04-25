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

export type TransitionBy = 'extension' | 'user' | 'cli';

export interface Transition {
    step: StepName;
    substep: string | null;
    from: TransitionFrom;
    by: TransitionBy;
    at: string;
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

export interface ViewerState {
    status: Status;
    activeStep: StepName;
    steps: Record<string, StepBadgeState>;
    pulse: StepName | null;
    highlights: StepName[];
    activeSubstep: { step: StepName; name: string } | null;
    footer: FooterAction[];
}

/** Canonical list of substep names used by Companion prompts. */
export const CANONICAL_SUBSTEPS = {
    specify: ['outline', 'validate-checklist'],
    plan: ['research', 'design'],
    tasks: ['generate'],
    implement: ['run-tests'],
} as const;
