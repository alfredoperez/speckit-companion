import { useState } from 'preact/hooks';
import type { Refinement } from '../types';

export type CommentMode = 'line' | 'row';

export interface InlineCommentProps {
    refinement: Refinement;
    mode: CommentMode;
    onDelete: (refId: string) => void;
    onEdit?: (refId: string) => void;
    onRefine?: (refId: string) => void;
    /** Completed and archived specs show their comments but cannot change them. */
    readOnly?: boolean;
}

export function InlineComment({ refinement, mode, onDelete, onEdit, onRefine, readOnly }: InlineCommentProps) {
    const [expanded, setExpanded] = useState(false);
    const pending = refinement.status !== 'applied';
    const bodyId = `comment-body-${refinement.id}`;

    const inner = (
        <div
            class={`inline-comment inline-comment--${pending ? 'pending' : 'applied'}${expanded ? ' is-expanded' : ''}`}
            data-ref-id={refinement.id}
        >
            <button
                type="button"
                class="comment-disclosure"
                aria-expanded={expanded}
                aria-controls={expanded ? bodyId : undefined}
                onClick={() => setExpanded(!expanded)}
            >
                <span class="sr-only">Comment: </span>
                <span
                    class={`comment-glyph codicon codicon-${pending ? 'comment' : 'check'}`}
                    aria-hidden="true"
                />
                <span class="comment-text">{refinement.comment}</span>
                <span class="comment-state">{pending ? 'Pending' : 'Applied'}</span>
                <span
                    class={`comment-caret codicon codicon-chevron-${expanded ? 'up' : 'down'}`}
                    aria-hidden="true"
                />
            </button>

            {expanded && (
                <div class="comment-detail">
                    <p class="comment-body" id={bodyId}>{refinement.comment}</p>
                    {!readOnly && (
                        <div class="comment-actions">
                            {pending && onRefine && (
                                <button
                                    type="button"
                                    class="comment-action comment-action--refine"
                                    onClick={() => onRefine(refinement.id)}
                                >
                                    Refine
                                </button>
                            )}
                            {onEdit && (
                                <button
                                    type="button"
                                    class="comment-action comment-action--edit"
                                    onClick={() => onEdit(refinement.id)}
                                >
                                    Edit
                                </button>
                            )}
                            <button
                                type="button"
                                class="comment-action comment-action--delete"
                                onClick={() => onDelete(refinement.id)}
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    if (mode === 'row') {
        return (
            <tr class="comment-row" data-ref-id={refinement.id}>
                <td colSpan={4} class="comment-cell">{inner}</td>
            </tr>
        );
    }

    return inner;
}
