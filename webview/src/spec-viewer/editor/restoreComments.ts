/**
 * SpecKit Companion — Restore persisted review comments on open.
 *
 * Re-renders the current document's pending comments inline by re-anchoring
 * each to the freshly rendered DOM. Anchoring is best-effort and never drops a
 * comment (R002, R003):
 *   1. the stored line, when its content still matches the stored block;
 *   2. else any line whose content equals the stored block's first line
 *      (handles line-number drift);
 *   3. else the first line under the stored nearest-heading;
 *   4. else the stored line element if it still exists.
 * A comment that matches nothing inline stays available in the Activity list.
 */

import type { ReviewComment } from '../types';
import { viewerState } from '../signals';
import { addRestoredRefinement } from './refinements';
import { currentDoc } from './currentDoc';
import { resolveAnchorLine, type RenderedLine } from './reanchor';

function contentText(el: Element): string {
    return el.querySelector('.line-content')?.textContent?.trim() || '';
}

/** Snapshot the rendered lines once so anchoring is O(lines), not O(lines·comments). */
function renderedLines(): RenderedLine[] {
    return (Array.from(document.querySelectorAll('.line')) as HTMLElement[]).map(el => ({
        line: Number(el.getAttribute('data-line')),
        content: contentText(el),
    }));
}

/** Best-effort element to anchor a restored comment to, given a line snapshot. */
function anchorElement(c: ReviewComment, rendered: RenderedLine[]): HTMLElement | null {
    const target = resolveAnchorLine(c, rendered);
    if (target === null) return null;
    return document.querySelector(`.line[data-line="${target}"]`) as HTMLElement | null;
}

/**
 * Restore the current document's pending comments inline. Safe to call after
 * every markdown render and on document switch — `addRestoredRefinement` is
 * idempotent per comment id.
 */
export function restoreComments(): void {
    const comments = viewerState.value?.reviewComments;
    if (!comments || comments.length === 0) return;
    const doc = currentDoc();
    if (!doc) return;

    const rendered = renderedLines();
    for (const c of comments) {
        if (c.doc !== doc || c.status !== 'pending') continue;
        const el = anchorElement(c, rendered);
        if (el) addRestoredRefinement(c, el);
    }
}
