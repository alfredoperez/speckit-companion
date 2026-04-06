/**
 * SpecKit Companion - Spec Viewer Webview
 * Entry point — mounts Preact app and handles extension messages.
 */

import { render } from 'preact';
import type { VSCodeApi, ExtensionToViewerMessage } from './types';
import { navState, markdownHtml } from './signals';
import { renderMarkdown, setCurrentTask, setHasSpecContext } from './markdown';
import { applyHighlighting, initializeMermaid } from './highlighting';
import { setupLineActions } from './editor';
import { setupRefineModal } from './modal';
import { setupCheckboxToggle, setupFileRefClickHandler } from './actions';
import { showToast } from '../shared/components/Toast';
import { App } from './App';

declare const vscode: VSCodeApi;

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
    const decoded = decodeBase64Utf8(content);
    const html = renderMarkdown(decoded);

    // Set signal — Preact re-renders the markdown-content div via dangerouslySetInnerHTML
    markdownHtml.value = html;

    // Run highlighting/mermaid after Preact commits the DOM update
    requestAnimationFrame(() => {
        applyHighlighting();
        initializeMermaid();
    });
}

// ============================================
// Message Handler
// ============================================

function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToViewerMessage;

    switch (message.type) {
        case 'contentUpdated':
            console.log('[SpecViewer] contentUpdated received, hasNavState:', !!message.navState);
            if (message.navState?.currentTask !== undefined) {
                setCurrentTask(message.navState.currentTask);
            }
            setHasSpecContext(!!(message.navState?.specContextName || message.navState?.badgeText));
            if (message.navState) {
                console.log('[SpecViewer] setting navState signal, coreDocs:', message.navState.coreDocs?.length);
                navState.value = message.navState;
                console.log('[SpecViewer] navState.value set, checking DOM...');
                requestAnimationFrame(() => {
                    const nav = document.querySelector('.compact-nav');
                    const footer = document.querySelector('.actions');
                    console.log('[SpecViewer] after signal update - nav children:', nav?.childNodes.length, 'footer:', !!footer);
                });
            }
            updateContent(message.content);
            break;

        case 'navStateUpdated':
            navState.value = message.navState;
            break;

        case 'documentsUpdated':
            break;

        case 'error':
            console.error('[SpecViewer] Error:', message.message);
            break;

        case 'fileDeleted': {
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.innerHTML = `<div class="empty-state">The file has been deleted.</div>`;
            }
            break;
        }

        case 'actionToast':
            showToast('action-toast', message.message);
            break;
    }
}

// ============================================
// State Persistence
// ============================================

function saveCurrentState(): void {
    const contentArea = document.getElementById('content-area');
    const activeTab = document.querySelector('.step-tab.viewing, .step-tab.reviewing') as HTMLButtonElement;
    if (contentArea) {
        vscode.setState({
            currentDocument: activeTab?.dataset.phase || 'spec',
            scrollPosition: contentArea.scrollTop,
            specDirectory: ''
        });
    }
}

function restoreScrollPosition(): void {
    const state = vscode.getState<{ scrollPosition?: number }>();
    if (state?.scrollPosition) {
        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.scrollTop = state.scrollPosition;
    }
}

// ============================================
// Initialization
// ============================================

function init(): void {
    const specStatus = document.body.dataset.specStatus || 'active';
    const appRoot = document.getElementById('app-root');

    // Load initial navState from server-rendered script
    const initialNav = (window as any).__INITIAL_NAV_STATE__;
    if (initialNav) {
        navState.value = initialNav;
    }

    // Wire message listener before render
    window.addEventListener('message', handleMessage);

    if (appRoot) {
        render(<App specStatus={specStatus} />, appRoot);
    }

    setupRefineModal();
    setupLineActions();
    setupCheckboxToggle();
    setupFileRefClickHandler();
    restoreScrollPosition();

    // Handle initial raw content from template
    const initialContent = document.getElementById('initial-content') as HTMLTemplateElement | null;
    if (initialContent?.dataset.raw) {
        console.log('[SpecViewer] loading initial content from template');
        updateContent(initialContent.dataset.raw);
    }

    // Save state on scroll
    const contentArea = document.getElementById('content-area');
    let scrollTimeout: number | undefined;
    contentArea?.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(saveCurrentState, 100);
    });

    console.log('[SpecViewer] sending ready message');
    vscode.postMessage({ type: 'ready' });
}

document.addEventListener('DOMContentLoaded', init);
