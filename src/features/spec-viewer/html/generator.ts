/**
 * SpecKit Companion - HTML Generator
 * Generates the main HTML for the spec viewer webview
 */

import * as vscode from 'vscode';
import {
    SpecDocument,
    DocumentType,
    PhaseInfo,
    SpecStatus,
    EnhancementButton
} from '../types';
import { escapeHtml, escapeHtmlAttribute, generateNonce } from '../utils';
import { calculateWorkflowPhase } from '../phaseCalculation';
import { generateCompactNav } from './navigation';

/**
 * Generate HTML for the webview
 */
export function generateHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    content: string,
    emptyMessage: string,
    documents: SpecDocument[],
    currentDocType: DocumentType,
    specName: string,
    phases: PhaseInfo[],
    taskCompletionPercent: number,
    specStatus: SpecStatus = 'draft',
    enhancementButton: EnhancementButton | null = null
): string {
    // Get URIs for resources
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'spec-viewer.css')
    );
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'spec-viewer.js')
    );

    const nonce = generateNonce();

    // Split documents by category
    const coreDocs = documents.filter(d => d.category === 'core');
    const relatedDocs = documents.filter(d => d.category === 'related');

    // Generate content or empty state
    const contentHtml = content
        ? `<div id="markdown-content" data-raw="${escapeHtmlAttribute(content)}"></div>`
        : `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;

    // Get current document for edit button state
    const currentDoc = documents.find(d => d.type === currentDocType);
    const editDisabled = !currentDoc?.exists;

    // Smart CTA button logic:
    // - Show "Generate Plan/Tasks" when next phase doesn't exist yet
    // - Hide when next phase already exists (user can navigate via tabs)
    // - For tasks: show "Implement Tasks" when not complete, hide when 100% complete
    const planExists = coreDocs.find(d => d.type === 'plan')?.exists ?? false;
    const tasksExists = coreDocs.find(d => d.type === 'tasks')?.exists ?? false;

    let showApproveButton = false;
    let approveText = '';

    if (currentDocType === 'spec') {
        // Show "Generate Plan" only if plan doesn't exist
        if (!planExists) {
            showApproveButton = true;
            approveText = 'Generate Plan';
        }
    } else if (currentDocType === 'plan') {
        // Show "Generate Tasks" only if tasks doesn't exist
        if (!tasksExists) {
            showApproveButton = true;
            approveText = 'Generate Tasks';
        }
    } else if (currentDocType === 'tasks') {
        // Show "Implement Tasks" only if not 100% complete
        if (taskCompletionPercent < 100) {
            showApproveButton = true;
            approveText = 'Implement Tasks';
        }
    }

    // Determine if viewing a related doc
    const isViewingRelatedDoc = !['spec', 'plan', 'tasks'].includes(currentDocType);

    // Calculate workflow phase (where we ARE in spec-driven development)
    const workflowPhase = calculateWorkflowPhase(coreDocs);

    // Generate the new compact nav
    const navHtml = generateCompactNav(
        coreDocs,
        relatedDocs,
        currentDocType,
        workflowPhase,
        isViewingRelatedDoc,
        taskCompletionPercent
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net;
                   script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;
                   img-src ${webview.cspSource} data: https:;
                   font-src ${webview.cspSource} https://cdn.jsdelivr.net;">
    <style nonce="${nonce}">
      @font-face {
        font-family: 'Geist';
        font-style: normal;
        font-display: swap;
        font-weight: 100 900;
        src: url(https://cdn.jsdelivr.net/fontsource/fonts/geist:vf@latest/latin-wght-normal.woff2) format('woff2-variations');
      }
    </style>
    <link href="${styleUri}" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github-dark.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css">
    <title>Spec: ${escapeHtml(specName)}</title>
</head>
<body style="background: var(--vscode-editor-background, #1e1e1e);" data-spec-status="${specStatus}">
    <div class="viewer-container">
        ${navHtml}

        <main class="content-area" id="content-area">
            ${contentHtml}
        </main>

        <footer class="actions">
            <div class="actions-left">
                ${enhancementButton ? `
                <button id="enhance" class="enhancement" data-command="${enhancementButton.command}" title="${enhancementButton.tooltip || ''}">
                    <span class="icon">${enhancementButton.icon}</span>
                    ${enhancementButton.label}
                </button>
                ` : ''}
            </div>
            <div class="actions-right">
                <button id="editSource" class="secondary" ${editDisabled ? 'disabled' : ''}>Edit Source</button>
                <button id="regenerate" class="secondary">Regenerate</button>
                ${showApproveButton ? `<button id="approve" class="primary">${approveText}</button>` : ''}
            </div>
        </footer>
    </div>

    <div class="loading-overlay" id="loading-overlay" style="display: none;">
        <div class="loading-spinner"></div>
    </div>

    <div class="refine-backdrop" id="refine-backdrop" style="display: none;"></div>
    <div class="refine-popover" id="refine-popover" style="display: none;">
        <div class="refine-popover-header">Refine this line</div>
        <div class="original-value-reference" id="refine-original">
            <span class="original-value-label">Original</span>
            <span id="refine-original-text"></span>
        </div>
        <input type="text" class="refine-input" id="refine-input" placeholder="Describe how to improve this line...">
        <div class="refine-popover-actions">
            <button class="refine-cancel" id="refine-cancel">Cancel</button>
            <button class="refine-submit" id="refine-submit">Refine</button>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/typescript.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/bash.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/json.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/yaml.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/css.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/javascript.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" nonce="${nonce}"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
