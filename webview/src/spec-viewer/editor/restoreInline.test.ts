/**
 * @jest-environment jsdom
 *
 * Restore-on-reopen: a spec's saved comments come back on their lines when the
 * document renders again — pending ones live, applied ones as a quiet record —
 * and only the pending ones are counted by the Refine badge.
 */
import { restoreComments } from './restoreComments';
import { clearAllRefinements } from './refinements';
import { navState, pendingRefinements, viewerState } from '../signals';
import type { ReviewComment } from '../types';

const postMessage = jest.fn();
(globalThis as unknown as { vscode: unknown }).vscode = { postMessage };

function comment(over: Partial<ReviewComment> = {}): ReviewComment {
    return {
        id: 'c1',
        doc: 'spec',
        anchor: { heading: 'Requirements', blockText: 'the target line', line: 2 },
        comment: 'tighten wording',
        status: 'pending',
        createdAt: '2026-05-21T00:00:00.000Z',
        ...over,
    };
}

/** A rendered document: one `.line` per entry, each with the comment slot. */
function renderDocument(lines: string[]): void {
    document.body.innerHTML = `<div id="markdown-content">${lines
        .map(
            (text, i) =>
                `<div class="line" data-line="${i + 1}"><div class="line-content">${text}</div><div class="line-comment-slot"></div></div>`,
        )
        .join('')}</div>`;
}

function annotations(): HTMLElement[] {
    return Array.from(document.querySelectorAll('.inline-comment'));
}

beforeEach(() => {
    postMessage.mockClear();
    clearAllRefinements();
    document.body.innerHTML = '';
    document.body.dataset.specStatus = 'specified';
    navState.value = { currentDoc: 'spec' } as never;
    viewerState.value = null;
});

describe('restoreComments', () => {
    it('remounts a pending comment on its line and counts it as pending', () => {
        renderDocument(['intro', 'the target line', 'outro']);
        viewerState.value = { reviewComments: [comment()] } as never;

        restoreComments();

        const line = document.querySelector('.line[data-line="2"]') as HTMLElement;
        expect(line.querySelector('.inline-comment')).not.toBeNull();
        expect(line.classList.contains('has-refinement')).toBe(true);
        expect(pendingRefinements.value.map(r => r.id)).toEqual(['c1']);
    });

    it('remounts an applied comment on its line but leaves the Refine count at zero', () => {
        renderDocument(['intro', 'the target line', 'outro']);
        viewerState.value = { reviewComments: [comment({ status: 'applied' })] } as never;

        restoreComments();

        expect(annotations()).toHaveLength(1);
        expect(annotations()[0].className).toContain('inline-comment--applied');
        expect(pendingRefinements.value).toEqual([]);
    });

    it('restores pending and applied comments together, counting only the pending one', () => {
        renderDocument(['intro', 'the target line', 'another line']);
        viewerState.value = {
            reviewComments: [
                comment({ id: 'c1', status: 'pending' }),
                comment({
                    id: 'c2',
                    status: 'applied',
                    anchor: { heading: null, blockText: 'another line', line: 3 },
                }),
            ],
        } as never;

        restoreComments();

        expect(annotations()).toHaveLength(2);
        expect(pendingRefinements.value.map(r => r.id)).toEqual(['c1']);
    });

    it('re-anchors a comment whose line has drifted, rather than dropping it', () => {
        // The comment was written against line 2; the source gained a line since.
        renderDocument(['intro', 'a new paragraph', 'the target line']);
        viewerState.value = { reviewComments: [comment()] } as never;

        restoreComments();

        const line = document.querySelector('.line[data-line="3"]') as HTMLElement;
        expect(line.querySelector('.inline-comment')).not.toBeNull();
    });

    it('is idempotent — a re-render does not double-mount a comment', () => {
        renderDocument(['intro', 'the target line']);
        viewerState.value = { reviewComments: [comment()] } as never;

        restoreComments();
        restoreComments();

        expect(annotations()).toHaveLength(1);
        expect(pendingRefinements.value).toHaveLength(1);
    });

    it('leaves another document\'s comments alone', () => {
        renderDocument(['intro', 'the target line']);
        viewerState.value = { reviewComments: [comment({ doc: 'plan' })] } as never;

        restoreComments();

        expect(annotations()).toHaveLength(0);
    });

    it('restores a comment whose text is markup-like as literal text', () => {
        const hostile = '"><img src=x onerror="alert(1)">';
        renderDocument(['intro', 'the target line']);
        viewerState.value = { reviewComments: [comment({ comment: hostile })] } as never;

        restoreComments();

        expect(document.querySelector('.comment-text')?.textContent).toBe(hostile);
        expect(document.querySelector('img')).toBeNull();
    });
});
