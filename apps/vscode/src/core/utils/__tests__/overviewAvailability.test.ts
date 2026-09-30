import * as fs from 'fs';
import * as path from 'path';
import { hasAnyData, hasOverview } from '../overviewAvailability';
import { deriveViewerState } from '../../../features/spec-viewer/stateDerivation';
import type { SpecContext } from '../../types/specContext';

const FIXTURE = path.join(__dirname, '../../../../tests/fixtures/spec-context/empty-history-with-comments.json');

function readFixture(): SpecContext {
    return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as SpecContext;
}

describe('overview availability', () => {
    describe('a spec whose history is empty but which keeps a status, a step and review comments', () => {
        it('has no recorded activity', () => {
            expect(hasAnyData(deriveViewerState(readFixture()))).toBe(false);
        });

        it('has no Overview', () => {
            expect(hasOverview(deriveViewerState(readFixture()), true, false)).toBe(false);
        });
    });

    describe('what counts as recorded activity', () => {
        it('counts a history entry', () => {
            const ctx: SpecContext = { ...readFixture(), history: [{ step: 'specify', substep: null, kind: 'start', at: '2026-09-29T10:00:00.000Z', by: 'extension' }] };
            expect(hasAnyData(deriveViewerState(ctx))).toBe(true);
        });

        it('counts what the run wrote down, such as an intent', () => {
            expect(hasAnyData({ intent: 'Ship it' })).toBe(true);
        });

        it('does not count a status and a current step alone', () => {
            const { reviewComments: _comments, ...ctx } = readFixture();
            expect(hasAnyData(deriveViewerState(ctx))).toBe(false);
        });

        it('does not count the reader\'s own review comments', () => {
            const ctx = readFixture();
            expect(deriveViewerState(ctx).reviewComments).toHaveLength(1);
            expect(hasAnyData(deriveViewerState(ctx))).toBe(false);
        });
    });
});
