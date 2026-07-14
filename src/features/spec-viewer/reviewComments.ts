/**
 * Pure helpers for persisted inline review comments.
 *
 * Comments live on `.spec-context.json` under `reviewComments` (replacing the
 * old per-doc `<doc>-extra.md` scratchpad files). These functions build a
 * `ReviewComment` from a click + source lines (anchoring via `extractBlock`)
 * and apply add/remove/mark-applied mutations to a `SpecContext`. They are
 * deliberately side-effect free — the message handler wraps them in
 * `updateSpecContext` so the only writer remains `specContextWriter`.
 */

import type {
    SpecContext,
    ReviewComment,
    ReviewCommentDoc,
} from '../../core/types/specContext';
import { extractBlock } from './extractBlock';

/**
 * Build a `ReviewComment` for a click on `lineNum` (1-based). When `sourceLines`
 * is available the anchor records the nearest heading + block text so the
 * viewer can re-anchor after the source drifts; otherwise it falls back to the
 * single line text. `id` is generated webview-side so the inline card and the
 * persisted record share it.
 */
export function buildReviewComment(
    doc: ReviewCommentDoc,
    lineNum: number,
    lineContent: string,
    sourceLines: string[] | null,
    comment: string,
    id: string,
): ReviewComment {
    let heading: string | null = null;
    let blockText = lineContent;
    if (sourceLines) {
        const block = extractBlock(sourceLines, lineNum);
        if (block) {
            heading = block.heading;
            blockText = block.text;
        }
    }
    return {
        id,
        doc,
        anchor: { heading, blockText, line: lineNum },
        comment,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
}

function getComments(ctx: SpecContext): ReviewComment[] {
    return Array.isArray(ctx.reviewComments) ? ctx.reviewComments : [];
}

/** Append a comment (returns a new context; never mutates the input). */
export function addComment(ctx: SpecContext, comment: ReviewComment): SpecContext {
    return { ...ctx, reviewComments: [...getComments(ctx), comment] };
}

/** Drop a comment by id. No-op if id is absent. */
export function removeComment(ctx: SpecContext, id: string): SpecContext {
    return {
        ...ctx,
        reviewComments: getComments(ctx).filter(c => c.id !== id),
    };
}

/**
 * Replace a comment's text, preserving its id, anchor, status, and createdAt.
 * Returns the input context unchanged (referentially) when nothing would change —
 * blank text, an unknown id, or text that already matches after trimming.
 */
export function editComment(ctx: SpecContext, id: string, comment: string): SpecContext {
    const text = comment.trim();
    if (!text) return ctx;
    const comments = getComments(ctx);
    const target = comments.find(c => c.id === id);
    if (!target || target.comment === text) return ctx;
    return {
        ...ctx,
        reviewComments: comments.map(c =>
            c.id === id ? { ...c, comment: text } : c,
        ),
    };
}

/** Mark the given comment ids `applied` (kept as history). */
export function markApplied(ctx: SpecContext, ids: string[]): SpecContext {
    const idSet = new Set(ids);
    return {
        ...ctx,
        reviewComments: getComments(ctx).map(c =>
            idSet.has(c.id) ? { ...c, status: 'applied' } : c,
        ),
    };
}

/** Pending comments for a document, in stored order. */
export function pendingForDoc(ctx: SpecContext, doc: ReviewCommentDoc): ReviewComment[] {
    return getComments(ctx).filter(c => c.doc === doc && c.status === 'pending');
}
