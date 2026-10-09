/** @jest-environment jsdom */
import { markStruckRows, setupCallsStrike, STRIKE_TEXT } from '../callsStrike';
import { clearAllRefinements, removeRefinement } from '../refinements';
import { pendingRefinements } from '../../signals';
import { navState, viewerState } from '../../signals';
import type { ReviewComment } from '../../types';

const postMessage = jest.fn();
(globalThis as unknown as { vscode: unknown }).vscode = { postMessage };

function renderCard(): void {
    document.body.innerHTML = `<div id="markdown-content">
        <div class="line component-line" data-line="4"><div class="calls-row calls-row--same"><span class="line-content" hidden>a @ a.ts:1</span></div><div class="line-comment-slot"></div></div>
        <div class="line component-line" data-line="5"><div class="calls-row calls-row--chg"><button type="button" class="calls-strike" data-line="5">strike</button><span class="line-content" hidden>~ b @ b.ts:2</span></div><div class="line-comment-slot"></div></div>
    </div>`;
}

const strikeButton = (): HTMLElement => document.querySelector('.calls-strike') as HTMLElement;
const row = (line: number): HTMLElement => document.querySelector(`.line[data-line="${line}"] .calls-row`) as HTMLElement;

function stored(over: Partial<ReviewComment> = {}): ReviewComment {
    return {
        id: 'c1', doc: 'plan',
        anchor: { heading: 'Call paths', blockText: '~ b @ b.ts:2', line: 5 },
        comment: STRIKE_TEXT, status: 'pending', createdAt: '2026-05-21T00:00:00.000Z', ...over,
    };
}

let installed = false;
beforeEach(() => {
    postMessage.mockClear();
    clearAllRefinements();
    renderCard();
    navState.value = { currentDoc: 'plan' } as never;
    viewerState.value = null;
    if (!installed) { setupCallsStrike(); installed = true; }
});

describe('the strike button', () => {
    it('posts one addComment with the fixed text and the row line', () => {
        strikeButton().click();

        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage.mock.calls[0][0]).toMatchObject({
            type: 'addComment', doc: 'plan', lineNum: 5, comment: 'Remove this call from the plan.', lineContent: '~ b @ b.ts:2',
        });
    });

    it('draws the row struck once pressed', () => {
        strikeButton().click();

        expect(row(5).classList.contains('calls-row--struck')).toBe(true);
        expect(row(4).classList.contains('calls-row--struck')).toBe(false);
    });

    it('draws the row plain again when its comment is removed', () => {
        strikeButton().click();

        removeRefinement(pendingRefinements.value[0].id);

        expect(row(5).classList.contains('calls-row--struck')).toBe(false);
    });

    it('does nothing on a read-only page', () => {
        document.body.dataset.readOnly = 'true';

        strikeButton().click();
        delete document.body.dataset.readOnly;

        expect(postMessage).not.toHaveBeenCalled();
    });

    it('posts nothing on a second press', () => {
        strikeButton().click();
        strikeButton().click();

        expect(postMessage).toHaveBeenCalledTimes(1);
    });

    it('posts nothing when the row already has the comment from the file', () => {
        viewerState.value = { reviewComments: [stored({ status: 'applied' })] } as never;

        strikeButton().click();

        expect(postMessage).not.toHaveBeenCalled();
    });

    it('still posts for a row whose only comment says something else', () => {
        viewerState.value = { reviewComments: [stored({ comment: 'rename it' })] } as never;

        strikeButton().click();

        expect(postMessage).toHaveBeenCalledTimes(1);
    });
});

describe('markStruckRows', () => {
    it.each(['pending', 'applied'] as const)('draws a row struck for a %s removal comment', (status) => {
        viewerState.value = { reviewComments: [stored({ status })] } as never;

        markStruckRows();

        expect(row(5).classList.contains('calls-row--struck')).toBe(true);
        expect(row(4).classList.contains('calls-row--struck')).toBe(false);
    });

    it('does not draw a different row struck when the line number now holds other text', () => {
        viewerState.value = { reviewComments: [stored({ anchor: { heading: null, blockText: '- gone @ g.ts:9', line: 5 } })] } as never;

        markStruckRows();

        expect(row(5).classList.contains('calls-row--struck')).toBe(false);
    });

    it('ignores a removal comment on another document', () => {
        viewerState.value = { reviewComments: [stored({ doc: 'spec' })] } as never;

        markStruckRows();

        expect(row(5).classList.contains('calls-row--struck')).toBe(false);
    });
});
