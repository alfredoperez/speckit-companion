/**
 * SpecKit Companion - Spec Viewer Webview
 * Entry point — mounts Preact app and handles extension messages.
 */

import { render } from 'preact';
import type { VSCodeApi, ExtensionToViewerMessage, NavState } from './types';
import { navState, markdownHtml, viewerState, transitions } from './signals';
import { renderMarkdown, setCurrentTask, setHasSpecContext } from './markdown';
import { applyHighlighting, initializeMermaid } from './highlighting';
import { setupLineActions } from './editor';
import { setupRefineModal } from './modal';
import { setupCheckboxToggle, setupFileRefClickHandler } from './actions';
import { showToast } from '../shared/components/Toast';
import { App } from './App';
import { buildToc } from './toc';

declare global {
    interface Window {
        __INITIAL_NAV_STATE__?: NavState;
    }
}

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
    markdownHtml.value = html;

    requestAnimationFrame(() => {
        applyHighlighting();
        initializeMermaid();
        buildToc(
            document.getElementById('content-area'),
            document.getElementById('markdown-content'),
            document.getElementById('spec-toc')
        );
    });
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
            if (message.navState) {
                navState.value = message.navState;
            }
            if (message.viewerState) {
                viewerState.value = message.viewerState;
                transitions.value = message.viewerState.transitions ?? [];
            }
            updateContent(message.content);
            break;

        case 'navStateUpdated':
            navState.value = message.navState;
            break;

        case 'viewerStateUpdated':
            viewerState.value = message.viewerState;
            transitions.value = message.viewerState.transitions ?? [];
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
    const activeTab = document.querySelector('.step-tab.current') as HTMLButtonElement;
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
    const initialNav = window.__INITIAL_NAV_STATE__;
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
        updateContent(initialContent.dataset.raw);
    }

    // Save state on scroll (debounced)
    const contentArea = document.getElementById('content-area');
    let scrollTimeout: number | undefined;
    contentArea?.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(saveCurrentState, 100);
    });

    vscode.postMessage({ type: 'ready' });
}

document.addEventListener('DOMContentLoaded', init);
