import {
    getFooterActions,
    withScopeSuffix,
    FOOTER_ACTIONS,
} from '../../../src/features/spec-viewer/footerActions';
import { SpecContext } from '../../../src/core/types/specContext';

function baseCtx(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit-companion',
        specName: 't',
        branch: 'main',
        currentStep: 'specify',
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
        const ctx = baseCtx({ workflow: 'sdd', status: 'draft' });
        const actions = getFooterActions(ctx, 'specify');
        expect(actions.find(a => a.id === 'sdd-auto')).toBeDefined();

        // Wrong step → hidden
        expect(
            getFooterActions(ctx, 'plan').find(a => a.id === 'sdd-auto')
        ).toBeUndefined();

        // Wrong status → hidden
        expect(
            getFooterActions(
                baseCtx({ workflow: 'sdd', status: 'planning' }),
                'specify'
            ).find(a => a.id === 'sdd-auto')
        ).toBeUndefined();

        // Wrong workflow → hidden
        expect(
            getFooterActions(
                baseCtx({ workflow: 'speckit-companion', status: 'draft' }),
                'specify'
            ).find(a => a.id === 'sdd-auto')
        ).toBeUndefined();
    });

    it('Regenerate hidden when step has no startedAt (acceptance 4)', () => {
        const ctx = baseCtx();
        const actions = getFooterActions(ctx, 'plan');
        expect(actions.find(a => a.id === 'regenerate')).toBeUndefined();
        expect(actions.find(a => a.id === 'start')).toBeDefined();
    });

    it('Regenerate visible once step has been started', () => {
        const ctx = baseCtx({
            stepHistory: { plan: { startedAt: 'a', completedAt: null } },
        });
        const actions = getFooterActions(ctx, 'plan');
        expect(actions.find(a => a.id === 'regenerate')).toBeDefined();
    });

    it('tooltip suffix naming is correct for spec vs step scope', () => {
        const archive = FOOTER_ACTIONS.find(a => a.id === 'archive')!;
        const regen = FOOTER_ACTIONS.find(a => a.id === 'regenerate')!;
        expect(withScopeSuffix(archive)).toMatch(/whole spec/);
        expect(withScopeSuffix(regen)).toMatch(/this step/);
    });
});
