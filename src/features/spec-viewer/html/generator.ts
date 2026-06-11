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
    StalenessMap,
    NavState
} from '../types';
import { escapeHtml, escapeHtmlAttribute, generateNonce } from '../utils';
import { calculateWorkflowPhase, getDocTypeLabel } from '../phaseCalculation';
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
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>,
    activityPanelEnabled: boolean = true,
    showInstallPrompt: boolean = false
): string {
    // Get URIs for resources
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'spec-viewer.css')
    );
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'spec-viewer.js')
    );
    const geistFontUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'fonts', 'geist-vf.woff2')
    );
    const codiconCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'codicons', 'codicon.css')
    );

    const nonce = generateNonce();

    // Install banner: shown only when the spec-kit extension is missing (and the
    // prompt isn't `off`). In the viewer the banner now renders INSIDE the Preact
    // Activity panel (#255) — we pass the visibility via `initialNavState` rather
    // than injecting markup above #app-root. Visibility is decided by the provider
    // via `shouldShowInstallPrompt`.

    // Generate content or empty state
    const contentHtml = content
        ? `<div id="markdown-content" data-raw="${escapeHtmlAttribute(content)}"></div>`
        : `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;

    // Build initial navState for Preact components
    const coreDocs = documents.filter(d => d.category === 'core');
    const relatedDocs = documents.filter(d => d.category === 'related');
    const coreDocTypes = coreDocs.map(d => d.type);
    const isViewingRelatedDoc = !coreDocTypes.includes(currentDocType);
    const workflowPhase = calculateWorkflowPhase(coreDocs);

    const initialNavState: NavState = {
        coreDocs,
        relatedDocs,
        currentDoc: currentDocType,
        workflowPhase,
        taskCompletionPercent,
        isViewingRelatedDoc,
        enhancementButtons,
        stalenessMap,
        specStatus,
        activeStep: activeStep ?? null,
        stepHistory,
        badgeText: badgeText ?? null,
        createdDate: createdDate ?? null,
        lastUpdatedDate: lastUpdatedDate ?? null,
        specContextName: contextSpecName ?? null,
        branch: contextBranch ?? null,
        currentStep: currentStep ?? null,
        filePath: currentFilePath ?? null,
        docTypeLabel: getDocTypeLabel(currentStep ?? currentDocType),
        activityPanelEnabled,
        showInstallPrompt,
    };

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
                   font-src ${webview.cspSource};">
    <style nonce="${nonce}">
      @font-face {
        font-family: 'Geist';
        font-style: normal;
        font-display: swap;
        font-weight: 100 900;
        src: url('${geistFontUri}') format('woff2-variations');
      }
    </style>
    <link href="${styleUri}" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github-dark.min.css">
    <link rel="stylesheet" href="${codiconCssUri}">
    <title>Spec: ${escapeHtml(specName)}</title>
</head>
<body style="background: var(--vscode-editor-background, #1e1e1e);" data-spec-status="${specStatus}" data-spec-badge="${escapeHtml(badgeText || '')}">
    <div class="viewer-container" id="app-root"></div>
    <template id="initial-content" data-raw="${content ? escapeHtmlAttribute(content) : ''}"></template>
    <script nonce="${nonce}">
        window.__INITIAL_NAV_STATE__ = ${JSON.stringify(initialNavState)};
    </script>

    <div class="loading-overlay" id="loading-overlay" style="display: none;">
        <div class="loading-spinner"></div>
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
        // Install banner actions (present only when the spec-kit extension is
        // missing). data-action → the matching message the spec-viewer message
        // handler resolves. The viewer banner now mounts inside the Preact
        // Activity panel AFTER this script runs (#255), so delegate from the
        // document rather than binding to the element at load time — an
        // element-bound listener would no-op against a not-yet-mounted banner.
        (function () {
            document.addEventListener('click', function (e) {
                if (!(e.target instanceof Element)) { return; }
                const el = e.target.closest('#install-banner [data-action]');
                if (!el) { return; }
                const action = el.getAttribute('data-action');
                if (action === 'installSpecKitExtension') {
                    vscode.postMessage({ type: 'installSpecKitExtension' });
                } else if (action === 'openReadme') {
                    vscode.postMessage({ type: 'openReadme' });
                }
            });
        })();
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
