import { navState } from '../signals';

/** One line saying the document on screen was deleted, so the fallback to another one is not silent. */
export function RemovedDocBanner() {
    const ns = navState.value;
    if (!ns?.removedDocument) return null;

    const shown =
        ns.coreDocs?.find(d => d.type === ns.currentDoc)?.label
        ?? ns.relatedDocs?.find(d => d.type === ns.currentDoc)?.label;

    return (
        <div class="stale-banner" id="removed-doc-banner" role="status">
            <span class="codicon codicon-info stale-banner__icon" aria-hidden="true" />
            <div class="stale-banner__body">
                <p class="stale-banner__title">
                    {ns.removedDocument} was moved or deleted{shown ? `, so ${shown} is showing` : ''}.
                </p>
            </div>
        </div>
    );
}
