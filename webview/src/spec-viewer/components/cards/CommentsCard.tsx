import type { DocumentType, ReviewComment, ViewerState, VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

export interface CommentsCardProps {
    state: ViewerState;
}

const CORE_DOC_ORDER = ['spec', 'plan', 'tasks'];

function docLabel(doc: DocumentType): string {
    if (doc === 'spec') return 'Spec';
    if (doc === 'plan') return 'Plan';
    if (doc === 'tasks') return 'Tasks';
    // Humanize non-core doc identifiers: 'data-model' → 'Data Model',
    // 'checklists/requirements' → 'Checklists / Requirements'.
    return doc
        .split('/')
        .map(seg => seg.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
        .join(' / ');
}

function sortDocs(docs: string[]): string[] {
    const core = CORE_DOC_ORDER.filter(d => docs.includes(d));
    const rest = docs.filter(d => !CORE_DOC_ORDER.includes(d)).sort();
    return [...core, ...rest];
}

/**
 * Activity-panel consolidated review list. Groups every persisted comment by
 * document, shows each comment's status (pending / applied) with a jump-to-line
 * control, and offers a per-document "Run refinement" button that dispatches
 * that doc's pending comments to the AI.
 */
export function CommentsCard({ state }: CommentsCardProps) {
    const items = state.reviewComments;
    if (!items || items.length === 0) return null;

    const byDoc: Record<string, ReviewComment[]> = {};
    for (const c of items) {
        if (!byDoc[c.doc]) byDoc[c.doc] = [];
        byDoc[c.doc].push(c);
    }

    const jump = (c: ReviewComment) => {
        vscode.postMessage({ type: 'switchDocument', documentType: c.doc });
        // Best-effort scroll when the target line is already in the DOM (same doc).
        const el = document.querySelector(`.line[data-line="${c.anchor.line}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const runDoc = (doc: DocumentType) => {
        vscode.postMessage({ type: 'runDocRefinement', doc });
    };

    return (
        <section class="activity-card activity-card--comments">
            <h3 class="activity-card__title">
                Review comments <span class="activity-card__count">({items.length})</span>
            </h3>
            <div class="activity-card__body">
                {sortDocs(Object.keys(byDoc)).map(doc => {
                    const docComments = byDoc[doc];
                    const pending = docComments.filter(c => c.status === 'pending').length;
                    return (
                        <div class="comments-doc-group" key={doc}>
                            <div class="comments-doc-group__header">
                                <span class="comments-doc-group__label">{docLabel(doc)}</span>
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
                                        <span class={`comment-chip comment-chip--${c.status}`}>
                                            <span
                                                class={`codicon codicon-${c.status === 'applied' ? 'check' : 'comment'}`}
                                                aria-hidden="true"
                                            />
                                            {c.status === 'applied' ? 'Applied' : 'Pending'}
                                        </span>
                                        <button
                                            class="comment-jump"
                                            onClick={() => jump(c)}
                                            title="Jump to line"
                                        >
                                            L{c.anchor.line}
                                        </button>
                                        <span class="comment-body-text">{c.comment}</span>
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
