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
declare const mermaid: {
    initialize: (config: Record<string, unknown>) => void;
    run?: (config?: { nodes?: NodeListOf<Element> }) => Promise<void>;
};

// ============================================
// Theme-aware Mermaid (R022)
// ============================================

type MermaidTheme = 'default' | 'dark' | 'neutral';

function detectMermaidTheme(): { theme: MermaidTheme; variables: Record<string, string> } {
    const classes = document.body.classList;
    if (classes.contains('vscode-high-contrast')) {
        return {
            theme: 'neutral',
            variables: {
                primaryColor: '#ffffff',
                primaryTextColor: '#000000',
                primaryBorderColor: '#ffffff',
                lineColor: '#ffffff',
                secondaryColor: '#000000',
                tertiaryColor: '#000000',
                background: '#000000',
                mainBkg: '#000000',
                secondBkg: '#000000',
            },
        };
    }
    if (classes.contains('vscode-light')) {
        return {
            theme: 'default',
            variables: {
                primaryColor: '#2563eb',
                primaryTextColor: '#1e293b',
                primaryBorderColor: '#2563eb',
                lineColor: '#94a3b8',
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#ffffff',
                background: '#ffffff',
                mainBkg: '#f8fafc',
                secondBkg: '#ffffff',
            },
        };
    }
    // Default to dark (matches vscode-dark + no class)
    return {
        theme: 'dark',
        variables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#fafafa',
            primaryBorderColor: '#3b82f6',
            lineColor: '#666666',
            secondaryColor: '#1a1a1a',
            tertiaryColor: '#141414',
            background: '#0a0a0a',
            mainBkg: '#1a1a1a',
            secondBkg: '#141414',
        },
    };
}

function applyMermaidTheme(): void {
    if (typeof mermaid === 'undefined') return;
    const { theme, variables } = detectMermaidTheme();
    mermaid.initialize({
        startOnLoad: false,
        theme,
        themeVariables: variables,
    });
}

function observeThemeChanges(): void {
    let debounceId: number | undefined;
    const observer = new MutationObserver(mutations => {
        const classChanged = mutations.some(m => m.attributeName === 'class');
        if (!classChanged) return;
        if (debounceId !== undefined) {
            window.clearTimeout(debounceId);
        }
        debounceId = window.setTimeout(() => {
            applyMermaidTheme();
            // Re-render existing diagrams with the new theme.
            renderContent(initialContent, specInfo);
        }, 200);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

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

applyMermaidTheme();
observeThemeChanges();
setupEventListeners();
renderContent(initialContent, specInfo);
