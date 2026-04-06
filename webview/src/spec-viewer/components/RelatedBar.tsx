import type { VSCodeApi } from '../types';
import { navState } from '../signals';

declare const vscode: VSCodeApi;

export function RelatedBar() {
    const ns = navState.value;
    if (!ns) return null;

    const { coreDocs, relatedDocs, currentDoc, isViewingRelatedDoc } = ns;

    const coreDocTypes = coreDocs.map(d => d.type);
    const isCoreDoc = coreDocTypes.includes(currentDoc);
    const relevantRelatedDocs = relatedDocs.filter(d => d.parentStep === currentDoc);
    const showRelatedBar = (relevantRelatedDocs.length > 0 && isCoreDoc) || isViewingRelatedDoc;

    if (!showRelatedBar) return null;

    const viewingRelatedDoc = isViewingRelatedDoc
        ? relatedDocs.find(d => d.type === currentDoc)
        : undefined;
    const parentPhase = isViewingRelatedDoc
        ? (viewingRelatedDoc?.parentStep || currentDoc)
        : currentDoc;
    const parentCoreDoc = coreDocs.find(d => d.type === parentPhase);
    const parentCoreExists = parentCoreDoc?.exists ?? false;
    const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;

    const displayRelatedDocs = isViewingRelatedDoc
        ? relatedDocs.filter(d => !d.parentStep || d.parentStep === viewingRelatedDoc?.parentStep)
        : relevantRelatedDocs;

    const switchDoc = (docType: string) => {
        vscode.postMessage({ type: 'switchDocument', documentType: docType });
    };

    return (
        <div class="related-bar">
            <div class="related-bar-content">
                {parentCoreExists && (
                    <>
                        <button
                            class={`overview-tab ${isOverviewActive ? 'active' : ''}`}
                            data-doc={parentPhase}
                            onClick={() => switchDoc(parentPhase)}
                        >
                            Overview
                        </button>
                        <span class="overview-divider" />
                    </>
                )}
                <div class="related-tabs">
                    {displayRelatedDocs.map(doc => (
                        <button
                            key={doc.type}
                            class={`related-tab ${doc.type === currentDoc ? 'active' : ''}`}
                            data-doc={doc.type}
                            onClick={() => switchDoc(doc.type)}
                        >
                            {doc.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
