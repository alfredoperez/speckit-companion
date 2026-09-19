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
    { index: 0, line: 1, content: '# Spec' },
    { index: 1, line: 3, content: 'Requirements' },
    { index: 2, line: 5, content: 'the target line' },
    { index: 3, line: 7, content: 'another line' },
];

describe('resolveAnchorLine', () => {
    it('anchors to the stored line when its content still matches (exact)', () => {
        expect(resolveAnchorLine(comment(), lines)?.line).toBe(5);
    });

    it('re-anchors to a moved line by matching the stored block text', () => {
        const shifted: RenderedLine[] = [
            { index: 0, line: 1, content: '# Spec' },
            { index: 1, line: 4, content: 'Requirements' },
            { index: 2, line: 9, content: 'the target line' }, // moved from 5 → 9
        ];
        // stored line 5 no longer holds the text; match by content → 9.
        expect(resolveAnchorLine(comment(), shifted)?.line).toBe(9);
    });

    it('falls back to the first line under the stored heading when the block is gone', () => {
        const drifted: RenderedLine[] = [
            { index: 0, line: 1, content: '# Spec' },
            { index: 1, line: 3, content: 'Requirements' },
            { index: 2, line: 4, content: 'completely rewritten content' },
        ];
        // block text not found anywhere → nearest heading → first line after it.
        expect(resolveAnchorLine(comment(), drifted)?.line).toBe(4);
    });

    it('never invents an anchor: returns null when nothing matches', () => {
        const c = comment({ anchor: { heading: 'Gone Section', blockText: 'gone text', line: 99 } });
        expect(resolveAnchorLine(c, lines)).toBeNull();
    });

    it('falls back to the stored line if it exists even without a content match', () => {
        const c = comment({ anchor: { heading: null, blockText: 'no longer present', line: 7 } });
        // no content / heading match, but line 7 exists → keep it (never drop).
        expect(resolveAnchorLine(c, lines)?.line).toBe(7);
    });

    it('resolves the exact element index when data-line values repeat across lists', () => {
        // Two component lines share data-line=1 (list-local numbering); the match
        // must disambiguate by content and return the RIGHT index, so the caller
        // mounts on the intended element rather than the first data-line="1".
        const dup: RenderedLine[] = [
            { index: 0, line: 1, content: 'first scenario WHEN' },
            { index: 1, line: 1, content: 'second scenario WHEN' },
        ];
        const c = comment({ anchor: { heading: null, blockText: 'second scenario WHEN', line: 1 } });
        const resolved = resolveAnchorLine(c, dup);
        expect(resolved?.index).toBe(1);
    });
});
