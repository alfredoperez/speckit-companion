import { useRef, useEffect } from 'preact/hooks';
import type { LineType } from '../types';
import { getContextActions } from '../editor/lineActions';

export type EditorMode = 'line' | 'row';

export interface InlineEditorProps {
    mode: EditorMode;
    lineNum: number;
    lineType: LineType;
    scenarioContent?: string;
    /** Pre-fills the textarea — the edit flow reuses this composer. */
    initialValue?: string;
    submitLabel?: string;
    onSubmit: (comment: string) => void;
    onCancel: () => void;
    onContextAction: (action: string) => void;
}

export function InlineEditor(props: InlineEditorProps) {
    const { mode, lineNum, lineType, scenarioContent, initialValue, submitLabel, onSubmit, onCancel, onContextAction } = props;
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTimeout(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }, 50);
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

    const editing = initialValue !== undefined;
    const contextActions = mode === 'line' && !editing ? getContextActions(lineType) : [];

    const card = (
        <div class="inline-editor">
            <div class="editor-header">
                {mode === 'row' ? (
                    scenarioContent && (
                        <>
                            <span class="editor-context-label">Scenario {lineNum}:</span>
                            <span class="editor-context-text">{scenarioContent}</span>
                        </>
                    )
                ) : (
                    <span class="editor-header-target">
                        {editing ? `Editing comment on line ${lineNum}` : `Commenting on line ${lineNum}`}
                    </span>
                )}
            </div>
            <div class="editor-body">
                <textarea
                    ref={textareaRef}
                    class="editor-textarea"
                    placeholder="Add a comment or refinement instruction..."
                    value={initialValue}
                    onKeyDown={handleKeydown}
                />
            </div>
            <div class="editor-footer">
                <div class="editor-footer-actions">
                    {contextActions.map(({ action, label }) => (
                        <button
                            key={action}
                            class="context-action"
                            data-action={action}
                            onClick={() => onContextAction(action)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div class="editor-buttons">
                    <button class="editor-cancel" onClick={onCancel}>Cancel</button>
                    <button class="editor-add" onClick={handleAdd}>{submitLabel ?? 'Add Comment'}</button>
                </div>
            </div>
        </div>
    );

    if (mode === 'row') {
        return (
            <tr class="inline-editor-row">
                <td colSpan={4} class="editor-cell">{card}</td>
            </tr>
        );
    }

    return card;
}
