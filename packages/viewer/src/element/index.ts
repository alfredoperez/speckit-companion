import { h, render } from 'preact';
import type { SpecContext } from '../contract/specContext';
import type { SpecDocument, TaskCounts, ViewerAction } from '../contract/viewer';
import type { ViewerState } from '../contract/viewerState';
import { buildNavState } from '../core/navState';
import { deriveViewerState } from '../core/stateDerivation';
import { escapeHtml, renderMarkdown, setCurrentTask, setHasSpecContext, setTaskSummaries } from '../core/markdown/index';
import { specTitleOf } from '../core/specTitle';
import { App } from '../view/App';
import { setActionHandler } from '../view/host';
import { historyEntries, markdownHtml, navState, viewerMode, viewerState } from '../view/signals';
import { applyHighlighting, initializeMermaid } from '../view/highlighting';
import { buildToc } from '../view/toc';
import { applyPendingFragment, setupDocumentLinkClickHandler } from '../view/documentLinks';

export type { SpecContext } from '../contract/specContext';
export type { SpecDocument, TaskCounts, ViewerAction } from '../contract/viewer';

/** The event every action of the viewer comes out as. */
export type SpeckitActionEvent = CustomEvent<ViewerAction>;

const STYLE_ID = 'speckit-viewer-element-style';
// The host's slotted children sit above the view and outside `.sk-viewer`, so the viewer's styles never reach
// them; the element never moves them, so a framework keeps owning them.
const ELEMENT_CSS = 'speckit-viewer{display:flex;flex-direction:column;min-height:0}speckit-viewer>[slot="actions"]{order:0}speckit-viewer>.sk-viewer{order:1;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}speckit-viewer>.sk-viewer>.viewer-container{flex:1 1 auto;min-height:0}';

let linksWired = false;

/**
 * `<speckit-viewer>`: SpecKit Companion's spec viewer for any page. Give it the spec's record, its
 * documents and the open document's text; it draws the rail, the Overview and the document, moves
 * between documents itself, and says everything else as `speckit-action` events.
 * One per page: the view keeps its state in module signals.
 */
export class SpeckitViewerElement extends HTMLElement {
    #record: SpecContext | null = null;
    #documents: SpecDocument[] = [];
    #currentDoc = 'spec';
    #content: string | null = null;
    #landing: 'overview' | 'document' = 'overview';
    #live = false;
    #taskCounts: TaskCounts | null = null;
    #specTitle: string | null = null;
    #shell: HTMLDivElement | null = null;
    #root: HTMLDivElement | null = null;
    #queued = false;

    get record(): SpecContext | null { return this.#record; }
    set record(value: SpecContext | null) { this.#record = value ?? null; this.#update(); }

    get documents(): SpecDocument[] { return this.#documents; }
    set documents(value: SpecDocument[]) { this.#documents = Array.isArray(value) ? value : []; this.#update(); }

    get currentDoc(): string { return this.#currentDoc; }
    set currentDoc(value: string) {
        if (value === this.#currentDoc) return;
        this.#currentDoc = value;
        viewerMode.value = 'document';
        this.#update();
    }

    /** The open document's markdown; null while the host reads it. */
    get content(): string | null { return this.#content; }
    set content(value: string | null) {
        this.#content = value ?? null;
        if (this.#currentDoc === 'spec' && value) this.#specTitle = specTitleOf(value) ?? this.#specTitle;
        this.#update();
    }

    get landing(): 'overview' | 'document' { return this.#landing; }
    set landing(value: 'overview' | 'document') { this.#landing = value === 'document' ? 'document' : 'overview'; this.#update(); }

    get live(): boolean { return this.#live; }
    set live(value: boolean) { this.#live = !!value; this.#update(); }

    get taskCounts(): TaskCounts | null { return this.#taskCounts; }
    set taskCounts(value: TaskCounts | null) { this.#taskCounts = value ?? null; this.#update(); }

    /** The spec's own title; read from spec.md when the host does not give one. */
    get specTitle(): string | null { return this.#specTitle; }
    set specTitle(value: string | null) { this.#specTitle = value ?? null; this.#update(); }

    connectedCallback(): void {
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = ELEMENT_CSS;
            document.head.appendChild(style);
        }
        if (!this.#shell) {
            // The extension's shape: `.sk-viewer` (its <body>) around `.viewer-container`.
            this.#shell = document.createElement('div');
            this.#shell.className = 'sk-viewer';
            this.#shell.dataset.readOnly = 'true';
            this.#root = document.createElement('div');
            this.#root.className = 'viewer-container';
            this.#shell.appendChild(this.#root);
            this.appendChild(this.#shell);
        }
        if (!linksWired) {
            setupDocumentLinkClickHandler();
            linksWired = true;
        }
        setActionHandler((action) => this.#handle(action));
        this.#update();
    }

    disconnectedCallback(): void {
        setActionHandler(null);
        if (this.#root) render(null, this.#root);
    }

    #handle(action: ViewerAction): void {
        if (action.type === 'stepperClick' || action.type === 'switchDocument') {
            const next = action.type === 'stepperClick' ? action.phase : action.documentType;
            if (next !== this.#currentDoc) {
                this.#currentDoc = next;
                this.#content = null;
            }
            this.#update();
        }
        this.dispatchEvent(new CustomEvent<ViewerAction>('speckit-action', { detail: action, bubbles: true, composed: true }));
    }

    #update(): void {
        if (this.#queued || !this.isConnected) return;
        this.#queued = true;
        queueMicrotask(() => {
            this.#queued = false;
            this.#render();
        });
    }

    #render(): void {
        const root = this.#root;
        if (!root) return;
        const nav = buildNavState({
            record: this.#record,
            documents: this.#documents,
            currentDoc: this.#currentDoc,
            landing: this.#landing,
            live: this.#live,
            taskCounts: this.#taskCounts,
            specTitle: this.#specTitle,
        });
        const vs = this.#record ? (deriveViewerState(this.#record) as ViewerState) : null;
        navState.value = nav;
        viewerState.value = vs;
        historyEntries.value = vs?.history ?? [];
        setHasSpecContext(!!this.#record);
        setCurrentTask(nav.currentTask ?? null);
        setTaskSummaries(vs?.taskSummaries ?? null);
        this.#shell!.dataset.hasSpecContext = String(!!this.#record);
        this.#shell!.dataset.specStatus = nav.specStatus ?? 'active';

        const doc = this.#documents.find((d) => d.type === nav.currentDoc);
        markdownHtml.value = this.#content !== null
            ? renderMarkdown(this.#content)
            : `<div class="empty-state">${escapeHtml(doc && !doc.exists ? `${doc.fileName || doc.label} is not written yet.` : 'Reading the document.')}</div>`;

        render(h(App, null), root);
        requestAnimationFrame(() => {
            applyHighlighting();
            initializeMermaid();
            buildToc(document.getElementById('content-area'), document.getElementById('markdown-content'), document.getElementById('spec-toc'));
            applyPendingFragment();
        });
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('speckit-viewer')) {
    customElements.define('speckit-viewer', SpeckitViewerElement);
}

declare global {
    interface HTMLElementTagNameMap {
        'speckit-viewer': SpeckitViewerElement;
    }
}
