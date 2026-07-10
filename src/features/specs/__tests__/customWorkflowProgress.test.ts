import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    isCustomWorkflow,
    synthesizeCustomProgress,
    stepHasOutput,
} from '../customWorkflowProgress';
import { getFooterActions } from '../../spec-viewer/footerActions';
import { FooterActionIds } from '../../../core/constants';
import type { SpecContext, StepName } from '../../../core/types/specContext';
import type { WorkflowStepConfig } from '../../workflows/types';

// Ticket-based custom workflow: spec → tickets → implement(actionOnly),
// with the non-lifecycle step name "tickets".
const TICKET_WORKFLOW_STEPS: WorkflowStepConfig[] = [
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
    workflow: 'ticket-flow',
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
        expect(isCustomWorkflow(TICKET_WORKFLOW_STEPS)).toBe(true);
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

    it('advances past a lone lifecycle-bookkeeping entry when disk is ahead', () => {
        // The extension's forward button wrote `specify complete`, but the
        // third-party command produced the tickets it never recorded. History
        // is non-empty yet the context is behind the files — must still advance.
        const ctx = {
            ...stubCtx(),
            currentStep: 'specify' as StepName,
            status: 'specified',
            history: [{ step: 'specify', substep: null, kind: 'complete', by: 'extension', at: 'x' }],
        } as unknown as SpecContext;
        const out = synthesizeCustomProgress(ctx, TICKET_WORKFLOW_STEPS,
            s => s.name === 'specify' || s.name === 'tickets');
        expect(out.currentStep).toBe('tickets');
        expect(getFooterActions(out, 'tickets' as StepName, TICKET_WORKFLOW_STEPS)
            .find(a => a.id === FooterActionIds.APPROVE)?.label).toBe('Implement');
    });

    it('does not regress when the context is already caught up with disk', () => {
        const ctx = {
            ...stubCtx(),
            currentStep: 'tickets' as StepName,
            history: [{ step: 'tickets', substep: null, kind: 'complete', by: 'ai', at: 'x' }],
        } as unknown as SpecContext;
        // disk shows the same furthest step (tickets) — leave the real ctx alone
        const out = synthesizeCustomProgress(ctx, TICKET_WORKFLOW_STEPS,
            s => s.name === 'specify' || s.name === 'tickets');
        expect(out).toBe(ctx);
    });

    it('stays at specify when only spec.md exists', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, TICKET_WORKFLOW_STEPS, s => s.name === 'specify');
        expect(out.currentStep).toBe('specify');
        // specify in flight → Approve shows, labeled with the next step
        expect(hasFooter(out, 'specify' as StepName, TICKET_WORKFLOW_STEPS, FooterActionIds.APPROVE)).toBe(true);
        expect(getFooterActions(out, 'specify' as StepName, TICKET_WORKFLOW_STEPS)
            .find(a => a.id === FooterActionIds.APPROVE)?.label).toBe('Tickets');
    });

    it('advances currentStep to tickets once issues/ exists, and Approve targets Implement', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, TICKET_WORKFLOW_STEPS,
            s => s.name === 'specify' || s.name === 'tickets');
        expect(out.currentStep).toBe('tickets');
        // The custom step "tickets" (not in STEP_NAMES) must still surface Approve,
        // labeled with the next workflow step — this is the regression the fix targets.
        expect(hasFooter(out, 'tickets' as StepName, TICKET_WORKFLOW_STEPS, FooterActionIds.APPROVE)).toBe(true);
        expect(getFooterActions(out, 'tickets' as StepName, TICKET_WORKFLOW_STEPS)
            .find(a => a.id === FooterActionIds.APPROVE)?.label).toBe('Implement');
    });

    it('returns ctx unchanged when nothing has been produced yet', () => {
        const ctx = stubCtx();
        const out = synthesizeCustomProgress(ctx, TICKET_WORKFLOW_STEPS, () => false);
        expect(out).toBe(ctx);
    });

    it('passes null through', () => {
        expect(synthesizeCustomProgress(null, TICKET_WORKFLOW_STEPS, () => true)).toBeNull();
    });
});

describe('stepHasOutput', () => {
    // GSD-shaped workflow: the plan step names no `file` and relies on
    // includeRelatedDocs, because `gsd-plan-phase` writes `NN-NN-PLAN.md`.
    const GSD_STEPS: WorkflowStepConfig[] = [
        { name: 'discuss', command: 'gsd-discuss-phase', actionOnly: true },
        { name: 'plan', command: 'gsd-plan-phase', includeRelatedDocs: true },
        { name: 'execute', command: 'superpowers-execute', actionOnly: true },
        { name: 'verify', command: 'gsd-verify-work', actionOnly: true },
    ];
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const plan = GSD_STEPS[1];

    it('is false when no related doc exists yet (only ctx + steering present)', () => {
        expect(stepHasOutput(dir, plan, GSD_STEPS)).toBe(false);
    });

    it('counts a related-doc output that matches no fixed filename', () => {
        fs.writeFileSync(path.join(dir, '01-01-PLAN.md'), '# plan');
        expect(stepHasOutput(dir, plan, GSD_STEPS)).toBe(true);
    });

    it('ignores lifecycle core docs when deciding related-doc presence', () => {
        fs.writeFileSync(path.join(dir, 'spec.md'), '# spec');
        expect(stepHasOutput(dir, plan, GSD_STEPS)).toBe(false);
    });

    it('needs allSteps to resolve related-doc ownership', () => {
        fs.writeFileSync(path.join(dir, '01-01-PLAN.md'), '# plan');
        expect(stepHasOutput(dir, plan)).toBe(false);
    });
});
