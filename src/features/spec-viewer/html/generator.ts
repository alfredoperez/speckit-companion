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
    EnhancementButton,
    StalenessMap
} from '../types';
import { escapeHtml, escapeHtmlAttribute, generateNonce } from '../utils';
import { SpecStatuses } from '../../../core/constants';

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
    specStatus: SpecStatus = SpecStatuses.ACTIVE,
    enhancementButtons: EnhancementButton[] = [],
    stalenessMap?: StalenessMap,
    activeStep?: string | null,
    badgeText?: string | null,
    createdDate?: string | null,
    lastUpdatedDate?: string | null,
    contextSpecName?: string | null,
    contextBranch?: string | null,
    currentFilePath?: string | null,
    currentStep?: string | null,
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>
): string {
    // Get URIs for resources
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'spec-viewer.css')
    );
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'spec-viewer.js')
    );

    const nonce = generateNonce();

    // Generate content or empty state
    const contentHtml = content
        ? `<div id="markdown-content" data-raw="${escapeHtmlAttribute(content)}"></div>`
        : `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;

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
<body style="background: var(--vscode-editor-background, #1e1e1e);" data-spec-status="${specStatus}" data-spec-badge="${escapeHtml(badgeText || '')}">
    <div class="viewer-container">
        <!-- Navigation: mounted by NavigationBar + RelatedBar components -->
        <nav class="compact-nav" id="nav-root"></nav>

        <!-- Stale banner: mounted by StaleBanner component -->
        <div id="stale-banner-root"></div>

        <main class="content-area" id="content-area">
            <!-- Header: mounted by SpecHeader component -->
            <div id="header-root"></div>
            ${contentHtml}
        </main>

        <!-- Footer: mounted by FooterActions component -->
        <div id="footer-root"></div>
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
