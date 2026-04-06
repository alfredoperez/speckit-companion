/**
 * RelatedBar — shows related document tabs and overview tab.
 * Replaces the related-tabs portion of updateNavState().
 */

import { Component } from '../../shared/component';
import type { NavState, SpecDocument, VSCodeApi } from '../types';
import { viewerStore } from '../viewerStore';

declare const vscode: VSCodeApi;

export interface RelatedBarProps {
    navState: NavState;
}

export class RelatedBar extends Component<RelatedBarProps> {
    private unsubscribe: (() => void) | null = null;

    constructor(props: RelatedBarProps) {
        super(props, { className: 'related-bar' });
    }

    protected render(): string {
        const navState = this.props.navState;
        const { coreDocs, relatedDocs, currentDoc, isViewingRelatedDoc } = navState;

        const coreDocTypes = coreDocs.map(d => d.type);
        const isCoreDoc = coreDocTypes.includes(currentDoc);

        // Determine relevant related docs
        const relevantRelatedDocs = relatedDocs.filter(d => d.parentStep === currentDoc);
        const showRelatedBar = (relevantRelatedDocs.length > 0 && isCoreDoc) || isViewingRelatedDoc;

        if (!showRelatedBar) {
            this.el.style.display = 'none';
            return '';
        }
        this.el.style.display = 'flex';

        // Get parent phase for overview tab
        const viewingRelatedDoc = isViewingRelatedDoc
            ? relatedDocs.find(d => d.type === currentDoc)
            : undefined;
        const parentPhase = isViewingRelatedDoc
            ? (viewingRelatedDoc?.parentStep || currentDoc)
            : currentDoc;
        const parentCoreDoc = coreDocs.find(d => d.type === parentPhase);
        const parentCoreExists = parentCoreDoc?.exists ?? false;
        const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;

        // When viewing a related doc, show siblings
        const displayRelatedDocs = isViewingRelatedDoc
            ? relatedDocs.filter(d => {
                return !d.parentStep || d.parentStep === viewingRelatedDoc?.parentStep;
            })
            : relevantRelatedDocs;

        const overviewTabHtml = parentCoreExists
            ? `<button class="overview-tab ${isOverviewActive ? 'active' : ''}" data-doc="${parentPhase}">Overview</button>
               <span class="overview-divider"></span>`
            : '';

        const relatedTabsHtml = displayRelatedDocs.map(doc => {
            const isActive = doc.type === currentDoc;
            return `<button class="related-tab ${isActive ? 'active' : ''}" data-doc="${doc.type}">${doc.label}</button>`;
        }).join('');

        return `<div class="related-bar-content">
            ${overviewTabHtml}
            <div class="related-tabs">${relatedTabsHtml}</div>
        </div>`;
    }

    protected onMount(): void {
        // Delegate click for all tabs within related bar
        this.listen(this.el, 'click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const tab = target.closest('[data-doc]') as HTMLElement | null;
            if (!tab) return;
            const docType = tab.dataset.doc;
            if (docType) {
                vscode.postMessage({ type: 'switchDocument', documentType: docType });
            }
        });

        this.unsubscribe = viewerStore.on('navState', (ns) => {
            if (ns) {
                this.update({ navState: ns });
            }
        });
    }

    protected onUnmount(): void {
        this.unsubscribe?.();
    }
}
