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
import { COMPANION_WORKFLOW, DEFAULT_WORKFLOW } from '../../workflows/workflowManager';
import { resolveCompanionSteps } from '../../workflows/pipelineResolution';

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
    it('is true when the only navigable step reuses a lifecycle name but action-only siblings are custom (GSD: discuss/plan/execute/verify)', () => {
        const gsd: WorkflowStepConfig[] = [
            { name: 'discuss', command: 'gsd-discuss-phase', actionOnly: true },
            { name: 'plan', command: 'gsd-plan-phase', includeRelatedDocs: true },
            { name: 'execute', command: 'superpowers-execute', actionOnly: true },
            { name: 'verify', command: 'gsd-verify-work', actionOnly: true },
        ];
        expect(isCustomWorkflow(gsd)).toBe(true);
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

describe('built-in workflows are never treated as custom', () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-582-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    // The exact state after companion specify: spec + quality checklist, nothing else.
    const freshlySpecified = (): SpecContext => ({
        workflow: 'companion',
        specName: 'footer-next-step',
        branch: 'fix/582-footer-next-step',
        currentStep: 'specify' as StepName,
        status: 'specified',
        history: [
            { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-08-19T10:00:00Z' },
            { step: 'specify', substep: null, kind: 'complete', by: 'extension', at: '2026-08-19T10:05:00Z' },
        ],
    } as unknown as SpecContext);

    it('offers Plan on a freshly specified Companion spec, not Tasks', () => {
        fs.writeFileSync(path.join(dir, 'spec.md'), '# spec');
        fs.mkdirSync(path.join(dir, 'checklists'));
        fs.writeFileSync(path.join(dir, 'checklists', 'requirements.md'), '# checklist');

        const steps = COMPANION_WORKFLOW.steps!;
        const ctx = synthesizeCustomProgress(freshlySpecified(), steps,
            s => stepHasOutput(dir, s, steps));

        expect(ctx.currentStep).toBe('specify');
        expect(getFooterActions(ctx, ctx.currentStep as StepName, steps)
            .find(a => a.id === FooterActionIds.APPROVE)?.label).toBe('Plan');
    });
});

describe('a step subDir is claimed, so its files are not another step related doc', () => {
    // Custom, so synthesis applies: specify owns `checklists/`, `draft` takes related docs.
    const CHECKLIST_STEPS: WorkflowStepConfig[] = [
        { name: 'specify', command: 'to-spec', file: 'spec.md', subDir: 'checklists' },
        { name: 'draft', command: 'to-draft', includeRelatedDocs: true },
        { name: 'implement', command: 'implement', actionOnly: true },
    ];
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subdir-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const draft = CHECKLIST_STEPS[1];

    it('does not count a doc under an earlier step subDir as a later step related doc', () => {
        fs.mkdirSync(path.join(dir, 'checklists'));
        fs.writeFileSync(path.join(dir, 'checklists', 'requirements.md'), '# checklist');
        expect(stepHasOutput(dir, draft, CHECKLIST_STEPS)).toBe(false);
    });

    it('still counts a loose unclaimed doc in the spec dir', () => {
        fs.writeFileSync(path.join(dir, '01-draft.md'), '# draft');
        expect(stepHasOutput(dir, draft, CHECKLIST_STEPS)).toBe(true);
    });

    it('still counts a step own subDir as that step output', () => {
        const specify = CHECKLIST_STEPS[0];
        fs.mkdirSync(path.join(dir, 'checklists'));
        fs.writeFileSync(path.join(dir, 'checklists', 'requirements.md'), '# checklist');
        expect(stepHasOutput(dir, specify, CHECKLIST_STEPS)).toBe(true);
    });

    it('still counts a doc in an unclaimed nested dir as a related doc', () => {
        fs.mkdirSync(path.join(dir, 'notes'));
        fs.writeFileSync(path.join(dir, 'notes', 'scratch.md'), '# scratch');
        expect(stepHasOutput(dir, draft, CHECKLIST_STEPS)).toBe(true);
    });
});

describe('the built-in exemption is additive', () => {
    it('leaves a lifecycle-named workflow with an extra mark-complete step custom', () => {
        // Not the shipped sequence, so file-driven progression must still apply.
        const lookalike: WorkflowStepConfig[] = [
            { name: 'specify', command: 'to-spec', file: 'spec.md' },
            { name: 'tasks', command: 'to-tasks', file: 'tasks.md' },
            { name: 'implement', command: 'implement', actionOnly: true },
            { name: 'mark-complete', command: 'done', actionOnly: true },
        ];
        expect(isCustomWorkflow(lookalike)).toBe(true);
    });

    it('leaves a user workflow that mirrors the Companion step names custom', () => {
        // Same names as the shipped pipeline, the user's own commands — exempting
        // this would strand it at specify with no forward button.
        const mirror: WorkflowStepConfig[] = COMPANION_WORKFLOW.steps!.map(s => ({
            ...s,
            command: `my.${s.name}`,
        }));
        expect(isCustomWorkflow(mirror)).toBe(true);
        const out = synthesizeCustomProgress(stubCtx(), mirror, s => s.name === 'specify');
        expect(hasFooter(out, 'specify' as StepName, mirror, FooterActionIds.APPROVE)).toBe(true);
    });

    it('exempts both shipped workflows', () => {
        expect(isCustomWorkflow(DEFAULT_WORKFLOW.steps)).toBe(false);
        expect(isCustomWorkflow(COMPANION_WORKFLOW.steps)).toBe(false);
    });

    it('leaves a reordered lifecycle sequence alone rather than exempting it', () => {
        const reordered: WorkflowStepConfig[] = [
            { name: 'specify', command: 'to-spec', file: 'spec.md' },
            { name: 'tasks', command: 'to-tasks', file: 'tasks.md' },
            { name: 'plan', command: 'to-plan', file: 'plan.md' },
            { name: 'implement', command: 'implement', actionOnly: true },
        ];
        // All lifecycle names — the pre-existing rule already read it non-custom.
        expect(isCustomWorkflow(reordered)).toBe(false);
    });
});

describe('a claimed subDir is pruned to its whole subtree', () => {
    const CHECKLIST_STEPS: WorkflowStepConfig[] = [
        { name: 'specify', command: 'to-spec', file: 'spec.md', subDir: 'checklists' },
        { name: 'draft', command: 'to-draft', includeRelatedDocs: true },
    ];
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('does not count a doc nested deeper inside a claimed subDir', () => {
        fs.mkdirSync(path.join(dir, 'checklists', 'archive'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'checklists', 'archive', 'old.md'), '# old');
        expect(stepHasOutput(dir, CHECKLIST_STEPS[1], CHECKLIST_STEPS)).toBe(false);
    });
});

describe("a Companion pipeline carrying the project's added step", () => {
    const FIXTURES = path.join(__dirname, '../../../../tests/fixtures');
    const spliced = resolveCompanionSteps(path.join(FIXTURES, 'project-steps'));

    it('is still classified built-in, so progression stays history-driven (FR-009)', () => {
        expect(spliced.map(s => s.name)).toContain('code-review');
        expect(isCustomWorkflow(spliced)).toBe(false);
    });

    it('never synthesizes progress from file presence for it', () => {
        const ctx = {
            workflow: 'companion',
            specName: 'test',
            branch: 'main',
            currentStep: 'specify' as StepName,
            status: 'active',
            history: [],
        } as unknown as SpecContext;
        // Every step's output claimed to exist — a custom workflow would jump ahead.
        expect(synthesizeCustomProgress(ctx, spliced, () => true)).toBe(ctx);
    });

    it('still classifies a user workflow that merely reuses the step names as custom', () => {
        expect(isCustomWorkflow(TICKET_WORKFLOW_STEPS)).toBe(true);
    });
});
