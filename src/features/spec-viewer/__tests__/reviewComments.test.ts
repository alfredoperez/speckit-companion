import type { SpecContext, ReviewComment } from '../../../core/types/specContext';
import { editComment } from '../reviewComments';

function comment(over: Partial<ReviewComment> = {}): ReviewComment {
    return {
        id: 'c1',
        doc: 'spec',
        anchor: { heading: null, blockText: 'block', line: 1 },
        comment: 'note',
        status: 'pending',
        createdAt: '2026-05-21T00:00:00.000Z',
        ...over,
    } as ReviewComment;
}

function ctxWith(reviewComments: ReviewComment[]): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'my-feature',
        branch: 'main',
        currentStep: 'specify',
        status: 'specified',
        history: [],
        reviewComments,
    } as unknown as SpecContext;
}

describe('editComment', () => {
    it('replaces the text of the named comment, leaving the others alone', () => {
        const ctx = ctxWith([comment({ id: 'c1' }), comment({ id: 'c2', comment: 'other' })]);

        const next = editComment(ctx, 'c1', '  revised  ');

        expect(next).not.toBe(ctx);
        expect(next.reviewComments?.[0].comment).toBe('revised');
        expect(next.reviewComments?.[1].comment).toBe('other');
    });

    it('returns the same context object when the id is unknown', () => {
        const ctx = ctxWith([comment({ id: 'c1' })]);

        expect(editComment(ctx, 'nope', 'ignored')).toBe(ctx);
    });

    it('returns the same context object when the text is blank', () => {
        const ctx = ctxWith([comment({ id: 'c1' })]);

        expect(editComment(ctx, 'c1', '   ')).toBe(ctx);
    });

    it('returns the same context object when the text is unchanged after trimming', () => {
        const ctx = ctxWith([comment({ id: 'c1', comment: 'note' })]);

        expect(editComment(ctx, 'c1', '  note  ')).toBe(ctx);
    });
});
