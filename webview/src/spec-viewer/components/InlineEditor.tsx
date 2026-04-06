import { useRef, useEffect } from 'preact/hooks';
import type { LineType } from '../types';
import { getContextActions } from '../editor/lineActions';

export type EditorMode = 'line' | 'row';

export interface InlineEditorProps {
    mode: EditorMode;
    lineNum: number;
    lineType: LineType;
    scenarioContent?: string;
    onSubmit: (comment: string) => void;
    onCancel: () => void;
    onContextAction: (action: string) => void;
}

export function InlineEditor(props: InlineEditorProps) {
    const { mode, lineNum, lineType, scenarioContent, onSubmit, onCancel, onContextAction } = props;
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTimeout(() => textareaRef.current?.focus(), 50);
    }, []);

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const comment = textareaRef.current?.value.trim();
            comment ? onSubmit(comment) : onCancel();
        }
    };

    const handleAdd = () => {
        const comment = textareaRef.current?.value.trim();
        comment ? onSubmit(comment) : onCancel();
    };

    const contextHtml = mode === 'line'
        ? getContextActions(lineType, lineNum)
        : null;

    const editorBody = (
        <div class="inline-editor">
            {mode === 'line' && contextHtml && (
                <div class="editor-actions" dangerouslySetInnerHTML={{ __html: contextHtml }}
                    onClick={(e: MouseEvent) => {
                        const btn = (e.target as HTMLElement).closest('.context-action') as HTMLElement;
                        if (btn) onContextAction(btn.dataset.action || '');
                    }}
                />
            )}
            {mode === 'row' && scenarioContent && (
                <div class="editor-context">
                    <span class="editor-context-label">Scenario {lineNum}:</span>
                    <span class="editor-context-text">{scenarioContent}</span>
                </div>
            )}
            <div class="editor-comment-section editor-comment-area">
                <textarea
                    ref={textareaRef}
                    class="editor-textarea"
                    placeholder="Add a comment or refinement instruction..."
                    onKeyDown={handleKeydown}
                />
                <div class="editor-buttons">
                    <button class="editor-cancel" onClick={onCancel}>Cancel</button>
                    <button class="editor-add" onClick={handleAdd}>Add Comment</button>
                </div>
            </div>
        </div>
    );

    if (mode === 'row') {
        return (
            <tr class="inline-editor-row">
                <td colspan={4} class="editor-cell">{editorBody}</td>
            </tr>
        );
    }

    return editorBody;
}
