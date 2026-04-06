/**
 * SpecKit Companion - Spec Viewer Webview
 * Entry point that initializes and coordinates all modules.
 */

import type {
    VSCodeApi,
    ExtensionToViewerMessage,
    NavState
} from './types';

import { getElements } from './elements';
import { saveState, restoreState, initStateSync } from './state';
import { renderMarkdown, setCurrentTask, setHasSpecContext } from './markdown';
import { applyHighlighting, initializeMermaid } from './highlighting';
import { updateNavState, setupTabNavigation } from './navigation';
import { setupLineActions } from './editor';
import { setupRefineModal } from './modal';
import { setupCheckboxToggle, setupFileRefClickHandler } from './actions';
import { viewerStore } from './viewerStore';
import { NavigationBar, RelatedBar, StaleBanner, SpecHeader, FooterActions } from './components';

// Get VS Code API
declare const vscode: VSCodeApi;

// Component instances
let navigationBar: NavigationBar | null = null;
let relatedBar: RelatedBar | null = null;
let staleBanner: StaleBanner | null = null;
let specHeader: SpecHeader | null = null;
let footerActions: FooterActions | null = null;

// ============================================
// Content Updates
// ============================================

function decodeBase64Utf8(base64: string): string {
    try {
        const binaryString = atob(base64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        return base64;
    }
}

function updateContent(content: string): void {
    const { contentArea } = getElements();
    const decoded = decodeBase64Utf8(content);
    const html = renderMarkdown(decoded);

    let markdownEl = document.getElementById('markdown-content');
    if (markdownEl) {
        markdownEl.innerHTML = html;
    } else {
        markdownEl = document.createElement('div');
        markdownEl.id = 'markdown-content';
        markdownEl.innerHTML = html;
        contentArea.appendChild(markdownEl);
    }

    requestAnimationFrame(() => {
        applyHighlighting();
        initializeMermaid();
    });
}

// ============================================
// Component Mounting
// ============================================

function mountComponents(navState: NavState): void {
    const navRoot = document.getElementById('nav-root');
    const staleBannerRoot = document.getElementById('stale-banner-root');
    const headerRoot = document.getElementById('header-root');
    const footerRoot = document.getElementById('footer-root');

    if (navRoot && !navigationBar) {
        navigationBar = new NavigationBar({ navState });
        navigationBar.mount(navRoot);

        relatedBar = new RelatedBar({ navState });
        relatedBar.mount(navRoot);
    }

    if (staleBannerRoot && !staleBanner) {
        staleBanner = new StaleBanner({ navState });
        staleBanner.mount(staleBannerRoot);
    }

    if (headerRoot && !specHeader) {
        specHeader = new SpecHeader({ navState });
        specHeader.mount(headerRoot);
    }

    if (footerRoot && !footerActions) {
        const specStatus = document.body.dataset.specStatus || 'active';
        footerActions = new FooterActions({
            navState,
            specStatus,
            enhancementButtons: navState.footerState?.enhancementButtons ?? navState.enhancementButtons ?? [],
        });
        footerActions.mount(footerRoot);
    }
}

// ============================================
// Message Handler
// ============================================

function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToViewerMessage;

    switch (message.type) {
        case 'contentUpdated':
            if (message.navState?.currentTask !== undefined) {
                setCurrentTask(message.navState.currentTask);
            }
            setHasSpecContext(!!(message.navState?.specContextName || message.navState?.badgeText));
            updateContent(message.content);
            if (message.navState) {
                // Mount components on first navState, then store update triggers re-renders
                mountComponents(message.navState);
                updateNavState(message.navState);
            }
            break;

        case 'navStateUpdated':
            mountComponents(message.navState);
            updateNavState(message.navState);
            break;

        case 'documentsUpdated':
            break;

        case 'error':
            console.error('[SpecViewer] Error:', message.message);
            break;

        case 'fileDeleted': {
            const { contentArea } = getElements();
            contentArea.innerHTML = `<div class="empty-state">The file has been deleted.</div>`;
            break;
        }

        case 'actionToast': {
            const toast = document.getElementById('action-toast');
            if (toast) {
                toast.textContent = message.message;
                toast.classList.add('visible');
                setTimeout(() => toast.classList.remove('visible'), 2000);
            }
            break;
        }
    }
}

// ============================================
// State Persistence Helpers
// ============================================

function saveCurrentState(): void {
    const { contentArea } = getElements();
    const activeTab = document.querySelector('.step-tab.viewing, .step-tab.reviewing') as HTMLButtonElement;
    saveState(contentArea, activeTab);
}

function restoreCurrentState(): void {
    const { contentArea } = getElements();
    restoreState(contentArea);
}

// ============================================
// Initialization
// ============================================

function init(): void {
    initStateSync();
    setupTabNavigation();
    setupRefineModal();
    setupLineActions();
    setupCheckboxToggle();
    setupFileRefClickHandler();
    restoreCurrentState();

    const { markdownContent } = getElements();
    const specHeaderEl = document.querySelector('.spec-header');
    setHasSpecContext(specHeaderEl?.getAttribute('data-has-context') === 'true');

    if (markdownContent) {
        const rawContent = markdownContent.dataset.raw;
        if (rawContent) {
            updateContent(rawContent);
        }
    }

    const { contentArea } = getElements();
    let scrollTimeout: number | undefined;
    contentArea.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(saveCurrentState, 100);
    });

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });
}

document.addEventListener('DOMContentLoaded', init);
