import {
    getFooterActions,
    getApproveLabel,
    withScopeSuffix,
    FOOTER_ACTIONS,
} from '../../../src/features/spec-viewer/footerActions';
import { SpecContext } from '../../../src/core/types/specContext';
import type { WorkflowStepConfig } from '../../../src/features/workflows/types';
import {
    SpecStatuses,
    Workflows,
    FooterActionIds,
    WorkflowSteps,
} from '../../../src/core/constants';

const SDD_STEPS: WorkflowStepConfig[] = [
    { name: 'specify', label: 'Specification', command: 'sdd:specify', file: 'spec.md' },
    { name: 'plan', label: 'Plan', command: 'sdd:plan', file: 'plan.md' },
    { name: 'tasks', label: 'Tasks', command: 'sdd:tasks', file: 'tasks.md' },
    { name: 'implement', label: 'Implement', command: 'sdd:implement', actionOnly: true },
];

function baseCtx(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: Workflows.SPECKIT_COMPANION,
        specName: 't',
        branch: 'main',
        currentStep: WorkflowSteps.SPECIFY,
        status: 'draft',
        stepHistory: {},
        transitions: [],
        ...overrides,
    };
}

describe('getFooterActions (US6 — scope + visibility)', () => {
    it('all actions carry scope metadata and tooltip states scope', () => {
        for (const a of FOOTER_ACTIONS) {
            expect(a.scope === 'spec' || a.scope === 'step').toBe(true);
            const t = withScopeSuffix(a);
            expect(t).toMatch(/Affects whole spec|Affects this step/);
        }
    });

    it('Start and SDD Auto are no longer part of the footer catalog', () => {
        const ids = FOOTER_ACTIONS.map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.START);
        expect(ids).not.toContain(FooterActionIds.SDD_AUTO);
    });

    it('Regenerate hidden when step has no startedAt (acceptance 4)', () => {
        const ctx = baseCtx();
        const actions = getFooterActions(ctx, WorkflowSteps.PLAN);
        expect(actions.find(a => a.id === FooterActionIds.REGENERATE)).toBeUndefined();
    });

    it('Regenerate visible once step has been started', () => {
        const ctx = baseCtx({
            stepHistory: { plan: { startedAt: 'a', completedAt: null } },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.PLAN);
        expect(actions.find(a => a.id === FooterActionIds.REGENERATE)).toBeDefined();
    });

    it('tooltip suffix naming is correct for spec vs step scope', () => {
        const archive = FOOTER_ACTIONS.find(a => a.id === FooterActionIds.ARCHIVE)!;
        const regen = FOOTER_ACTIONS.find(a => a.id === FooterActionIds.REGENERATE)!;
        expect(withScopeSuffix(archive)).toMatch(/whole spec/);
        expect(withScopeSuffix(regen)).toMatch(/this step/);
    });

    it('step-scoped actions hidden when spec is completed', () => {
        const ctx = baseCtx({
            status: SpecStatuses.COMPLETED,
            currentStep: WorkflowSteps.TASKS,
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'a', completedAt: 'b' },
                tasks: { startedAt: 'a', completedAt: null },
            },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.TASKS);
        const ids = actions.map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.REGENERATE);
        expect(ids).not.toContain(FooterActionIds.APPROVE);
        // Spec-scoped actions still apply for terminal-state lifecycle.
        expect(ids).toContain(FooterActionIds.REACTIVATE);
    });

    it('step-scoped actions hidden when spec is archived', () => {
        const ctx = baseCtx({
            status: SpecStatuses.ARCHIVED,
            currentStep: WorkflowSteps.TASKS,
            stepHistory: { tasks: { startedAt: 'a', completedAt: null } },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.TASKS);
        const ids = actions.map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.REGENERATE);
        expect(ids).not.toContain(FooterActionIds.APPROVE);
        expect(ids).toContain(FooterActionIds.REACTIVATE);
    });
});

describe('isSpecDone gate — Archive / Mark Completed visibility', () => {
    // Below the closure-eligible threshold: Archive and Mark Completed
    // must stay hidden so the footer stays focused on the forward
    // action while the AI is still building.
    const NOT_DONE_STATUSES: SpecContext['status'][] = [
        'draft',
        'specifying',
        'specified',
        'planning',
        'planned',
        'tasking',
        'ready-to-implement',
        'implementing',
    ];

    for (const status of NOT_DONE_STATUSES) {
        it(`hides Archive and Mark Completed when status='${status}'`, () => {
            const ctx = baseCtx({
                workflow: Workflows.SDD,
                status,
                currentStep: WorkflowSteps.SPECIFY,
            });
            const ids = getFooterActions(ctx, WorkflowSteps.SPECIFY).map(a => a.id);
            expect(ids).not.toContain(FooterActionIds.ARCHIVE);
            expect(ids).not.toContain(FooterActionIds.COMPLETE);
        });
    }

    it("shows Archive and Mark Completed when status='implemented' (final approval gate)", () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'implemented',
            currentStep: WorkflowSteps.IMPLEMENT,
            stepHistory: {
                implement: { startedAt: 'a', completedAt: 'b' },
            },
        });
        const ids = getFooterActions(ctx, WorkflowSteps.IMPLEMENT).map(a => a.id);
        expect(ids).toContain(FooterActionIds.ARCHIVE);
        expect(ids).toContain(FooterActionIds.COMPLETE);
    });

    it("shows Archive, Mark Completed, and Regenerate when status='implemented'", () => {
        // After the AI finishes the implement step, status moves to
        // 'implemented' (not directly to 'completed'). The user sees:
        // - Archive / Mark Completed (closure-eligible),
        // - Regenerate (still useful — user can ask the AI to redo the
        //   implementation if they don't like it),
        // - Approve is hidden because the step is completed (no further
        //   step to advance to in the workflow).
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'implemented',
            currentStep: WorkflowSteps.IMPLEMENT,
            stepHistory: {
                implement: { startedAt: 'a', completedAt: 'b' },
            },
        });
        const ids = getFooterActions(ctx, WorkflowSteps.IMPLEMENT).map(a => a.id);
        expect(ids).toContain(FooterActionIds.ARCHIVE);
        expect(ids).toContain(FooterActionIds.COMPLETE);
        expect(ids).toContain(FooterActionIds.REGENERATE);
        expect(ids).not.toContain(FooterActionIds.APPROVE);
    });

    it("shows Archive but hides Mark Completed when status='completed' (terminal)", () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: SpecStatuses.COMPLETED,
            currentStep: WorkflowSteps.IMPLEMENT,
        });
        const ids = getFooterActions(ctx, WorkflowSteps.IMPLEMENT).map(a => a.id);
        expect(ids).toContain(FooterActionIds.ARCHIVE);
        // Mark Completed hides because the spec is already terminal-completed.
        expect(ids).not.toContain(FooterActionIds.COMPLETE);
    });

    it('keeps Archive hidden when archived (already in terminal-archived)', () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: SpecStatuses.ARCHIVED,
            currentStep: WorkflowSteps.IMPLEMENT,
        });
        const ids = getFooterActions(ctx, WorkflowSteps.IMPLEMENT).map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.ARCHIVE);
    });
});

describe('Approve advance button across the lifecycle', () => {
    // After spec 094 second pass: the Approve action stays visible at
    // the "step done, next step not started" pauses so the user can
    // dispatch the next phase from the viewer footer.

    it("stays visible at status='specified' so user can click Plan", () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'specified',
            currentStep: WorkflowSteps.SPECIFY,
            stepHistory: { specify: { startedAt: 'a', completedAt: 'b' } },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.SPECIFY, SDD_STEPS);
        const approve = actions.find(a => a.id === FooterActionIds.APPROVE);
        expect(approve).toBeDefined();
        expect(approve!.label).toBe('Plan');
    });

    it("stays visible at status='planned' so user can click Tasks", () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'planned',
            currentStep: WorkflowSteps.PLAN,
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'c', completedAt: 'd' },
            },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.PLAN, SDD_STEPS);
        const approve = actions.find(a => a.id === FooterActionIds.APPROVE);
        expect(approve).toBeDefined();
        expect(approve!.label).toBe('Tasks');
    });

    it("stays visible at status='ready-to-implement' so user can click Implement", () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'ready-to-implement',
            currentStep: WorkflowSteps.TASKS,
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'c', completedAt: 'd' },
                tasks: { startedAt: 'e', completedAt: 'f' },
            },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.TASKS, SDD_STEPS);
        const approve = actions.find(a => a.id === FooterActionIds.APPROVE);
        expect(approve).toBeDefined();
        expect(approve!.label).toBe('Implement');
    });

    it("hides at status='implemented' (last step done, no later step exists)", () => {
        // Implement is the final step; there's no later step to advance
        // to. Mark Completed is the right surface here, not Approve.
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'implemented',
            currentStep: WorkflowSteps.IMPLEMENT,
            stepHistory: {
                implement: { startedAt: 'a', completedAt: 'b' },
            },
        });
        const ids = getFooterActions(ctx, WorkflowSteps.IMPLEMENT, SDD_STEPS).map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.APPROVE);
    });

    it('hides on the specify tab once a later step has started', () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'planning',
            currentStep: WorkflowSteps.PLAN,
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'c', completedAt: null },
            },
        });
        // Viewing the SPECIFY tab while the workflow has moved into PLAN.
        const ids = getFooterActions(ctx, WorkflowSteps.SPECIFY, SDD_STEPS).map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.APPROVE);
    });
});

describe('In-flight footer (the screenshot scenario)', () => {
    it('reproduces the user-reported screenshot: only Regenerate + dynamic Approve', () => {
        // After /sdd:specify runs: status=specifying, specify.startedAt set,
        // completedAt=null. Footer must NOT show Edit Source (removed
        // entirely), Archive, Mark Completed, Auto, or Start.
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'specifying',
            currentStep: WorkflowSteps.SPECIFY,
            stepHistory: { specify: { startedAt: 'a', completedAt: null } },
        });
        const ids = getFooterActions(ctx, WorkflowSteps.SPECIFY, SDD_STEPS).map(a => a.id);
        expect(ids).not.toContain(FooterActionIds.ARCHIVE);
        expect(ids).not.toContain(FooterActionIds.COMPLETE);
        expect(ids).not.toContain(FooterActionIds.START);
        expect(ids).not.toContain(FooterActionIds.SDD_AUTO);
        expect(ids).toContain(FooterActionIds.REGENERATE);
        expect(ids).toContain(FooterActionIds.APPROVE);
    });

    it('on plan tab while planning: Regenerate + Approve labelled "Tasks"', () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'planning',
            currentStep: WorkflowSteps.PLAN,
            stepHistory: {
                specify: { startedAt: 'a', completedAt: 'b' },
                plan: { startedAt: 'c', completedAt: null },
            },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.PLAN, SDD_STEPS);
        const approve = actions.find(a => a.id === FooterActionIds.APPROVE);
        expect(approve!.label).toBe('Tasks');
        expect(actions.map(a => a.id)).not.toContain(FooterActionIds.ARCHIVE);
    });

    it('pure draft (no startedAt) renders no buttons at all', () => {
        // The viewer never realistically opens at status=draft with empty
        // stepHistory, but if it did the footer would be empty: Edit Source
        // is gone, Start/Auto are removed, Archive/Mark Completed are gated
        // out, Regenerate needs startedAt, Approve needs startedAt too.
        const ctx = baseCtx({ workflow: Workflows.SDD, status: 'draft' });
        const ids = getFooterActions(ctx, WorkflowSteps.SPECIFY).map(a => a.id);
        expect(ids).toEqual([]);
    });
});

describe('getApproveLabel', () => {
    it('returns next step label when one exists', () => {
        expect(getApproveLabel('specify', SDD_STEPS)).toBe('Plan');
        expect(getApproveLabel('plan', SDD_STEPS)).toBe('Tasks');
        expect(getApproveLabel('tasks', SDD_STEPS)).toBe('Implement');
    });

    it('returns "Complete" for the final step', () => {
        expect(getApproveLabel('implement', SDD_STEPS)).toBe('Complete');
    });

    it('falls back to "Approve" when no workflow steps provided', () => {
        expect(getApproveLabel('specify', undefined)).toBe('Approve');
        expect(getApproveLabel('specify', [])).toBe('Approve');
    });

    it('falls back to "Approve" when current step is not in workflow', () => {
        expect(getApproveLabel('clarify', SDD_STEPS)).toBe('Approve');
    });

    it('uses capitalized step name when label is missing', () => {
        const stepsNoLabel: WorkflowStepConfig[] = [
            { name: 'specify', command: 'x' },
            { name: 'plan', command: 'y' },
        ];
        expect(getApproveLabel('specify', stepsNoLabel)).toBe('Plan');
    });
});

describe('getFooterActions Approve label is dynamic', () => {
    it('relabels Approve to next step name when workflow steps are passed', () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'specifying',
            currentStep: WorkflowSteps.SPECIFY,
            stepHistory: { specify: { startedAt: 'a', completedAt: null } },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.SPECIFY, SDD_STEPS);
        const approve = actions.find(a => a.id === FooterActionIds.APPROVE);
        expect(approve).toBeDefined();
        expect(approve!.label).toBe('Plan');
    });

    it('keeps default "Approve" label when no workflow steps are passed', () => {
        const ctx = baseCtx({
            workflow: Workflows.SDD,
            status: 'specifying',
            currentStep: WorkflowSteps.SPECIFY,
            stepHistory: { specify: { startedAt: 'a', completedAt: null } },
        });
        const actions = getFooterActions(ctx, WorkflowSteps.SPECIFY);
        const approve = actions.find(a => a.id === FooterActionIds.APPROVE);
        expect(approve!.label).toBe('Approve');
    });
});
