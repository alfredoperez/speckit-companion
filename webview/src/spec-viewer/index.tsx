/**
 * SpecKit Companion - Spec Viewer Webview
 * Entry point — mounts Preact app and handles extension messages.
 */

import { render } from 'preact';
import type { VSCodeApi, NavState } from './types';
import { navState, markdownHtml } from './signals';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setLivingMode } from './markdown';
import { applyHighlighting, initializeMermaid } from './highlighting';
import { setupLineActions } from './editor';
import { setupCheckboxToggle, setupFileRefClickHandler } from './actions';
import { createMessageRouter } from './messageHandlers';
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

const handleMessage = createMessageRouter(updateContent);

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
        // Set renderer flags before the first updateContent below, or a living
        // spec's first paint renders in feature-spec mode until a later message.
        setLivingMode(!!initialNav.livingMode);
        setHasSpecContext(!!(initialNav.specContextName || initialNav.badgeText));
        if (initialNav.currentTask !== undefined) {
            setCurrentTask(initialNav.currentTask);
        }
    }

    // Wire message listener before render
    window.addEventListener('message', handleMessage);

    if (appRoot) {
        render(<App specStatus={specStatus} />, appRoot);
    }

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
