# Quickstart: Spec Editor Webview

**Feature**: 004-spec-editor-webview | **Date**: 2026-01-02

## Overview

This document provides implementation guidance for adding a webview-based spec editor to the SpecKit Companion extension.

## Prerequisites

- Node.js 18+
- VS Code ^1.84.0
- Extension development environment set up (`npm install` completed)
- Familiarity with VS Code Extension API (webviews)

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          VS Code                                   │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌─────────────────────────────────┐   │
│  │   Extension Host     │    │          Webview Panel          │   │
│  │   (Node.js)          │    │          (Browser)              │   │
│  │                      │    │                                 │   │
│  │  specEditorProvider  │◄──►│  webview/src/spec-editor/      │   │
│  │  tempFileManager     │    │  - editor.ts                   │   │
│  │  specDraftManager    │    │  - imageAttachment.ts          │   │
│  │                      │    │  - preview.ts                  │   │
│  └──────────────────────┘    └─────────────────────────────────┘   │
│              │                            ▲                        │
│              │                            │                        │
│              ▼                            │                        │
│  ┌──────────────────────┐                │                        │
│  │   AI Provider        │                │                        │
│  │   (IAIProvider)      │                │                        │
│  │                      │    postMessage │                        │
│  │  executeInTerminal() │◄───────────────┘                        │
│  └──────────────────────┘                                          │
│              │                                                     │
│              ▼                                                     │
│  ┌──────────────────────┐                                          │
│  │   globalStorageUri   │                                          │
│  │   /spec-editor/      │                                          │
│  └──────────────────────┘                                          │
└────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Feature Module Structure

```bash
mkdir -p src/features/spec-editor
mkdir -p webview/src/spec-editor
```

Create the following files:

```
src/features/spec-editor/
├── index.ts              # Module exports
├── types.ts              # TypeScript interfaces
├── specEditorProvider.ts # WebviewPanel provider
├── specEditorCommands.ts # Command registration
├── specDraftManager.ts   # Draft persistence
└── tempFileManager.ts    # Temp file management

webview/src/spec-editor/
├── index.ts              # Entry point
├── editor.ts             # Text editor component
├── imageAttachment.ts    # Image handling
└── preview.ts            # Preview rendering

webview/styles/
└── spec-editor.css       # Styles
```

### Step 2: Define Types

**File**: `src/features/spec-editor/types.ts`

```typescript
export interface SpecEditorSession {
    id: string;
    specName?: string;
    createdAt: number;
    status: 'editing' | 'previewing' | 'submitting' | 'completed';
}

export interface SpecDraft {
    sessionId: string;
    content: string;
    cursorPosition: number;
    lastSaved: number;
}

export interface AttachedImage {
    id: string;
    sessionId: string;
    originalName: string;
    format: 'png' | 'jpg' | 'gif' | 'webp';
    size: number;
    dimensions?: { width: number; height: number };
    thumbnailDataUri: string;
    filePath: string;
    addedAt: number;
}

export interface TempSpecFile {
    id: string;
    sessionId: string;
    markdownFilePath: string;
    imageFilePaths: Record<string, string>;
    createdAt: number;
    expiresAt: number;
    status: 'active' | 'submitted' | 'completed' | 'orphaned';
}

// Message types
export type SpecEditorToExtensionMessage =
    | { type: 'submit'; content: string; images: string[] }
    | { type: 'preview' }
    | { type: 'attachImage'; name: string; size: number; dataUri: string }
    | { type: 'removeImage'; imageId: string }
    | { type: 'loadTemplate'; specPath: string }
    | { type: 'cancel' };

export type ExtensionToSpecEditorMessage =
    | { type: 'imageSaved'; imageId: string; thumbnailUri: string }
    | { type: 'imageRemoved'; imageId: string }
    | { type: 'templateLoaded'; content: string }
    | { type: 'previewContent'; markdown: string }
    | { type: 'error'; message: string };
```

### Step 3: Implement SpecEditorProvider

**File**: `src/features/spec-editor/specEditorProvider.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TempFileManager } from './tempFileManager';
import { SpecDraftManager } from './specDraftManager';
import { getAIProvider } from '../../ai-providers';
import type { SpecEditorToExtensionMessage, AttachedImage } from './types';

export class SpecEditorProvider {
    private panel: vscode.WebviewPanel | undefined;
    private sessionId: string | undefined;
    private attachedImages: Map<string, AttachedImage> = new Map();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly tempFileManager: TempFileManager,
        private readonly draftManager: SpecDraftManager
    ) {}

    public async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.sessionId = uuidv4();
        this.attachedImages.clear();

        this.panel = vscode.window.createWebviewPanel(
            'speckit.specEditor',
            'New Spec',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
                    this.context.globalStorageUri
                ]
            }
        );

        this.panel.webview.html = this.getWebviewHtml(this.panel.webview);

        this.panel.webview.onDidReceiveMessage(
            (message: SpecEditorToExtensionMessage) => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.sessionId = undefined;
        });
    }

    private async handleMessage(message: SpecEditorToExtensionMessage): Promise<void> {
        switch (message.type) {
            case 'submit':
                await this.handleSubmit(message.content, message.images);
                break;

            case 'attachImage':
                await this.handleAttachImage(message.name, message.size, message.dataUri);
                break;

            case 'removeImage':
                await this.handleRemoveImage(message.imageId);
                break;

            case 'preview':
                await this.handlePreview();
                break;

            case 'loadTemplate':
                await this.handleLoadTemplate(message.specPath);
                break;

            case 'cancel':
                this.panel?.dispose();
                break;
        }
    }

    private async handleSubmit(content: string, imageIds: string[]): Promise<void> {
        if (!this.sessionId) return;

        try {
            // Create temp file set
            const images = imageIds
                .map(id => this.attachedImages.get(id))
                .filter((img): img is AttachedImage => img !== undefined);

            const tempFileSet = await this.tempFileManager.createTempFileSet(
                this.sessionId,
                content,
                images
            );

            // Get AI provider and execute
            const provider = getAIProvider(this.context, this.outputChannel);
            const markdown = await this.tempFileManager.generateMarkdown(
                tempFileSet.id,
                content,
                images
            );

            await provider.executeInTerminal(markdown, 'SpecKit - New Spec');

            // Mark as submitted
            await this.tempFileManager.markSubmitted(tempFileSet.id);

            // Close panel
            this.panel?.dispose();

        } catch (error) {
            this.panel?.webview.postMessage({
                type: 'error',
                message: `Failed to submit spec: ${error}`
            });
        }
    }

    private async handleAttachImage(
        name: string,
        size: number,
        dataUri: string
    ): Promise<void> {
        if (!this.sessionId) return;

        // Validate size
        if (size > 2 * 1024 * 1024) {
            this.panel?.webview.postMessage({
                type: 'error',
                message: 'Image exceeds 2MB limit'
            });
            return;
        }

        // Check total size
        const totalSize = Array.from(this.attachedImages.values())
            .reduce((sum, img) => sum + img.size, 0) + size;

        if (totalSize > 10 * 1024 * 1024) {
            this.panel?.webview.postMessage({
                type: 'error',
                message: 'Total attachments exceed 10MB limit'
            });
            return;
        }

        try {
            const image = await this.tempFileManager.saveImage(
                this.sessionId,
                name,
                dataUri
            );

            this.attachedImages.set(image.id, image);

            // Convert file path to webview URI for thumbnail
            const thumbnailUri = this.panel?.webview.asWebviewUri(
                vscode.Uri.file(image.filePath)
            );

            this.panel?.webview.postMessage({
                type: 'imageSaved',
                imageId: image.id,
                thumbnailUri: thumbnailUri?.toString() || image.thumbnailDataUri
            });

        } catch (error) {
            this.panel?.webview.postMessage({
                type: 'error',
                message: `Failed to attach image: ${error}`
            });
        }
    }

    private async handleRemoveImage(imageId: string): Promise<void> {
        const image = this.attachedImages.get(imageId);
        if (!image) return;

        try {
            await this.tempFileManager.deleteImage(image.filePath);
            this.attachedImages.delete(imageId);

            this.panel?.webview.postMessage({
                type: 'imageRemoved',
                imageId
            });
        } catch (error) {
            this.outputChannel.appendLine(`Failed to remove image: ${error}`);
        }
    }

    private async handlePreview(): Promise<void> {
        // Request current content from webview
        // Then generate preview markdown
    }

    private async handleLoadTemplate(specPath: string): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(
                vscode.Uri.file(specPath)
            );

            this.panel?.webview.postMessage({
                type: 'templateLoaded',
                content: Buffer.from(content).toString('utf-8')
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                type: 'error',
                message: `Failed to load template: ${error}`
            });
        }
    }

    private getWebviewHtml(webview: vscode.Webview): string {
        // Generate HTML with proper CSP and resource URIs
        // Similar to workflowEditorProvider.ts htmlGenerator
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spec Editor</title>
</head>
<body>
    <div id="app"></div>
    <script>
        // Webview code bundled by webpack
    </script>
</body>
</html>`;
    }
}
```

### Step 4: Implement TempFileManager

**File**: `src/features/spec-editor/tempFileManager.ts`

See data-model.md for full interface. Key methods:

```typescript
export class TempFileManager {
    private manifestPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.manifestPath = path.join(
            this.context.globalStorageUri.fsPath,
            'spec-editor',
            'manifest.json'
        );
    }

    async createTempFileSet(
        sessionId: string,
        content: string,
        images: AttachedImage[]
    ): Promise<TempSpecFile> {
        // Implementation
    }

    async saveImage(
        sessionId: string,
        name: string,
        dataUri: string
    ): Promise<AttachedImage> {
        // Implementation
    }

    async cleanupOrphanedFiles(): Promise<string[]> {
        // Run on extension activation
    }
}
```

### Step 5: Register Commands

**File**: `src/features/spec-editor/specEditorCommands.ts`

```typescript
export function registerSpecEditorCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    const tempFileManager = new TempFileManager(context);
    const draftManager = new SpecDraftManager(context);
    const provider = new SpecEditorProvider(
        context,
        outputChannel,
        tempFileManager,
        draftManager
    );

    // Open spec editor
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.openSpecEditor', () => {
            provider.show();
        })
    );

    // Cleanup orphaned files on activation
    tempFileManager.cleanupOrphanedFiles().then(orphans => {
        if (orphans.length > 0) {
            outputChannel.appendLine(
                `[SpecEditor] Cleaned up ${orphans.length} orphaned files`
            );
        }
    });
}
```

### Step 6: Update Extension Entry Point

**File**: `src/extension.ts`

```typescript
import { registerSpecEditorCommands } from './features/spec-editor';

export async function activate(context: vscode.ExtensionContext) {
    // ... existing code ...

    // Register spec editor
    registerSpecEditorCommands(context, outputChannel);
}
```

### Step 7: Update package.json

Add command and keybinding:

```json
{
    "contributes": {
        "commands": [
            {
                "command": "speckit.openSpecEditor",
                "title": "Open Spec Editor",
                "category": "SpecKit",
                "icon": "$(edit)"
            }
        ],
        "keybindings": [
            {
                "command": "speckit.openSpecEditor",
                "key": "ctrl+shift+s",
                "mac": "cmd+shift+s",
                "when": "speckit.detected"
            }
        ]
    }
}
```

### Step 8: Implement Webview UI

**File**: `webview/src/spec-editor/index.ts`

```typescript
import { editor } from './editor';
import { imageAttachment } from './imageAttachment';
import { preview } from './preview';

declare const acquireVsCodeApi: () => {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

// Initialize components
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (!app) return;

    // Restore draft state
    const savedState = vscode.getState();

    // Create editor
    const editorEl = editor.create(savedState?.content || '');

    // Create image attachment area
    const imageEl = imageAttachment.create(vscode);

    // Create action buttons
    const actionsEl = createActions();

    app.appendChild(editorEl);
    app.appendChild(imageEl);
    app.appendChild(actionsEl);

    // Auto-save draft
    editorEl.addEventListener('input', () => {
        vscode.setState({
            content: editorEl.value,
            cursorPosition: editorEl.selectionStart
        });
    });
});

function createActions(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'spec-editor-actions';

    const previewBtn = document.createElement('button');
    previewBtn.textContent = 'Preview';
    previewBtn.onclick = () => vscode.postMessage({ type: 'preview' });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Submit to AI';
    submitBtn.onclick = () => {
        const content = document.querySelector('textarea')?.value || '';
        const images = imageAttachment.getAttachedImageIds();
        vscode.postMessage({ type: 'submit', content, images });
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => vscode.postMessage({ type: 'cancel' });

    container.appendChild(previewBtn);
    container.appendChild(submitBtn);
    container.appendChild(cancelBtn);

    return container;
}
```

## Testing

### Unit Tests

```typescript
// src/features/spec-editor/__tests__/tempFileManager.test.ts
describe('TempFileManager', () => {
    it('creates temp file set with unique ID', async () => {
        // Test implementation
    });

    it('cleans up files older than threshold', async () => {
        // Test implementation
    });

    it('handles partial cleanup failures gracefully', async () => {
        // Test implementation
    });
});
```

### Manual Testing Checklist

- [ ] Open spec editor via command
- [ ] Type multi-line content, verify formatting preserved
- [ ] Attach image via file picker
- [ ] Attach image via drag-and-drop
- [ ] Verify image size limit enforced
- [ ] Preview spec content
- [ ] Submit spec, verify temp files created
- [ ] Close editor without submitting, reopen, verify draft restored
- [ ] Complete workflow, verify temp files cleaned up
- [ ] Restart VS Code, verify orphaned files cleaned up

## Common Issues

### Issue: Images not displaying in webview

**Solution**: Ensure `localResourceRoots` includes the globalStorageUri and use `webview.asWebviewUri()` for file paths.

### Issue: Draft not persisting

**Solution**: Verify `vscode.getState()` / `vscode.setState()` are called correctly. Check browser console for errors.

### Issue: Temp files not cleaned up

**Solution**: Check manifest.json for stuck entries. Verify cleanup is triggered on startup and workflow completion.

## Resources

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Existing WorkflowEditorProvider](../../../src/features/workflow-editor/workflowEditorProvider.ts)
- [Existing ClaudeCodeProvider temp file pattern](../../../src/ai-providers/claudeCodeProvider.ts)
