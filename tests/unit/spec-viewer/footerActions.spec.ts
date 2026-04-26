import {
    getFooterActions,
    withScopeSuffix,
    FOOTER_ACTIONS,
} from '../../../src/features/spec-viewer/footerActions';
import { SpecContext } from '../../../src/core/types/specContext';
import {
    SpecStatuses,
    Workflows,
    FooterActionIds,
    WorkflowSteps,
} from '../../../src/core/constants';

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

    it('SDD Auto only visible on Specify during draft/specifying for sdd/sdd-fast', () => {
        const ctx = baseCtx({ workflow: Workflows.SDD, status: 'draft' });
        const actions = getFooterActions(ctx, WorkflowSteps.SPECIFY);
        expect(actions.find(a => a.id === FooterActionIds.SDD_AUTO)).toBeDefined();

        // Wrong step → hidden
        expect(
            getFooterActions(ctx, WorkflowSteps.PLAN).find(a => a.id === FooterActionIds.SDD_AUTO)
        ).toBeUndefined();

        // Wrong status → hidden
        expect(
            getFooterActions(
                baseCtx({ workflow: Workflows.SDD, status: 'planning' }),
                WorkflowSteps.SPECIFY
            ).find(a => a.id === FooterActionIds.SDD_AUTO)
        ).toBeUndefined();

        // Wrong workflow → hidden
        expect(
            getFooterActions(
                baseCtx({ workflow: Workflows.SPECKIT_COMPANION, status: 'draft' }),
                WorkflowSteps.SPECIFY
            ).find(a => a.id === FooterActionIds.SDD_AUTO)
        ).toBeUndefined();
    });

    it('Regenerate hidden when step has no startedAt (acceptance 4)', () => {
        const ctx = baseCtx();
        const actions = getFooterActions(ctx, WorkflowSteps.PLAN);
        expect(actions.find(a => a.id === FooterActionIds.REGENERATE)).toBeUndefined();
        expect(actions.find(a => a.id === FooterActionIds.START)).toBeDefined();
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
        expect(ids).not.toContain(FooterActionIds.START);
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
        expect(ids).not.toContain(FooterActionIds.START);
        expect(ids).not.toContain(FooterActionIds.REGENERATE);
        expect(ids).not.toContain(FooterActionIds.APPROVE);
        expect(ids).toContain(FooterActionIds.REACTIVATE);
    });
});
