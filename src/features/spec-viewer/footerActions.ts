/**
 * Footer action catalog with scope metadata and visibility rules.
 *
 * - Every action declares `scope: 'spec' | 'step'` (FR-009).
 * - Tooltips are auto-suffixed with a scope phrase at render time.
 * - SDD `Auto` is only visible on the Specify tab during `draft`/`specifying`
 *   for `sdd`/`sdd-fast` workflows (FR-010).
 */

import { FooterAction, SpecContext, StepName } from '../../core/types/specContext';
import { isStepCompleted } from './stateDerivation';
import {
    SpecStatuses,
    APPROVAL_GATED_WORKFLOWS,
    FooterActionIds,
    WorkflowSteps,
} from '../../core/constants';

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

export const FOOTER_ACTIONS: FooterAction[] = [
    {
        id: FooterActionIds.ARCHIVE,
        label: 'Archive',
        scope: 'spec',
        tooltip: 'Archive this spec',
        visibleWhen: (ctx) => ctx.status !== SpecStatuses.ARCHIVED,
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
        visibleWhen: (ctx) => !isTerminal(ctx.status),
    },
    {
        id: FooterActionIds.START,
        label: 'Start',
        scope: 'step',
        tooltip: 'Start this step',
        visibleWhen: (ctx, step) => {
            if (isTerminal(ctx.status)) return false;
            const entry = ctx.stepHistory[step];
            return !entry?.startedAt;
        },
    },
    {
        id: FooterActionIds.REGENERATE,
        label: 'Regenerate',
        scope: 'step',
        tooltip: 'Re-run only the current step',
        visibleWhen: (ctx, step) => {
            if (isTerminal(ctx.status)) return false;
            const entry = ctx.stepHistory[step];
            return !!entry?.startedAt;
        },
    },
    {
        id: FooterActionIds.APPROVE,
        label: 'Approve',
        scope: 'step',
        tooltip: 'Approve this step and continue',
        visibleWhen: (ctx, step) => {
            if (isTerminal(ctx.status)) return false;
            const entry = ctx.stepHistory[step];
            return !!entry?.startedAt && !isStepCompleted(step, ctx.currentStep, ctx.stepHistory);
        },
    },
    {
        id: FooterActionIds.SDD_AUTO,
        label: 'Auto',
        scope: 'spec',
        tooltip: 'Run the full SDD pipeline automatically',
        visibleWhen: (ctx, step) =>
            APPROVAL_GATED_WORKFLOWS.includes(ctx.workflow) &&
            step === WorkflowSteps.SPECIFY &&
            (ctx.status === 'draft' || ctx.status === 'specifying'),
    },
];

export function getFooterActions(
    ctx: SpecContext,
    step: StepName
): FooterAction[] {
    return FOOTER_ACTIONS.filter(a => a.visibleWhen(ctx, step));
}
