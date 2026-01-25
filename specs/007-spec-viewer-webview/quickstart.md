# Quickstart: Unified Spec Viewer Webview Panel

**Date**: 2026-01-13 | **Feature**: 007-spec-viewer-webview

## Overview

This guide provides the essential implementation steps for the Spec Viewer feature. Follow these steps in order to implement the unified webview panel for viewing spec documents.

---

## Step 1: Create Feature Module Structure

Create the following files in the extension:

```bash
# Extension-side files
mkdir -p src/features/spec-viewer
touch src/features/spec-viewer/index.ts
touch src/features/spec-viewer/types.ts
touch src/features/spec-viewer/specViewerProvider.ts
touch src/features/spec-viewer/specViewerCommands.ts

# Webview-side files
mkdir -p webview/src/spec-viewer
touch webview/src/spec-viewer/index.ts
touch webview/src/spec-viewer/types.ts

# Styles
touch webview/styles/spec-viewer.css
```

---

## Step 2: Define Types

In `src/features/spec-viewer/types.ts`:

```typescript
import * as vscode from 'vscode';

export type CoreDocumentType = 'spec' | 'plan' | 'tasks';
export type DocumentType = CoreDocumentType | string;

export interface SpecDocument {
    type: DocumentType;
    displayName: string;
    fileName: string;
    filePath: string;
    exists: boolean;
    isCore: boolean;
}

export interface SpecViewerState {
    specName: string;
    specDirectory: string;
    currentDocument: DocumentType;
    availableDocuments: SpecDocument[];
    lastUpdated: number;
}

export type ExtensionToViewerMessage =
    | { type: 'contentUpdated'; content: string; documentType: DocumentType; specName: string }
    | { type: 'documentsUpdated'; documents: SpecDocument[]; currentDocument: DocumentType }
    | { type: 'error'; message: string; recoverable: boolean }
    | { type: 'fileDeleted'; filePath: string };

export type ViewerToExtensionMessage =
    | { type: 'switchDocument'; documentType: DocumentType }
    | { type: 'editDocument' }
    | { type: 'refreshContent' }
    | { type: 'ready' };
```

---

## Step 3: Implement SpecViewerProvider

In `src/features/spec-viewer/specViewerProvider.ts`:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { SpecViewerState, SpecDocument, DocumentType, ExtensionToViewerMessage, ViewerToExtensionMessage } from './types';

export class SpecViewerProvider {
    private panel: vscode.WebviewPanel | undefined;
    private state: SpecViewerState | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    public async show(filePath: string): Promise<void> {
        const specDirectory = this.getSpecDirectory(filePath);
        const documentType = this.getDocumentType(filePath);

        if (this.panel) {
            await this.updateContent(specDirectory, documentType);
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        await this.createPanel(specDirectory, documentType);
    }

    private async createPanel(specDirectory: string, documentType: DocumentType): Promise<void> {
        const specName = path.basename(specDirectory);

        this.panel = vscode.window.createWebviewPanel(
            'speckit.specViewer',
            `Spec: ${specName}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
                ]
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.state = undefined;
        });

        this.setupMessageHandling();
        await this.updateContent(specDirectory, documentType);
    }

    private setupMessageHandling(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(async (message: ViewerToExtensionMessage) => {
            switch (message.type) {
                case 'switchDocument':
                    await this.switchDocument(message.documentType);
                    break;
                case 'editDocument':
                    await this.openInEditor();
                    break;
                case 'refreshContent':
                    await this.refresh();
                    break;
            }
        });
    }

    private async updateContent(specDirectory: string, documentType: DocumentType): Promise<void> {
        // Scan for available documents
        const documents = await this.scanDocuments(specDirectory);
        const specName = path.basename(specDirectory);

        // Find the requested document
        const doc = documents.find(d => d.type === documentType) || documents[0];

        // Read content
        let content = '';
        if (doc?.exists) {
            try {
                const uri = vscode.Uri.file(doc.filePath);
                const data = await vscode.workspace.fs.readFile(uri);
                content = Buffer.from(data).toString('utf-8');
            } catch (error) {
                this.outputChannel.appendLine(`[SpecViewer] Error reading ${doc.filePath}: ${error}`);
            }
        }

        // Update state
        this.state = {
            specName,
            specDirectory,
            currentDocument: doc?.type || 'spec',
            availableDocuments: documents,
            lastUpdated: Date.now()
        };

        // Update panel title
        if (this.panel) {
            this.panel.title = `Spec: ${specName} - ${doc?.displayName || 'Spec'}`;
            this.panel.webview.html = this.generateHtml(content, documents, doc?.type || 'spec', specName);
        }
    }

    // ... additional methods (see full implementation)
}
```

---

## Step 4: Register Commands

In `src/features/spec-viewer/specViewerCommands.ts`:

```typescript
import * as vscode from 'vscode';
import { SpecViewerProvider } from './specViewerProvider';

export function registerSpecViewerCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): SpecViewerProvider {
    const provider = new SpecViewerProvider(context, outputChannel);

    // Register command to view spec documents
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.viewSpecDocument', (filePath: string) => {
            provider.show(filePath);
        })
    );

    return provider;
}
```

---

## Step 5: Create Webview Entry Point

In `webview/src/spec-viewer/index.ts`:

```typescript
declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

function init(): void {
    setupTabNavigation();
    setupEditButton();
    setupMessageListener();
    vscode.postMessage({ type: 'ready' });
}

function setupTabNavigation(): void {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const docType = (btn as HTMLElement).dataset.doc;
            if (docType) {
                vscode.postMessage({ type: 'switchDocument', documentType: docType });
            }
        });
    });
}

function setupEditButton(): void {
    const editBtn = document.getElementById('edit-button');
    editBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'editDocument' });
    });
}

function setupMessageListener(): void {
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'contentUpdated') {
            updateContent(message.content);
        }
    });
}

function updateContent(markdown: string): void {
    const contentEl = document.getElementById('content');
    if (contentEl) {
        contentEl.innerHTML = renderMarkdown(markdown);
        // Apply syntax highlighting
        (window as any).hljs?.highlightAll?.();
    }
}

document.addEventListener('DOMContentLoaded', init);
```

---

## Step 6: Create Styles

In `webview/styles/spec-viewer.css`:

```css
:root {
    --tab-height: 40px;
    --header-height: 48px;
}

body {
    margin: 0;
    padding: 0;
    font-family: var(--vscode-font-family);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
}

.viewer-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

/* Header */
.viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px;
    height: var(--header-height);
    border-bottom: 1px solid var(--vscode-panel-border);
}

/* Tab Navigation */
.spec-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
}

.tab-button {
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    border-radius: 4px;
}

.tab-button:hover {
    background: var(--vscode-list-hoverBackground);
}

.tab-button.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

/* Content Area */
.content-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
}

/* Edit Button */
.edit-button {
    padding: 6px 12px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.edit-button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
```

---

## Step 7: Update Webpack Config

Add spec-viewer entry point to `webpack.config.js`:

```javascript
// Add to module.exports array
{
    entry: './webview/src/spec-viewer/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist', 'webview'),
        filename: 'spec-viewer.js',
    },
    // ... copy spec-viewer.css
}
```

---

## Step 8: Integrate with Extension

In `src/extension.ts`:

```typescript
import { registerSpecViewerCommands } from './features/spec-viewer';

export async function activate(context: vscode.ExtensionContext) {
    // ... existing code ...

    // Register spec viewer
    const specViewer = registerSpecViewerCommands(context, outputChannel);

    // Update openSpecFile command to use viewer
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.openSpecFile', async (filePath: string) => {
            if (isSpecDocument(filePath)) {
                specViewer.show(filePath);
            } else {
                await openSpecFile(filePath, { outputChannel });
            }
        })
    );
}
```

---

## Step 9: Setup File Watcher

In `src/core/fileWatchers.ts`, add:

```typescript
export function setupSpecViewerWatcher(
    specViewer: SpecViewerProvider,
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/specs/**/*.md');

    let debounceTimer: NodeJS.Timeout | undefined;

    const handleChange = (uri: vscode.Uri) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            specViewer.refreshIfDisplaying(uri.fsPath);
        }, 500);
    };

    watcher.onDidChange(handleChange);
    watcher.onDidCreate(handleChange);
    watcher.onDidDelete((uri) => specViewer.handleFileDeleted(uri.fsPath));

    context.subscriptions.push(watcher);
}
```

---

## Verification Checklist

After implementation, verify:

- [ ] Clicking spec/plan/tasks in tree view opens viewer panel
- [ ] Panel reuses same instance (no new tabs)
- [ ] Tab navigation switches between documents
- [ ] Edit button opens file in standard editor
- [ ] File changes auto-refresh content (<2s)
- [ ] Empty documents show appropriate message
- [ ] Panel title shows spec name and current document
- [ ] Theming works (light/dark/high-contrast)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/features/spec-viewer/types.ts` | Type definitions |
| `src/features/spec-viewer/specViewerProvider.ts` | Main provider |
| `src/features/spec-viewer/specViewerCommands.ts` | Command registration |
| `webview/src/spec-viewer/index.ts` | Webview entry |
| `webview/styles/spec-viewer.css` | Viewer styles |
| `src/extension.ts` | Integration point |
