/**
 * Contract: reading a project's own Companion steps, and resolving the pipeline
 * every surface draws.
 *
 * Identifiers below are pinned by the spec's Verbatim Constraints and are
 * copied exactly: the step directory `.specify/companion/nodes/<step>/`, the
 * `_order.yml` file inside it, its `after:` key, the `writes:` key, and the
 * settings key `speckit.customWorkflows` that this feature must never write.
 *
 * Not shipped code — the surface the implementation and its tests code against.
 */

import type { WorkflowStepConfig } from '../../../src/features/workflows/types';

/** Where an added step is declared, relative to the workspace root. */
export const PROJECT_NODES_REL = '.specify/companion/nodes';

/** The file inside a step directory that carries its placement. */
export const ORDER_FILE = '_order.yml';

/** The file inside a step directory that carries its label. */
export const FRAME_FILE = '_frame.md';

/** The key in `_order.yml` naming the step this one runs behind. */
export const AFTER_KEY = 'after:';

/** The key in a node's frontmatter naming the document the step produces. */
export const WRITES_KEY = 'writes:';

/**
 * The settings key this feature MUST NOT write to. Present here so a test can
 * assert the absence rather than trusting the reader.
 */
export const FORBIDDEN_SETTINGS_KEY = 'speckit.customWorkflows';

/** The shipped steps an added step may be placed behind. */
export const PLACEABLE_AFTER: readonly string[] = ['specify', 'plan', 'tasks', 'implement'];

/** One step a project added, as read off disk. Nothing writes this. */
export interface ProjectStep {
    /** Directory name under `.specify/companion/nodes/`. */
    name: string;
    /** From `description:` in `_frame.md`, else the name made readable. */
    label: string;
    /** From `after:` in `_order.yml`. Empty when the step declares no placement. */
    after: string;
    /** From a node's `writes:`. Empty when the step produces no document. */
    writes: string;
}

/**
 * Every valid step directory under `<root>/.specify/companion/nodes/`, ordered
 * by directory name.
 *
 * Never throws. A missing, unreadable, or malformed directory yields `[]` or
 * omits just that entry (FR-007). Directories whose name collides with a
 * shipped step are omitted, so the rail can never draw a duplicate.
 */
export declare function readProjectSteps(root: string): ProjectStep[];

/**
 * `COMPANION_WORKFLOW.steps` with the project's placed steps inserted after the
 * step each one names.
 *
 * An unplaced step (no `after:`, or one naming a step outside
 * `PLACEABLE_AFTER`) is omitted (FR-003). Two steps naming the same `after`
 * both appear, in directory-name order, stable between calls. `mark-complete`
 * stays last. A root with no step directory returns the shipped list unchanged
 * (SC-003), and `COMPANION_WORKFLOW` itself is never mutated.
 */
export declare function resolveCompanionSteps(root: string | undefined): WorkflowStepConfig[];

/**
 * The single resolution FR-006 requires: the ordered pipeline for one spec, as
 * the rail, the sidebar, the footer and the timing summary all see it.
 *
 * Resolves the spec's recorded workflow, then applies `resolveCompanionSteps`
 * only when that workflow is the Companion pipeline — a stock or user-defined
 * pipeline is returned untouched (FR-008). Read-only: it never creates or
 * modifies the spec's context file. Falls back to the shipped default pipeline
 * rather than returning an empty list.
 *
 * `specViewerProvider` and `specExplorerProvider` both call this and neither
 * keeps a copy.
 */
export declare function resolveSpecPipeline(
    specDir: string | undefined,
    changeRoot?: string | null,
): Promise<WorkflowStepConfig[]>;

/**
 * Whether a start entry should be recorded when this step is dispatched.
 *
 * Replaces the two hardcoded name sets. True when the step is in the spec's
 * resolved pipeline and is not `untimed` — so an added step is journaled like a
 * shipped one, `mark-complete` still is not, and a user-workflow step that
 * records nothing still is not.
 */
export declare function shouldRecordStepStart(
    steps: WorkflowStepConfig[],
    stepName: string | undefined,
): boolean;
