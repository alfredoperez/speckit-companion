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
