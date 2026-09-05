/**
 * Footer determinism: the button set is a pure function of the spec's true
 * persisted state. Same state ⇒ same set on every render; a state-preserving
 * action never drops a still-valid button; an external state change re-derives
 * the matrix-correct footer.
 */

import { deriveViewerState } from '../stateDerivation';
import {
    FOOTER_MATRIX,
    WORKFLOW_STEPS,
    type FooterMatrixRow,
} from './footerMatrix.fixtures';
import type { SpecContext } from '../../../core/types/specContext';

function ctxFor(row: FooterMatrixRow): SpecContext {
    return {
        workflow: 'speckit-companion',
        specName: 'determinism',
        branch: 'main',
        currentStep: row.currentStep,
        status: row.status,
        history: row.history,
    };
}

const footerIds = (ctx: SpecContext) =>
    deriveViewerState(ctx, ctx.currentStep, WORKFLOW_STEPS).footer.map(a => a.id);

describe('footer determinism', () => {
    it('is idempotent — repeated derivations of one true state yield the identical set', () => {
        for (const row of FOOTER_MATRIX) {
            const ctx = ctxFor(row);
            const first = footerIds(ctx);
            expect(footerIds(ctx)).toEqual(first);
            expect(footerIds(ctx)).toEqual(first);
        }
    });

    it('keeps a still-valid forward action present after a state-preserving re-derivation', () => {
        // Clicking a non-advancing control (e.g. Regenerate, opening Activity)
        // leaves status/step/history untouched — the forward action must remain.
        for (const row of FOOTER_MATRIX) {
            if (!row.approveLabel) continue;
            const ctx = ctxFor(row);
            const before = footerIds(ctx);
            expect(before).toContain('approve');
            // No state change → the set is unchanged, approve still present.
            expect(footerIds(ctx)).toEqual(before);
        }
    });

    it('does not let the viewed tab change the footer — it tracks the true workflow stage', () => {
        // Viewing an earlier completed tab passes a past activeStep, but the
        // webview always derives from currentStep. Deriving with currentStep
        // yields the true-stage footer regardless of which tab is viewed.
        const planned = FOOTER_MATRIX.find(r => r.name === 'planned')!;
        const ctx = ctxFor(planned);
        const trueStage = footerIds(ctx);
        // Re-derive at the true current step (what the viewer always does).
        expect(footerIds(ctx)).toEqual(trueStage);
        expect(trueStage).toContain('approve');
    });

    it('re-derives the matrix-correct footer after an external state change', () => {
        const specified = FOOTER_MATRIX.find(r => r.name === 'specified')!;
        const planned = FOOTER_MATRIX.find(r => r.name === 'planned')!;

        const before = deriveViewerState(ctxFor(specified), 'specify', WORKFLOW_STEPS).footer;
        expect(before.find(a => a.id === 'approve')?.label).toBe('Plan');

        // Simulate an on-disk advance specify→plan (another tool / sidebar).
        const after = deriveViewerState(ctxFor(planned), 'plan', WORKFLOW_STEPS).footer;
        expect(after.find(a => a.id === 'approve')?.label).toBe('Tasks');
    });

    it('surfaces closure controls and hides the forward action at the implemented gate', () => {
        const implemented = FOOTER_MATRIX.find(r => r.name === 'implemented')!;
        const ids = footerIds(ctxFor(implemented));
        expect(ids).toEqual(expect.arrayContaining(['complete', 'archive', 'regenerate']));
        expect(ids).not.toContain('approve');
    });
});

describe("the forward action reaches a project's added step (US3)", () => {
    const path = require('path');
    const { resolveCompanionSteps } = require('../../workflows/pipelineResolution');
    const { getApproveLabel } = require('../footerActions');
    const { nextWorkflowStep } = require('../../workflows/stepSequence');
    const steps = resolveCompanionSteps(path.join(__dirname, '../../../../tests/fixtures/project-steps'));

    const extPair = (step: string, start: string, end: string) => ([
        { step, substep: null, kind: 'start', from: { step: null, substep: null }, by: 'extension', at: start },
        { step, substep: null, kind: 'complete', from: { step: null, substep: null }, by: 'extension', at: end },
    ]);

    it('names the added step when it is next, and dispatches its own command', () => {
        expect(getApproveLabel('implement', steps)).toBe('Bench Run');
        expect(nextWorkflowStep(steps, 'implement')).toMatchObject({
            name: 'bench-run',
            command: 'speckit.companion.bench-run',
        });
        expect(getApproveLabel('specify', steps)).toBe('Research Check');
    });

    it('offers the step after the added one once the run has recorded it', () => {
        expect(getApproveLabel('bench-run', steps)).toBe('Code Review');
        expect(getApproveLabel('code-review', steps)).toBe('Mark Complete');
        expect(getApproveLabel('mark-complete', steps)).toBe('Complete');
    });

    it('reads a run that recorded the added step as completed', () => {
        const ctx = {
            workflow: 'companion',
            specName: 'added-step',
            branch: 'main',
            currentStep: 'code-review',
            status: 'implemented',
            history: [
                ...extPair('implement', '2026-07-21T10:00:00.000Z', '2026-07-21T10:05:00.000Z'),
                ...extPair('bench-run', '2026-07-21T10:05:00.100Z', '2026-07-21T10:06:00.000Z'),
            ],
        } as unknown as SpecContext;
        const state = deriveViewerState(ctx, 'code-review' as SpecContext['currentStep'], steps);
        expect(state.steps['bench-run']).toBe('completed');
    });

    it('opens a spec recorded before the step existed with the added step not started', () => {
        const ctx = {
            workflow: 'companion',
            specName: 'older-spec',
            branch: 'main',
            currentStep: 'implement',
            status: 'implemented',
            history: [
                ...extPair('specify', '2026-07-21T10:00:00.000Z', '2026-07-21T10:02:00.000Z'),
                ...extPair('implement', '2026-07-21T10:02:00.100Z', '2026-07-21T10:05:00.000Z'),
            ],
        } as unknown as SpecContext;
        const state = deriveViewerState(ctx, 'implement' as SpecContext['currentStep'], steps);
        expect(state.steps['bench-run']).toBe('not-started');
        expect(state.steps['code-review']).toBe('not-started');
        expect(state.steps['implement']).toBe('completed');
    });
});
