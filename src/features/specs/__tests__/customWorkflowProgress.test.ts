import {
    isCustomWorkflow,
    synthesizeCustomProgress,
} from '../customWorkflowProgress';
import { getFooterActions } from '../../spec-viewer/footerActions';
import { FooterActionIds } from '../../../core/constants';
import type { SpecContext, StepName } from '../../../core/types/specContext';
import type { WorkflowStepConfig } from '../../workflows/types';

// Matt Pocock-style custom workflow: spec → tickets → implement(actionOnly),
// with non-lifecycle step name "tickets".
const MATT_STEPS: WorkflowStepConfig[] = [
    { name: 'specify', command: 'to-spec', file: 'spec.md' },
    { name: 'tickets', command: 'to-tickets', file: 'tickets.md', subDir: 'issues' },
    { name: 'implement', command: 'implement', actionOnly: true },
];

// Built-in lifecycle workflow (all lifecycle names).
const LIFECYCLE_STEPS: WorkflowStepConfig[] = [
    { name: 'specify', command: 'speckit.specify', file: 'spec.md' },
    { name: 'plan', command: 'speckit.plan', file: 'plan.md' },
    { name: 'tasks', command: 'speckit.tasks', file: 'tasks.md' },
    { name: 'implement', command: 'speckit.implement', actionOnly: true },
];

const stubCtx = (): SpecContext => ({
    workflow: 'matt-skills',
    specName: 'todo-priority-levels',
    branch: 'todo-priority-levels',
    currentStep: 'specify' as StepName,
    status: 'draft',
    history: [],
} as SpecContext);

const hasFooter = (ctx: SpecContext, step: StepName, steps: WorkflowStepConfig[], id: string) =>
    getFooterActions(ctx, step, steps).some(a => a.id === id);

describe('isCustomWorkflow', () => {
    it('is true when a nav step name is not a lifecycle step', () => {
        expect(isCustomWorkflow(MATT_STEPS)).toBe(true);
    });
    it('is false for an all-lifecycle workflow', () => {
        expect(isCustomWorkflow(LIFECYCLE_STEPS)).toBe(false);
    });
    it('is false for undefined', () => {
        expect(isCustomWorkflow(undefined)).toBe(false);
    });
});

describe('synthesizeCustomProgress', () => {
    it('leaves a lifecycle workflow untouched', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, LIFECYCLE_STEPS, () => true);
        expect(out).toBe(ctx);
    });

    it('leaves a custom workflow untouched when real history exists', () => {
        const ctx = {
            ...stubCtx(),
            history: [{ step: 'specify', substep: null, kind: 'start', by: 'ai', at: 'x' }],
        } as SpecContext;
        const out = synthesizeCustomProgress(ctx, MATT_STEPS, () => true);
        expect(out).toBe(ctx);
    });

    it('stays at specify when only spec.md exists', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, MATT_STEPS, s => s.name === 'specify');
        expect(out.currentStep).toBe('specify');
        // specify in flight → Approve shows, labeled with the next step
        expect(hasFooter(out, 'specify' as StepName, MATT_STEPS, FooterActionIds.APPROVE)).toBe(true);
        expect(getFooterActions(out, 'specify' as StepName, MATT_STEPS)
            .find(a => a.id === FooterActionIds.APPROVE)?.label).toBe('Tickets');
    });

    it('advances currentStep to tickets once issues/ exists, and Approve targets Implement', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, MATT_STEPS,
            s => s.name === 'specify' || s.name === 'tickets');
        expect(out.currentStep).toBe('tickets');
        // The custom step "tickets" (not in STEP_NAMES) must still surface Approve,
        // labeled with the next workflow step — this is the regression the fix targets.
        expect(hasFooter(out, 'tickets' as StepName, MATT_STEPS, FooterActionIds.APPROVE)).toBe(true);
        expect(getFooterActions(out, 'tickets' as StepName, MATT_STEPS)
            .find(a => a.id === FooterActionIds.APPROVE)?.label).toBe('Implement');
    });

    it('returns ctx unchanged when nothing has been produced yet', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, MATT_STEPS, () => false);
        expect(out).toBe(ctx);
    });

    it('passes null through', () => {
        expect(synthesizeCustomProgress(null, MATT_STEPS, () => true)).toBeNull();
    });
});
