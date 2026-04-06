import type { Refinement } from '../types';

export type CommentMode = 'line' | 'row';

export interface InlineCommentProps {
    refinement: Refinement;
    mode: CommentMode;
    onDelete: (refId: string) => void;
}

export function InlineComment({ refinement, mode, onDelete }: InlineCommentProps) {
    const inner = (
        <div class="inline-comment" data-ref-id={refinement.id}>
            <span class="comment-icon">💬</span>
            <span class="comment-text">{refinement.comment}</span>
            <button
                class="comment-delete"
                title="Remove comment"
                onClick={() => onDelete(refinement.id)}
            >
                ×
            </button>
        </div>
    );

    if (mode === 'row') {
        return (
            <tr class="comment-row" data-ref-id={refinement.id}>
                <td colspan={4} class="comment-cell">{inner}</td>
            </tr>
        );
    }

    return inner;
}
