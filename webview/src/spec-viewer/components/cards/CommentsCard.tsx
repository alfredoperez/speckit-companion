import type { CoreDocumentType, ReviewComment, ViewerState, VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

export interface CommentsCardProps {
    state: ViewerState;
}

const DOC_LABELS: Record<CoreDocumentType, string> = {
    spec: 'Spec',
    plan: 'Plan',
    tasks: 'Tasks',
};
const DOC_ORDER: CoreDocumentType[] = ['spec', 'plan', 'tasks'];

/**
 * Activity-panel consolidated review list. Groups every persisted comment by
 * document, shows each comment's status (pending / applied) with a jump-to-line
 * control, and offers a per-document "Run refinement" button that dispatches
 * that doc's pending comments to the AI.
 */
export function CommentsCard({ state }: CommentsCardProps) {
    const items = state.reviewComments;
    if (!items || items.length === 0) return null;

    const byDoc: Record<CoreDocumentType, ReviewComment[]> = { spec: [], plan: [], tasks: [] };
    for (const c of items) byDoc[c.doc].push(c);

    const jump = (c: ReviewComment) => {
        vscode.postMessage({ type: 'switchDocument', documentType: c.doc });
        // Best-effort scroll when the target line is already in the DOM (same doc).
        const el = document.querySelector(`.line[data-line="${c.anchor.line}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const runDoc = (doc: CoreDocumentType) => {
        vscode.postMessage({ type: 'runDocRefinement', doc });
    };

    return (
        <section class="activity-card activity-card--comments">
            <header class="activity-card__title">
                Review comments <span class="activity-card__count">({items.length})</span>
            </header>
            <div class="activity-card__body">
                {DOC_ORDER.filter(doc => byDoc[doc].length > 0).map(doc => {
                    const docComments = byDoc[doc];
                    const pending = docComments.filter(c => c.status === 'pending').length;
                    return (
                        <div class="comments-doc-group" key={doc}>
                            <div class="comments-doc-group__header">
                                <span class="comments-doc-group__label">{DOC_LABELS[doc]}</span>
                                {pending > 0 && (
                                    <button
                                        class="comments-run-btn"
                                        onClick={() => runDoc(doc)}
                                        title={`Run refinement on ${pending} pending comment${pending === 1 ? '' : 's'}`}
                                    >
                                        ✨ Run refinement ({pending})
                                    </button>
                                )}
                            </div>
                            <ul class="activity-list comments-list">
                                {docComments.map(c => (
                                    <li key={c.id} class="comment-item">
                                        <span class={`comment-status comment-status--${c.status}`}>
                                            {c.status}
                                        </span>
                                        <button
                                            class="comment-jump"
                                            onClick={() => jump(c)}
                                            title="Jump to line"
                                        >
                                            L{c.anchor.line}
                                        </button>
                                        <span class="comment-text">{c.comment}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
