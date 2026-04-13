/**
 * Footer action catalog with scope metadata and visibility rules.
 *
 * - Every action declares `scope: 'spec' | 'step'` (FR-009).
 * - Tooltips are auto-suffixed with a scope phrase at render time.
 * - SDD `Auto` is only visible on the Specify tab during `draft`/`specifying`
 *   for `sdd`/`sdd-fast` workflows (FR-010).
 */

import { FooterAction, SpecContext, StepName } from '../../core/types/specContext';

const SCOPE_SUFFIX: Record<'spec' | 'step', string> = {
    spec: 'Affects whole spec',
    step: 'Affects this step',
};

export function withScopeSuffix(a: FooterAction): string {
    return `${a.tooltip} (${SCOPE_SUFFIX[a.scope]})`;
}

export const FOOTER_ACTIONS: FooterAction[] = [
    {
        id: 'archive',
        label: 'Archive',
        scope: 'spec',
        tooltip: 'Archive this spec',
        visibleWhen: (ctx) => ctx.status !== 'archived',
    },
    {
        id: 'reactivate',
        label: 'Reactivate',
        scope: 'spec',
        tooltip: 'Reactivate archived spec',
        visibleWhen: (ctx) => ctx.status === 'archived' || ctx.status === 'completed',
    },
    {
        id: 'complete',
        label: 'Mark Completed',
        scope: 'spec',
        tooltip: 'Mark this spec as completed',
        visibleWhen: (ctx) =>
            ctx.status !== 'completed' && ctx.status !== 'archived',
    },
    {
        id: 'start',
        label: 'Start',
        scope: 'step',
        tooltip: 'Start this step',
        visibleWhen: (ctx, step) => {
            const entry = ctx.stepHistory[step];
            return !entry?.startedAt;
        },
    },
    {
        id: 'regenerate',
        label: 'Regenerate',
        scope: 'step',
        tooltip: 'Re-run only the current step',
        visibleWhen: (ctx, step) => {
            const entry = ctx.stepHistory[step];
            return !!entry?.startedAt;
        },
    },
    {
        id: 'approve',
        label: 'Approve',
        scope: 'step',
        tooltip: 'Approve this step and continue',
        visibleWhen: (ctx, step) => {
            const entry = ctx.stepHistory[step];
            return !!entry?.startedAt && !entry?.completedAt;
        },
    },
    {
        id: 'sdd-auto',
        label: 'Auto',
        scope: 'spec',
        tooltip: 'Run the full SDD pipeline automatically',
        visibleWhen: (ctx, step) =>
            (ctx.workflow === 'sdd' || ctx.workflow === 'sdd-fast') &&
            step === 'specify' &&
            (ctx.status === 'draft' || ctx.status === 'specifying'),
    },
];

export function getFooterActions(
    ctx: SpecContext,
    step: StepName
): FooterAction[] {
    return FOOTER_ACTIONS.filter(a => a.visibleWhen(ctx, step));
}
