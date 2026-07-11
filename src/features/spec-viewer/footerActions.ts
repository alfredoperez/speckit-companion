/**
 * Footer action catalog with scope metadata and visibility rules.
 *
 * - Every action declares `scope: 'spec' | 'step'` (FR-009).
 * - Tooltips are auto-suffixed with a scope phrase at render time.
 * - The `Approve` button's visible label is the next step's label
 *   (e.g. `Plan`, `Tasks`, `Implement`) when a workflow definition is
 *   provided, falling back to `Approve` / `Complete`.
 * - `Archive` and `Mark Completed` are gated by `isSpecDone(ctx)` so
 *   they only surface once the spec has reached the closure-eligible
 *   stages (`ready-to-implement` / `implementing` / `completed`). The
 *   user never sees them while a step is mid-generation.
 * - The legacy `Start` action is structurally unreachable — the viewer
 *   only opens after a step has been initiated.
 */

import {
    FooterAction,
    SpecContext,
    StepHistoryEntry,
    StepName,
    STEP_NAMES,
} from '../../core/types/specContext';
import { SpecStatuses, FooterActionIds } from '../../core/constants';
import { deriveStepHistory } from '../specs/stepHistoryDerivation';
import { isStepLevelEntry } from '../specs/historyHelpers';
import type { WorkflowStepConfig } from '../workflows/types';

type DerivedHistory = Record<string, StepHistoryEntry>;

const SCOPE_SUFFIX: Record<'spec' | 'step', string> = {
    spec: 'Affects whole spec',
    step: 'Affects this step',
};

export function withScopeSuffix(a: FooterAction): string {
    return `${a.tooltip} (${SCOPE_SUFFIX[a.scope]})`;
}

/** Spec is in a terminal state — no step-scoped actions should surface. */
function isTerminal(status: string | undefined): boolean {
    return status === SpecStatuses.COMPLETED || status === SpecStatuses.ARCHIVED;
}

/**
 * True once the spec has reached a closure-eligible stage. Tightened
 * to just `implemented` + `completed`: while the AI is still creating
 * tasks or building (`tasks-created`, `implementing`), the footer
 * stays focused on the forward action and the sidebar's per-row
 * Archive remains the escape hatch. `Mark Completed` and `Archive`
 * only appear once the build is done and the user is at the final
 * approval gate.
 */
function isSpecDone(ctx: SpecContext): boolean {
    return (
        ctx.status === 'implemented' ||
        ctx.status === SpecStatuses.COMPLETED
    );
}

/**
 * Decide whether `Approve` should surface for `step`.
 *
 * Visible when:
 * - the step has been started, AND
 * - no later step is ahead of this one in `history[]` order (the
 *   workflow has not moved past this tab — see `laterStepIsAhead`), AND
 * - either the step is in flight (no `completedAt`) OR there's still
 *   a later step in the workflow to advance to.
 *
 * The "later step exists" check is what hides `Approve` once the
 * final step (`implement`) has its `completedAt` — at that point the
 * spec-scope `Mark Completed` is the right surface, not Approve.
 */
/**
 * Ordered step names for the active workflow. Lifecycle steps always resolve
 * against the canonical `STEP_NAMES` so the spec-kit / Companion paths are
 * byte-for-byte unchanged. Only a genuinely custom step name (one not in
 * `STEP_NAMES`, e.g. `tickets`) falls back to the custom
 * workflow's own declared order so "is there a later step" is answered from
 * the workflow, not the lifecycle.
 */
function stepOrder(
    step: StepName,
    workflowSteps: WorkflowStepConfig[] | undefined
): string[] {
    if (STEP_NAMES.includes(step) || !workflowSteps) {
        return STEP_NAMES;
    }
    return workflowSteps.map(s => s.name);
}

function shouldShowApprove(
    ctx: SpecContext,
    step: StepName,
    stepHistory: DerivedHistory,
    workflowSteps?: WorkflowStepConfig[]
): boolean {
    // Implement step closure is owned by `Mark Completed` (gated on
    // `isSpecDone(ctx)`). Approve here would surface a duplicate
    // "Complete" button the moment every task box gets ticked, before
    // status actually flips to `implemented`.
    if (step === 'implement') return false;
    // Approve must target the spec's actual current step. When the user
    // navigates backward via the stepper, dispatching the next step from
    // a past tab would re-run already-completed phases.
    if (step !== ctx.currentStep) return false;
    const entry = stepHistory[step];
    if (!entry?.startedAt) return false;
    const order = stepOrder(step, workflowSteps);
    const idx = order.indexOf(step);
    if (idx < 0) return false;
    if (laterStepIsAhead(ctx, step, idx, stepHistory, order)) return false;
    // Step in flight → always show.
    if (!entry.completedAt) return true;
    // Step is done → only show if there's a later step left to dispatch.
    return idx < order.length - 1;
}

/**
 * "Has the workflow moved past this tab?" — a later step blocks Approve only
 * when its activity is newer than the current step's latest step-level boundary
 * in the append-only `history[]`. A dangling start left by an interrupted run
 * that the user rolled back via force-status precedes that boundary, so
 * it no longer strands the forward button. Contexts without a usable history
 * fall back to the historical "any later step ever started" rule.
 */
function laterStepIsAhead(
    ctx: SpecContext,
    step: StepName,
    idx: number,
    stepHistory: DerivedHistory,
    order: string[] = STEP_NAMES
): boolean {
    const history = ctx.history ?? [];
    if (history.length === 0) {
        for (let i = idx + 1; i < order.length; i++) {
            if (stepHistory[order[i]]?.startedAt) return true;
        }
        return false;
    }
    let lastOwnIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (e.step === step && isStepLevelEntry(e)) {
            lastOwnIdx = i;
            break;
        }
    }
    for (let j = history.length - 1; j > lastOwnIdx; j--) {
        const jIdx = order.indexOf(history[j].step as string);
        if (jIdx > idx) return true;
    }
    return false;
}

/**
 * Resolve the visible label for the `Approve` action based on the active
 * workflow's step ordering. Returns the next step's label, or `Complete`
 * for the final step, or `Approve` if the workflow definition is missing.
 */
export function getApproveLabel(
    currentStep: StepName,
    workflowSteps: WorkflowStepConfig[] | undefined
): string {
    if (!workflowSteps || workflowSteps.length === 0) return 'Approve';
    const idx = workflowSteps.findIndex(s => s.name === currentStep);
    if (idx < 0) return 'Approve';
    const next = workflowSteps[idx + 1];
    if (!next) return 'Complete';
    return next.label ?? capitalize(next.name);
}

function capitalize(s: string): string {
    return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

export const FOOTER_ACTIONS: FooterAction[] = [
    {
        id: FooterActionIds.ARCHIVE,
        label: 'Archive',
        scope: 'spec',
        tooltip: 'Archive this spec',
        visibleWhen: (ctx) =>
            ctx.status !== SpecStatuses.ARCHIVED && isSpecDone(ctx),
    },
    {
        id: FooterActionIds.REACTIVATE,
        label: 'Reactivate',
        scope: 'spec',
        tooltip: 'Reactivate archived spec',
        visibleWhen: (ctx) =>
            ctx.status === SpecStatuses.ARCHIVED || ctx.status === SpecStatuses.COMPLETED,
    },
    {
        id: FooterActionIds.COMPLETE,
        label: 'Mark Completed',
        scope: 'spec',
        tooltip: 'Mark this spec as completed',
        visibleWhen: (ctx) => !isTerminal(ctx.status) && isSpecDone(ctx),
    },
    {
        id: FooterActionIds.REGENERATE,
        label: 'Regenerate',
        scope: 'step',
        tooltip: 'Re-run only the current step',
        visibleWhen: (ctx, step, stepHistory) => {
            if (isTerminal(ctx.status)) return false;
            const entry = stepHistory[step];
            return !!entry?.startedAt;
        },
    },
    {
        id: FooterActionIds.APPROVE,
        label: 'Approve',
        scope: 'step',
        tooltip: 'Approve this step and continue',
        visibleWhen: (ctx, step, stepHistory, workflowSteps) => {
            if (isTerminal(ctx.status)) return false;
            return shouldShowApprove(
                ctx, step, stepHistory,
                workflowSteps as WorkflowStepConfig[] | undefined
            );
        },
    },
];

export function getFooterActions(
    ctx: SpecContext,
    step: StepName,
    workflowSteps?: WorkflowStepConfig[],
    stepHistory: DerivedHistory = deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status)
): FooterAction[] {
    const visible = FOOTER_ACTIONS.filter(a => a.visibleWhen(ctx, step, stepHistory, workflowSteps));
    return visible.map(a =>
        a.id === FooterActionIds.APPROVE
            ? { ...a, label: getApproveLabel(step, workflowSteps) }
            : a
    );
}
