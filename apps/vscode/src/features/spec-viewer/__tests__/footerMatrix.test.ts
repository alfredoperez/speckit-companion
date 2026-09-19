/**
 * Oracle test: the live-derived footer equals the documented button matrix for
 * every pause stage. The fixtures encode
 * contracts/footer-button-matrix.md — if the catalog rules drift from the
 * documented matrix, these rows fail.
 */

import { deriveViewerState } from '../stateDerivation';
import {
    FOOTER_MATRIX,
    WORKFLOW_STEPS,
    LEFT_IDS,
    RIGHT_IDS,
    type FooterMatrixRow,
} from './footerMatrix.fixtures';
import type { SpecContext } from '../../../core/types/specContext';

function ctxFor(row: FooterMatrixRow): SpecContext {
    return {
        workflow: 'speckit-companion',
        specName: 'oracle',
        branch: 'main',
        currentStep: row.currentStep,
        status: row.status,
        history: row.history,
    };
}

function zones(row: FooterMatrixRow) {
    const footer = deriveViewerState(ctxFor(row), row.currentStep, WORKFLOW_STEPS).footer;
    return {
        footer,
        left: footer.filter(a => LEFT_IDS.has(a.id)).map(a => a.id).sort(),
        right: footer.filter(a => RIGHT_IDS.has(a.id)).map(a => a.id).sort(),
    };
}

describe('footer button matrix', () => {
    for (const row of FOOTER_MATRIX) {
        it(`${row.name}: left/right button set matches the documented matrix`, () => {
            const { left, right } = zones(row);
            expect(left).toEqual([...row.left].sort());
            expect(right).toEqual([...row.right].sort());
        });

        if (row.approveLabel) {
            it(`${row.name}: the forward action is labeled "${row.approveLabel}"`, () => {
                const approve = zones(row).footer.find(a => a.id === 'approve');
                expect(approve).toBeDefined();
                expect(approve!.label).toBe(row.approveLabel);
            });
        }
    }
});
