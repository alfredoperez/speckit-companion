/**
 * InlineEditor — comment editor for lines and scenario rows.
 * Replaces both showInlineEditor() and showInlineEditorForRow().
 * mode: 'line' = div inside .line-comment-slot, 'row' = tr after scenario row.
 */

import { Component } from '../../shared/component';
import { escapeHtml } from '../markdown';
import type { LineType } from '../types';
import { getContextActions } from '../editor/lineActions';

export type EditorMode = 'line' | 'row';

export interface InlineEditorProps {
    mode: EditorMode;
    lineNum: number;
    lineType: LineType;
    /** Scenario content (row mode only) */
    scenarioContent?: string;
    onSubmit: (comment: string) => void;
    onCancel: () => void;
    onContextAction: (action: string) => void;
}

export class InlineEditorComponent extends Component<InlineEditorProps> {
    constructor(props: InlineEditorProps) {
        super(props, {
            tag: props.mode === 'row' ? 'tr' : 'div',
            className: props.mode === 'row' ? 'inline-editor-row' : 'inline-editor',
        });
    }

    protected render(): string {
        const { mode, lineNum, lineType, scenarioContent } = this.props;

        // Context section: quick actions for line mode, scenario info for row mode
        let contextHtml = '';
        if (mode === 'line') {
            contextHtml = `<div class="editor-actions">${getContextActions(lineType, lineNum)}</div>`;
        } else if (scenarioContent) {
            contextHtml = `<div class="editor-context">
                <span class="editor-context-label">Scenario ${lineNum}:</span>
                <span class="editor-context-text">${escapeHtml(scenarioContent)}</span>
            </div>`;
        }

        const editorBody = `${contextHtml}
            <div class="editor-comment-section editor-comment-area">
                <textarea class="editor-textarea" placeholder="Add a comment or refinement instruction..."></textarea>
                <div class="editor-buttons">
                    <button class="editor-cancel">Cancel</button>
                    <button class="editor-add">Add Comment</button>
                </div>
            </div>`;

        // Row mode wraps in td > div
        if (mode === 'row') {
            return `<td colspan="4" class="editor-cell">
                <div class="inline-editor">${editorBody}</div>
            </td>`;
        }

        return editorBody;
    }

    protected onMount(): void {
        const textarea = this.query<HTMLTextAreaElement>('.editor-textarea');
        const cancelBtn = this.query<HTMLButtonElement>('.editor-cancel');
        const addBtn = this.query<HTMLButtonElement>('.editor-add');

        // Focus textarea
        if (textarea) {
            setTimeout(() => textarea.focus(), 50);
        }

        // Cancel
        if (cancelBtn) {
            this.listen(cancelBtn, 'click', () => this.props.onCancel());
        }

        // Add comment
        if (addBtn) {
            this.listen(addBtn, 'click', () => {
                const comment = textarea?.value.trim();
                if (comment) {
                    this.props.onSubmit(comment);
                } else {
                    this.props.onCancel();
                }
            });
        }

        // Keyboard shortcuts
        if (textarea) {
            this.listen(textarea, 'keydown', (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    this.props.onCancel();
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    const comment = textarea.value.trim();
                    if (comment) {
                        this.props.onSubmit(comment);
                    } else {
                        this.props.onCancel();
                    }
                }
            });
        }

        // Context action buttons (line mode)
        this.queryAll('.context-action').forEach(btn => {
            this.listen(btn, 'click', () => {
                const action = (btn as HTMLElement).dataset.action || '';
                this.props.onContextAction(action);
            });
        });
    }
}
