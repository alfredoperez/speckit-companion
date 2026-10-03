/**
 * Mounts the real viewer around one artifact. "Today" feeds the file through
 * the shipped markdown pipeline untouched; "Proposed" keeps the same chrome and
 * draws the prototype into the content area instead.
 */

import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { App } from '../../App';
import { navState, viewerState, markdownHtml, historyEntries, viewerMode } from '../../signals';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setLivingMode, setTaskSummaries } from '../../markdown';
import { applyHighlighting } from '../../highlighting';
import { buildToc } from '../../toc';
import { mockDoc, mockNavState, mockRelatedDoc } from '../../components/__stories__/mockData';
import { ArtifactView, type Recipe } from './ArtifactView';

export interface RailDoc {
    type: string;
    label: string;
    parentStep?: string;
}

export interface GalleryArtifact {
    title: string;
    badge: string;
    filePath: string;
    doc: string;
    docLabel: string;
    md: string;
    core: RailDoc[];
    related?: RailDoc[];
    recipe?: Recipe;
    origin?: string;
}

export function GalleryViewer({ artifact, proposed }: { artifact: GalleryArtifact; proposed?: boolean }) {
    const { md, recipe } = artifact;
    const prototype = proposed && recipe;

    useEffect(() => {
        document.body.dataset.readOnly = 'true';
        return () => {
            delete document.body.dataset.readOnly;
            viewerMode.value = null;
        };
    }, []);

    viewerMode.value = 'document';
    viewerState.value = null;
    historyEntries.value = [];
    setLivingMode(false);
    setHasSpecContext(true);
    setCurrentTask(null);
    setTaskSummaries(null);
    navState.value = mockNavState({
        coreDocs: artifact.core.map((d) => ({
            ...mockDoc(d.type, true, d.label),
            filePath: artifact.filePath,
        })),
        relatedDocs: (artifact.related ?? []).map((d) => mockRelatedDoc(d.type, d.parentStep ?? 'plan', d.label)),
        currentDoc: artifact.doc,
        workflowPhase: artifact.doc,
        taskCompletionPercent: 0,
        isViewingRelatedDoc: !artifact.core.some((d) => d.type === artifact.doc),
        specStatus: 'active',
        activeStep: null,
        currentStep: null,
        stepHistory: undefined,
        badgeText: artifact.badge,
        createdDate: null,
        specContextName: artifact.title,
        titleFromHeading: true,
        branch: null,
        filePath: artifact.filePath,
        docTypeLabel: artifact.docLabel,
        activityPanelEnabled: false,
        landing: 'document',
    });
    markdownHtml.value = prototype ? '' : renderMarkdown(md);

    useEffect(() => {
        const content = document.getElementById('markdown-content');
        if (prototype && content) {
            render(<ArtifactView md={md} recipe={recipe} origin={artifact.origin} />, content);
        }
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            buildToc(document.getElementById('content-area'), content, document.getElementById('spec-toc'));
        });
        return () => {
            cancelAnimationFrame(id);
            if (prototype && content) render(null, content);
        };
    }, [md, prototype]);

    return (
        <div class="viewer-container">
            <App specStatus="active" />
        </div>
    );
}
