/**
 * SpecKit Companion - Spec Viewer Webview
 * v0.3.0 - Enhanced with Phase Stepper, Footer Actions, and Refine Modal
 *
 * Entry point that initializes and coordinates all modules.
 */

import type {
    VSCodeApi,
    ExtensionToViewerMessage
} from './types';

import { getElements } from './elements';
import { saveState, restoreState } from './state';
import { renderMarkdown } from './markdown';
import { applyHighlighting, initializeMermaid } from './highlighting';
import { updateNavState, setupTabNavigation, setupStepperNavigation } from './navigation';
import { setupLineActions } from './editor';
import { setupRefineModal } from './modal';
import { setupEditButton, setupFooterActions, setupCheckboxToggle, setupFileRefClickHandler } from './actions';

// Get VS Code API
declare const vscode: VSCodeApi;

// ============================================
// Content Updates
// ============================================

/**
 * Decode base64 with proper UTF-8 handling
 */
function decodeBase64Utf8(base64: string): string {
    try {
        const binaryString = atob(base64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        // Fallback: content might not be base64 encoded
        return base64;
    }
}

/**
 * Update the content area with rendered markdown
 */
function updateContent(content: string): void {
    const { contentArea } = getElements();

    // Decode base64 content with proper UTF-8 handling
    const decoded = decodeBase64Utf8(content);

    // Render markdown
    const html = renderMarkdown(decoded);
    contentArea.innerHTML = `<div id="markdown-content">${html}</div>`;

    // Apply syntax highlighting and mermaid diagrams after DOM update
    requestAnimationFrame(() => {
        applyHighlighting();
        initializeMermaid();
    });
}

// ============================================
// Message Handler
// ============================================

/**
 * Handle messages from the extension
 */
function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToViewerMessage;

    switch (message.type) {
        case 'contentUpdated':
            updateContent(message.content);
            // Update navigation state if provided (for smooth tab switching)
            if (message.navState) {
                updateNavState(message.navState);
            }
            break;

        case 'navStateUpdated':
            updateNavState(message.navState);
            break;

        case 'documentsUpdated':
            // Tab state is managed by HTML regeneration
            break;

        case 'error':
            console.error('[SpecViewer] Error:', message.message);
            break;

        case 'fileDeleted':
            // Show deleted state
            const { contentArea } = getElements();
            contentArea.innerHTML = `<div class="empty-state">The file has been deleted.</div>`;
            break;
    }
}

// ============================================
// State Persistence Helpers
// ============================================

function saveCurrentState(): void {
    const { contentArea } = getElements();
    const activeTab = document.querySelector('.tab-button.active') as HTMLButtonElement;
    saveState(contentArea, activeTab);
}

function restoreCurrentState(): void {
    const { contentArea } = getElements();
    restoreState(contentArea);
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize the spec viewer webview
 */
function init(): void {
    setupTabNavigation();
    setupStepperNavigation();
    setupEditButton();
    setupFooterActions();
    setupRefineModal();
    setupLineActions();
    setupCheckboxToggle();
    setupFileRefClickHandler();
    restoreCurrentState();

    // Handle initial content (passed via data attribute)
    const { markdownContent } = getElements();
    if (markdownContent) {
        const rawContent = markdownContent.dataset.raw;
        if (rawContent) {
            updateContent(rawContent);
        }
    }

    // Save state on scroll
    const { contentArea } = getElements();
    let scrollTimeout: number | undefined;
    contentArea.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(saveCurrentState, 100);
    });

    // Listen for messages from extension
    window.addEventListener('message', handleMessage);

    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
