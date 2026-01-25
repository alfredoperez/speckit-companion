# Research: Spec Editor Webview

**Feature**: 004-spec-editor-webview | **Date**: 2026-01-02

## Research Areas

Based on the Technical Context and spec requirements, the following research was conducted:

1. WebviewPanel vs CustomTextEditorProvider selection
2. Image handling in VS Code webviews
3. State persistence patterns for drafts
4. Temporary file management for cross-CLI compatibility
5. Webview-to-extension messaging patterns

---

## 1. WebviewPanel vs CustomTextEditorProvider

### Decision: Use WebviewPanel (not CustomTextEditorProvider)

### Rationale

The existing `WorkflowEditorProvider` uses `CustomTextEditorProvider` because it edits existing spec documents (spec.md, plan.md, tasks.md). However, the Spec Editor Webview has different requirements:

| Requirement | CustomTextEditorProvider | WebviewPanel |
|-------------|--------------------------|--------------|
| Creates NEW content (not editing existing files) | Limited | **Ideal** |
| Multi-line text composition before submission | Possible but awkward | **Natural fit** |
| Image attachments before file creation | Requires temp document | **Native** |
| Draft persistence without file | Needs workaround | **Built-in via getState/setState** |
| Submit to AI CLI (not save to file) | File-centric | **Action-centric** |

### Alternatives Considered

1. **CustomTextEditorProvider** - Rejected: This is designed for editing existing documents. The spec editor creates new content that doesn't exist as a file until submission.

2. **Simple vscode.window.showInputBox** - Rejected: Limited to single-line input, no image support, no rich editing.

3. **Quick input with multi-step** - Rejected: Still limited for multi-line content, no image attachments.

---

## 2. Image Handling in VS Code Webviews

### Decision: File input picker + optional drag-and-drop, external storage

### Security Requirements

VS Code webviews have strict Content Security Policy (CSP). Images must be:
- Converted via `webview.asWebviewUri()` for local file access
- Added to `localResourceRoots` for the webview
- Or embedded as data URIs

### Image Storage Strategy

**Decision**: External image storage with relative references

```
globalStorageUri/
└── spec-editor/
    └── {sessionId}/
        ├── spec-content.md     # Main content
        └── images/
            ├── image-001.jpg
            ├── image-002.png
            └── image-003.webp
```

### Rationale

- CLI tools can read images directly via file path
- Clean separation of content and attachments
- Works with all AI CLI providers
- Easier to manage size limits (2MB per image, 10MB total)

### Alternatives Considered

1. **Base64 embedding** - Rejected: 33% size overhead, poor CLI compatibility, huge markdown files.

2. **Mixed strategy (small=base64, large=file)** - Rejected: Adds complexity without significant benefit.

### Implementation Pattern

```typescript
// In webview (browser context)
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
fileInput.multiple = true;

fileInput.addEventListener('change', (e) => {
    for (const file of e.target.files) {
        const reader = new FileReader();
        reader.onload = (event) => {
            vscode.postMessage({
                type: 'attachImage',
                name: file.name,
                size: file.size,
                dataUri: event.target.result
            });
        };
        reader.readAsDataURL(file);
    }
});
```

### Drag-and-Drop Limitations

- OS file system drag-and-drop: Works reliably
- VS Code Explorer drag-and-drop: Inconsistent (VS Code issue #182449)
- Recommendation: Primary UI is file picker button, drag-drop is optional enhancement

---

## 3. State Persistence Patterns

### Decision: Use vscode.getState/setState for draft persistence

### Rationale

The VS Code webview API provides `getState()` and `setState()` which:
- Survives webview hide/show cycles
- Persists draft content without creating files
- No extension-side storage overhead
- Automatic cleanup when panel is closed

### Implementation Pattern

```typescript
// In webview (browser context)
const vscode = acquireVsCodeApi();

// Save draft on every input
function saveDraft() {
    vscode.setState({
        draftContent: textarea.value,
        attachedImages: getAttachedImageIds(),
        cursorPosition: textarea.selectionStart,
        lastSaved: Date.now()
    });
}

// Restore on webview load
function restoreDraft() {
    const state = vscode.getState();
    if (state?.draftContent) {
        textarea.value = state.draftContent;
        textarea.selectionStart = state.cursorPosition;
        // Restore image references...
    }
}

textarea.addEventListener('input', saveDraft);
window.addEventListener('load', restoreDraft);
```

### Alternatives Considered

1. **retainContextWhenHidden: true** - Rejected: High memory overhead, unnecessary since getState works.

2. **Extension-side storage (workspaceState)** - Rejected: More complex, not needed for ephemeral drafts.

3. **WebviewPanelSerializer** - Rejected: Overkill for drafts, designed for session persistence across editor restarts.

---

## 4. Temporary File Management

### Decision: TempFileManager with manifest-based tracking and hybrid cleanup

### Current Implementation Analysis

The existing pattern in `claudeCodeProvider.ts` (lines 49-57, 114-121):
- Creates files in `context.globalStorageUri`
- Uses timestamp-based naming: `${prefix}-${Date.now()}.md`
- Cleanup via setTimeout after 30 seconds
- No cross-session tracking
- Single file per prompt

### Proposed Enhancement for Spec Editor

```typescript
interface TempFileSet {
    id: string;                    // Session UUID
    specId: string;                // Feature spec name
    markdownFile: string;          // Path to temp markdown
    imageFiles: Map<string, ImageInfo>;
    createdAt: number;
    expiresAt: number;
    status: 'active' | 'submitted' | 'completed' | 'orphaned';
}

interface TempFileManifest {
    version: string;
    files: Map<string, TempFileSet>;
    lastCleanup: number;
}
```

### Cleanup Strategy: Hybrid Approach

| Phase | Trigger | Action | Threshold |
|-------|---------|--------|-----------|
| 1 | On spec submission | Mark as 'completed', schedule deletion | 5-minute grace period |
| 2 | Explicit command | Delete all 'completed' file sets | Immediate |
| 3 | Extension startup | Cleanup orphaned files | >24 hours old |

### Directory Structure

```
globalStorageUri/
└── spec-editor/
    ├── manifest.json              # Global registry
    └── {sessionId}/
        ├── spec.md
        ├── images/
        │   ├── image-001.jpg
        │   └── image-002.png
        └── metadata.json
```

### Error Handling

- Non-writable directory: Show user error with path
- Partial cleanup failure: Continue with other files, log errors
- Corrupt manifest: Fall back to time-based cleanup
- Missing images: Generate markdown with placeholder text

---

## 5. Webview-to-Extension Messaging

### Decision: Typed message protocol with discriminated unions

### Message Types

```typescript
// Webview → Extension
type SpecEditorToExtensionMessage =
    | { type: 'submit'; content: string; images: AttachedImage[] }
    | { type: 'preview' }
    | { type: 'attachImage'; name: string; size: number; dataUri: string }
    | { type: 'removeImage'; imageId: string }
    | { type: 'loadTemplate'; specPath: string }
    | { type: 'cancel' };

// Extension → Webview
type ExtensionToSpecEditorMessage =
    | { type: 'imageSaved'; imageId: string; thumbnailUri: string }
    | { type: 'imageRemoved'; imageId: string }
    | { type: 'templateLoaded'; content: string }
    | { type: 'previewContent'; markdown: string }
    | { type: 'submissionStarted' }
    | { type: 'submissionComplete' }
    | { type: 'error'; message: string };
```

### Implementation Pattern

Follows existing pattern from `workflowEditorProvider.ts`:

```typescript
// In extension
webviewPanel.webview.onDidReceiveMessage(
    async (message: SpecEditorToExtensionMessage) => {
        switch (message.type) {
            case 'submit':
                await this.handleSubmit(message.content, message.images);
                break;
            case 'attachImage':
                await this.handleImageAttachment(message);
                break;
            // ...
        }
    },
    undefined,
    this.context.subscriptions
);
```

---

## 6. AI Provider Integration

### Decision: Use existing IAIProvider interface, extend for image support

### Current Interface (from aiProvider.ts)

```typescript
interface IAIProvider {
    executeInTerminal(prompt: string, title?: string): Promise<vscode.Terminal>;
    executeHeadless(prompt: string): Promise<AIExecutionResult>;
    executeSlashCommand(command: string, title?: string): Promise<vscode.Terminal>;
}
```

### Extension for Image Support

Instead of modifying the interface, the spec editor will:
1. Generate markdown with image references
2. Store images as files in globalStorageUri
3. Pass file paths in the prompt
4. Let CLI tools read images directly

### Provider-Specific Image Handling

| Provider | Image Support | Strategy |
|----------|---------------|----------|
| Claude Code | Yes (via file references) | Include file paths in prompt |
| Gemini CLI | Yes (via file references) | Include file paths in prompt |
| GitHub Copilot CLI | Limited | Warn user, omit images gracefully |

### Implementation

```typescript
async function generatePromptWithImages(
    content: string,
    imageFiles: Map<string, string>
): string {
    let prompt = content;

    if (imageFiles.size > 0) {
        prompt += '\n\n## Attached Images\n';
        for (const [id, path] of imageFiles) {
            prompt += `\n![${id}](${path})`;
        }
    }

    return prompt;
}
```

---

## Research Sources

- VS Code Webview API: https://code.visualstudio.com/api/extension-guides/webview
- VS Code Custom Editors: https://code.visualstudio.com/api/extension-guides/custom-editors
- VS Code Extension Samples: https://github.com/microsoft/vscode-extension-samples/tree/main/webview-sample
- VS Code Issue #182449: Drag-and-drop limitations in webviews
- Existing codebase patterns: workflowEditorProvider.ts, claudeCodeProvider.ts
