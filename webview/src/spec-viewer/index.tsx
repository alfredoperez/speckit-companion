/**
 * SpecKit Companion - Spec Viewer Webview
 * Entry point — mounts Preact app and handles extension messages.
 */

import { render } from 'preact';
import type { VSCodeApi, ExtensionToViewerMessage } from './types';
import { navState } from './signals';
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

    const markdownEl = document.getElementById('markdown-content');
    if (markdownEl) {
        markdownEl.innerHTML = html;
    }

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
            if (message.navState?.currentTask !== undefined) {
                setCurrentTask(message.navState.currentTask);
            }
            setHasSpecContext(!!(message.navState?.specContextName || message.navState?.badgeText));
            if (message.navState) {
                navState.value = message.navState;
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

    // Save state on scroll
    const contentArea = document.getElementById('content-area');
    let scrollTimeout: number | undefined;
    contentArea?.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(saveCurrentState, 100);
    });

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });
}

document.addEventListener('DOMContentLoaded', init);
