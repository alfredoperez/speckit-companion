/**
 * InlineComment — renders a comment card for a refinement.
 * Replaces both renderInlineComment() and renderInlineCommentForRow().
 * mode: 'line' = div inside .line-comment-slot, 'row' = tr after scenario row.
 */

import { Component } from '../../shared/component';
import { escapeHtml } from '../markdown';
import type { Refinement } from '../types';

export type CommentMode = 'line' | 'row';

export interface InlineCommentProps {
    refinement: Refinement;
    mode: CommentMode;
    onDelete: (refId: string) => void;
}

export class InlineComment extends Component<InlineCommentProps> {
    constructor(props: InlineCommentProps) {
        super(props, {
            tag: props.mode === 'row' ? 'tr' : 'div',
            className: props.mode === 'row' ? 'comment-row' : 'inline-comment',
        });
        this.el.dataset.refId = props.refinement.id;
    }

    protected render(): string {
        const { refinement, mode } = this.props;
        const inner = `<span class="comment-icon">💬</span>
            <span class="comment-text">${escapeHtml(refinement.comment)}</span>
            <button class="comment-delete" data-ref-id="${refinement.id}" title="Remove comment">×</button>`;

        if (mode === 'row') {
            return `<td colspan="4" class="comment-cell">
                <div class="inline-comment">${inner}</div>
            </td>`;
        }
        return inner;
    }

    protected onMount(): void {
        const deleteBtn = this.query('.comment-delete');
        if (deleteBtn) {
            this.listen(deleteBtn, 'click', () => {
                this.props.onDelete(this.props.refinement.id);
            });
        }
    }
}
