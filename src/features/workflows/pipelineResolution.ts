/**
 * The one place a spec's pipeline is resolved.
 *
 * Every surface that describes a spec's pipeline — the viewer rail, the sidebar
 * tree, the footer's next-step label, the timing denominator — calls
 * {@link resolveSpecPipeline}. Neither provider keeps a copy, which is what
 * makes FR-006 structural rather than a convention.
 *
 * For the Companion pipeline the shipped steps are spliced with the project's
 * own placed steps (`.specify/companion/nodes/<step>/`). A stock SpecKit or
 * user-defined pipeline is returned untouched.
 */

import * as vscode from 'vscode';
import type { WorkflowConfig, WorkflowStepConfig } from './types';
import {
    COMPANION_WORKFLOW,
    DEFAULT_WORKFLOW,
    getFeatureWorkflow,
    getWorkflow,
    normalizeWorkflowConfig,
} from './workflowManager';
import { resolveWorkflow } from './workflowSelector';
import { PLACEABLE_AFTER, readProjectSteps } from './projectSteps';

/**
 * Side commands that record a run of their own without ever appearing in a
 * pipeline, so pipeline membership alone would stop journaling them.
 */
const OFF_PIPELINE_TIMED_STEPS: ReadonlySet<string> = new Set(['clarify', 'analyze']);

function workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * `COMPANION_WORKFLOW.steps` with the project's placed steps inserted after the
 * step each one names. An unplaced step is omitted (FR-003), `mark-complete`
 * stays last, and `COMPANION_WORKFLOW` itself is never mutated.
 */
export function resolveCompanionSteps(root: string | undefined): WorkflowStepConfig[] {
    const shipped = COMPANION_WORKFLOW.steps ?? [];
    const placed = readProjectSteps(root).filter(s => PLACEABLE_AFTER.includes(s.after));
    if (placed.length === 0) return [...shipped];

    const resolved: WorkflowStepConfig[] = [];
    for (const step of shipped) {
        resolved.push(step);
        for (const project of placed.filter(p => p.after === step.name)) {
            resolved.push({
                name: project.name,
                label: project.label,
                command: `speckit.companion.${project.name}`,
                ...(project.writes ? { file: project.writes } : { actionOnly: true }),
            });
        }
    }
    return resolved;
}

/** A workflow's steps, spliced with the project's own when it is the Companion pipeline. */
function stepsOf(workflow: WorkflowConfig | undefined): WorkflowStepConfig[] | undefined {
    if (!workflow) return undefined;
    const normalized = normalizeWorkflowConfig(workflow);
    if (!normalized.steps || normalized.steps.length === 0) return undefined;
    return normalized.name === COMPANION_WORKFLOW.name
        ? resolveCompanionSteps(workspaceRoot())
        : normalized.steps;
}

/**
 * The ordered pipeline for one spec, as every surface sees it. Read-only —
 * it never creates or modifies the spec's context file — and falls back to the
 * shipped default rather than returning an empty list.
 */
export async function resolveSpecPipeline(
    specDir: string | undefined,
    changeRoot?: string | null,
): Promise<WorkflowStepConfig[]> {
    if (specDir) {
        try {
            const ctx = await getFeatureWorkflow(specDir, changeRoot ?? undefined);
            const recorded = ctx ? stepsOf(getWorkflow(ctx.workflow)) : undefined;
            if (recorded) return recorded;
            const selected = stepsOf(await resolveWorkflow(specDir) ?? undefined);
            if (selected) return selected;
        } catch {
            // fall through to the default pipeline
        }
    }
    return DEFAULT_WORKFLOW.steps!;
}

/**
 * Whether a start entry should be recorded when this step is dispatched.
 *
 * Replaces the two hardcoded name sets: true when the step belongs to a
 * built-in pipeline and measures a duration — so a project's added step is
 * journaled like a shipped one, `mark-complete` (untimed) still is not, and a
 * user-workflow step that records nothing still is not.
 */
export function shouldRecordStepStart(
    steps: WorkflowStepConfig[],
    stepName: string | undefined,
): boolean {
    if (!stepName) return false;
    if (OFF_PIPELINE_TIMED_STEPS.has(stepName)) return true;
    const step = steps.find(s => s.name === stepName);
    return !!step && !step.untimed && step.command.startsWith('speckit.');
}
