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
import { calculateWorkflowPhase, getDocTypeLabel } from '../phaseCalculation';
import { generateCompactNav } from './navigation';
import { SpecStatuses } from '../../../core/constants';

/**
 * Build the structured header HTML from spec-context.json data.
 * Line 1: badge + created date
 * Line 2: {DocType}: {specName}
 * Line 3: file link + branch badge
 * Separator
 */
function buildHeaderHtml(
    badgeText?: string | null,
    createdDate?: string | null,
    specName?: string | null,
    filePath?: string | null,
    branch?: string | null,
    step?: string | null
): string {
    // If no context data at all, render nothing
    if (!badgeText && !createdDate && !specName) return '';

    const hasContext = !!(badgeText || specName);
    const docTypeLabel = getDocTypeLabel(step);
    const titleText = specName
        ? `<span class="spec-header-doctype">${escapeHtml(docTypeLabel)}:</span> ${escapeHtml(specName)}`
        : '';

    const branchHtml = branch
        ? `<span class="spec-header-branch"><span class="branch-icon">&#xea68;</span> ${escapeHtml(branch)}</span>`
        : '';

    return `<div class="spec-header" data-has-context="${hasContext}">
        <div class="spec-header-row-1">
            ${badgeText ? `<span class="spec-badge">${escapeHtml(badgeText)}</span>` : ''}
            ${createdDate ? `<span class="spec-date"><span class="meta-label">Created:</span> <span class="meta-date">${escapeHtml(createdDate)}</span></span>` : ''}
        </div>
        ${titleText ? `<div class="spec-header-title">${titleText}</div>` : ''}
        ${branchHtml ? `<div class="spec-header-row-3">${branchHtml}</div>` : ''}
        <hr class="spec-header-separator">
    </div>`;
}

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

    // Split documents by category
    const coreDocs = documents.filter(d => d.category === 'core');
    const relatedDocs = documents.filter(d => d.category === 'related');

    // Generate content or empty state
    const contentHtml = content
        ? `<div id="markdown-content" data-raw="${escapeHtmlAttribute(content)}"></div>`
        : `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;

    // Determine if viewing a related doc
    const coreDocTypes = coreDocs.map(d => d.type);
    const isViewingRelatedDoc = !coreDocTypes.includes(currentDocType);

    // CTA button logic:
    // - Active + tasks < 100%: show next step label or "Implement"
    // - Active + tasks = 100%: show "Complete" as primary CTA
    // - Completed/Archived: no CTA
    const isTasksDone = specStatus === SpecStatuses.TASKS_DONE;
    let showApproveButton = false;
    let approveText = '';

    if (specStatus === SpecStatuses.ACTIVE) {
        // Normal CTA logic: show next step or Implement
        let currentIndex = coreDocs.findIndex(d => d.type === currentDocType);
        if (currentIndex < 0 && isViewingRelatedDoc) {
            const parentStep = relatedDocs.find(d => d.type === currentDocType)?.parentStep;
            if (parentStep) {
                currentIndex = coreDocs.findIndex(d => d.type === parentStep);
            }
        }
        if (currentIndex >= 0 && currentIndex < coreDocs.length - 1) {
            const nextDoc = coreDocs[currentIndex + 1];
            if (!nextDoc.exists) {
                showApproveButton = true;
                approveText = nextDoc.label;
            }
        } else if (currentIndex === coreDocs.length - 1) {
            showApproveButton = true;
            approveText = 'Implement';
        }
    }

    // Calculate workflow phase (where we ARE in spec-driven development)
    const workflowPhase = calculateWorkflowPhase(coreDocs);

    // Generate the new compact nav
    const navHtml = generateCompactNav(
        coreDocs,
        relatedDocs,
        currentDocType,
        workflowPhase,
        isViewingRelatedDoc,
        taskCompletionPercent,
        stalenessMap,
        activeStep,
        stepHistory
    );

    // Stale warning banner (between nav and content)
    const currentStaleness = stalenessMap?.[currentDocType];
    const staleBannerHtml = currentStaleness?.isStale
        ? `<div class="stale-banner" id="stale-banner">
            <span class="stale-banner-message">${escapeHtml(currentStaleness.staleReason)}</span>
            <button id="stale-regen" class="stale-regen-btn">Regenerate</button>
        </div>`
        : '<div class="stale-banner" id="stale-banner" style="display: none;"></div>';

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
        ${navHtml}
        ${staleBannerHtml}

        <main class="content-area" id="content-area">
            ${buildHeaderHtml(badgeText, createdDate, contextSpecName, currentFilePath, contextBranch, currentStep)}
            ${contentHtml}
        </main>

        <footer class="actions">
            <div class="actions-left">
                <button id="editSource" class="secondary">Edit Source</button>
                ${specStatus !== SpecStatuses.ARCHIVED ? `<button id="archiveSpec" class="secondary">Archive</button>` : ''}
                <span class="action-toast" id="action-toast"></span>
                ${enhancementButtons.map((btn, i) => `
                <button class="enhancement" data-command="${btn.command}" title="${btn.tooltip || ''}" id="enhance-${i}">
                    <span class="icon">${btn.icon}</span>
                    ${btn.label}
                </button>
                `).join('')}
            </div>
            <div class="actions-right">
                ${specStatus === SpecStatuses.ARCHIVED ? `
                <button id="reactivateSpec" class="secondary">Reactivate</button>
                ` : specStatus === SpecStatuses.COMPLETED ? `
                <button id="reactivateSpec" class="secondary">Reactivate</button>
                ` : isTasksDone ? `
                <button id="completeSpec" class="primary">Complete</button>
                ` : `
                <button id="regenerate" class="secondary">Regenerate</button>
                ${showApproveButton ? `<button id="approve" class="primary">${approveText}</button>` : ''}
                `}
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
