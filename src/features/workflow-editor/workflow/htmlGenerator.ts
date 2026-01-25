import * as vscode from "vscode";
import type { SpecInfo } from "../../../core/types";

/**
 * Generate HTML for the workflow editor webview
 */
export function generateWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  content: string,
  specInfo: SpecInfo,
): string {
  // Get URIs for webview resources (built from webview-src to dist/webview)
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "workflow.css"),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "workflow.js"),
  );

  const nonce = generateNonce();

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'none';
                       style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net;
                       script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;
                       img-src ${webview.cspSource} data: https:;">
        <link href="${styleUri}" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
        <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
        <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/highlight.min.js"></script>
        <title>Spec Workflow Editor</title>
    </head>
    <body>
        <div class="workflow-editor">
            ${generatePhaseStepper(specInfo)}

            ${specInfo.allDocs.length > 1 ? generateDocTabs(specInfo) : ""}

            <main class="content" id="content">
                <div class="loading">Loading...</div>
            </main>

            ${generateFooter(specInfo)}
        </div>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const initialContent = ${JSON.stringify(content)};
            const specInfo = ${JSON.stringify(specInfo)};

            // Initialize mermaid with dark theme
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#3b82f6',
                    primaryTextColor: '#fafafa',
                    primaryBorderColor: '#3b82f6',
                    lineColor: '#666666',
                    secondaryColor: '#1a1a1a',
                    tertiaryColor: '#141414',
                    background: '#0a0a0a',
                    mainBkg: '#1a1a1a',
                    secondBkg: '#141414'
                }
            });

        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

/**
 * Generate the phase stepper navigation
 * - "active" = currently viewing this phase (blue ring)
 * - "completed" = file exists (green checkmark)
 * - Done shows progress percentage or checkmark when 100%
 */
function generatePhaseStepper(specInfo: SpecInfo): string {
  const phase1Complete = specInfo.completedPhases.includes(1);
  const phase2Complete = specInfo.completedPhases.includes(2);
  const phase3Complete = specInfo.completedPhases.includes(3);
  const taskPercent = specInfo.taskCompletionPercent || 0;
  const allTasksDone = taskPercent === 100;

  // Done indicator: checkmark if 100%, percentage if in progress, "4" if not started
  let doneIndicator = "4";
  let doneClass = "";
  if (allTasksDone) {
    doneIndicator = "✓";
    doneClass = "completed";
  } else if (phase3Complete && taskPercent > 0) {
    doneIndicator = `${taskPercent}%`;
    doneClass = "in-progress";
  }

  // Customize Done step content based on completion
  let doneStepHtml = "";

  if (allTasksDone) {
    doneStepHtml = `
            <div class="step spec-completed-badge" data-phase="done">
                <span class="badge-icon">🌱</span>
                <span class="badge-text">SPEC COMPLETED</span>
            </div>`;
  } else {
    doneStepHtml = `
            <div class="step ${doneClass}" data-phase="done">
                <div class="step-indicator">${doneIndicator}</div>
                <div class="step-label">Done</div>
            </div>`;
  }

  return `
        <nav class="phase-stepper">
            <div class="step ${specInfo.currentPhase === 1 ? "active" : ""} ${phase1Complete ? "completed" : ""}" data-phase="spec">
                <div class="step-indicator">${phase1Complete ? "✓" : "1"}</div>
                <div class="step-label">Spec</div>
            </div>
            <div class="step-connector ${phase1Complete ? "completed" : ""}"></div>
            <div class="step ${specInfo.currentPhase === 2 ? "active" : ""} ${phase2Complete ? "completed" : ""}" data-phase="plan">
                <div class="step-indicator">${phase2Complete ? "✓" : "2"}</div>
                <div class="step-label">Plan</div>
            </div>
            <div class="step-connector ${phase2Complete ? "completed" : ""}"></div>
            <div class="step ${specInfo.currentPhase === 3 ? "active" : ""} ${phase3Complete ? "completed" : ""}" data-phase="tasks">
                <div class="step-indicator">${phase3Complete ? "✓" : "3"}</div>
                <div class="step-label">Tasks</div>
            </div>
            <div class="step-connector ${phase3Complete ? "completed" : ""}"></div>
            ${doneStepHtml}
        </nav>`;
}

/**
 * Generate document tabs for related docs
 */
function generateDocTabs(specInfo: SpecInfo): string {
  return `
        <div class="doc-tabs">
            ${specInfo.allDocs
              .map(
                doc => `
                <button class="doc-tab ${doc.fileName === specInfo.currentFileName ? "active" : ""}" data-file="${doc.fileName}">
                    ${doc.name}
                </button>
            `,
              )
              .join("")}
        </div>`;
}

/**
 * Generate the footer with action buttons
 */
function generateFooter(specInfo: SpecInfo): string {
  return `
        <footer class="actions">
            <div class="actions-left">
                ${
                  specInfo.enhancementButton
                    ? `
                    <button id="enhance" class="enhancement" data-command="${specInfo.enhancementButton.command}" title="${specInfo.enhancementButton.tooltip || ""}">
                        <span class="icon">${specInfo.enhancementButton.icon}</span>
                        ${specInfo.enhancementButton.label}
                    </button>
                `
                    : ""
                }
            </div>
            <div class="actions-right">
                <button id="editSource" class="secondary">Edit Source</button>
                <button id="regenerate" class="secondary">Regenerate</button>
                <button id="approve" class="primary">${specInfo.nextPhaseExists ? "→ Go to Next Phase" : "✓ Approve & Next Phase"}</button>
            </div>
        </footer>`;
}

/**
 * Generate a random nonce for CSP
 */
export function generateNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
