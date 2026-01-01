/**
 * SpecKit Companion - Workflow Editor
 * Main entry point for webview TypeScript
 */
import type { SpecInfo, ExtensionToWebviewMessage, VSCodeApi } from './types';
import { renderContent } from './render';
import { updatePhaseUI, showRefineInput, showInlineEdit } from './ui';

// These are injected by the webview HTML
declare const vscode: VSCodeApi;
declare const initialContent: string;
declare let specInfo: SpecInfo;

// ============================================
// Line Actions
// ============================================

async function removeLine(lineNum: string): Promise<void> {
    const lineEl = document.querySelector(`[data-line-num="${lineNum}"]`);
    if (!lineEl) return;

    // Add removing animation
    lineEl.classList.add('removing');

    // Wait for animation
    await new Promise(r => setTimeout(r, 200));

    // Send to extension
    vscode.postMessage({
        type: 'removeLine',
        lineNum: parseInt(lineNum, 10)
    });
}

function generateContent(command: string): void {
    vscode.postMessage({ type: 'generateContent', command });
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners(): void {
    // Footer buttons
    const editSourceBtn = document.getElementById('editSource');
    if (editSourceBtn) {
        editSourceBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'editSource' });
        });
    }

    const regenerateBtn = document.getElementById('regenerate');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'regenerate' });
        });
    }

    const approveBtn = document.getElementById('approve');
    if (approveBtn) {
        approveBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'approveAndContinue' });
        });
    }

    // Enhancement button
    const enhanceBtn = document.getElementById('enhance') as HTMLElement | null;
    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', () => {
            const command = enhanceBtn.dataset.command;
            if (command) {
                vscode.postMessage({ type: 'enhance', command });
            }
        });
    }

    // Document tabs navigation
    document.querySelectorAll('.doc-tabs .doc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const fileName = (tab as HTMLElement).dataset.file;
            if (fileName && !tab.classList.contains('active')) {
                vscode.postMessage({ type: 'switchTab', fileName });
            }
        });
    });

    // Phase stepper navigation
    document.querySelectorAll('.phase-stepper .step').forEach(step => {
        step.addEventListener('click', () => {
            const phase = (step as HTMLElement).dataset.phase;
            if (phase) {
                vscode.postMessage({ type: 'navigateToPhase', phase });
            }
        });
    });

    // Content area delegation for line actions
    const contentEl = document.getElementById('content');
    if (contentEl) {
        contentEl.addEventListener('click', (event) => {
            const button = (event.target as HTMLElement).closest('button[data-action]') as HTMLElement | null;
            if (!button) return;

            const action = button.dataset.action;
            const lineNum = button.dataset.line;
            const command = button.dataset.command;

            switch (action) {
                case 'edit': {
                    if (!lineNum) break;
                    const lineEl = document.querySelector(`[data-line-num="${lineNum}"]`) as HTMLElement;
                    if (lineEl) {
                        showInlineEdit(lineNum, lineEl, vscode);
                    }
                    break;
                }
                case 'refine': {
                    if (!lineNum) break;
                    const lineEl = document.querySelector(`[data-line-num="${lineNum}"]`);
                    const lineContent = lineEl ? lineEl.querySelector('.line-content')?.textContent || '' : '';
                    showRefineInput(lineNum, lineContent.trim(), button, vscode);
                    break;
                }
                case 'remove':
                    if (lineNum) {
                        removeLine(lineNum);
                    }
                    break;
                case 'generate':
                    if (command) {
                        generateContent(command);
                    }
                    break;
            }
        });
    }
}

// Message listener
window.addEventListener('message', event => {
    const message = event.data as ExtensionToWebviewMessage;

    switch (message.type) {
        case 'documentChanged':
            renderContent(message.content, specInfo);
            break;

        case 'updatePhaseInfo':
            if (message.specInfo) {
                Object.assign(specInfo, message.specInfo);
                updatePhaseUI(specInfo);
            }
            break;
    }
});

// ============================================
// Initial Render
// ============================================

setupEventListeners();
renderContent(initialContent, specInfo);
