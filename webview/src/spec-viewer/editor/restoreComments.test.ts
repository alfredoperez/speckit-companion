/**
 * Unit tests for resolveAnchorLine — the pure re-anchoring decision used to
 * restore persisted review comments inline (R002, R003).
 */
import { resolveAnchorLine, type RenderedLine } from './reanchor';
import type { ReviewComment } from '../types';

function comment(over: Partial<ReviewComment> = {}): ReviewComment {
    return {
        id: 'c1',
        doc: 'spec',
        anchor: { heading: 'Requirements', blockText: 'the target line', line: 5 },
        comment: 'note',
        status: 'pending',
        createdAt: '2026-05-21T00:00:00.000Z',
        ...over,
    };
}

const lines: RenderedLine[] = [
    { line: 1, content: '# Spec' },
    { line: 3, content: 'Requirements' },
    { line: 5, content: 'the target line' },
    { line: 7, content: 'another line' },
];

describe('resolveAnchorLine', () => {
    it('anchors to the stored line when its content still matches (exact)', () => {
        expect(resolveAnchorLine(comment(), lines)).toBe(5);
    });

    it('re-anchors to a moved line by matching the stored block text', () => {
        const shifted: RenderedLine[] = [
            { line: 1, content: '# Spec' },
            { line: 4, content: 'Requirements' },
            { line: 9, content: 'the target line' }, // moved from 5 → 9
        ];
        // stored line 5 no longer holds the text; match by content → 9.
        expect(resolveAnchorLine(comment(), shifted)).toBe(9);
    });

    it('falls back to the first line under the stored heading when the block is gone', () => {
        const drifted: RenderedLine[] = [
            { line: 1, content: '# Spec' },
            { line: 3, content: 'Requirements' },
            { line: 4, content: 'completely rewritten content' },
        ];
        // block text not found anywhere → nearest heading → first line after it.
        expect(resolveAnchorLine(comment(), drifted)).toBe(4);
    });

    it('never invents an anchor: returns null when nothing matches', () => {
        const c = comment({ anchor: { heading: 'Gone Section', blockText: 'gone text', line: 99 } });
        expect(resolveAnchorLine(c, lines)).toBeNull();
    });

    it('falls back to the stored line if it exists even without a content match', () => {
        const c = comment({ anchor: { heading: null, blockText: 'no longer present', line: 7 } });
        // no content / heading match, but line 7 exists → keep it (never drop).
        expect(resolveAnchorLine(c, lines)).toBe(7);
    });
});
