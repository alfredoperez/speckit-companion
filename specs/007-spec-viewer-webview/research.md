# Research: Unified Spec Viewer Webview Panel

**Date**: 2026-01-13 | **Feature**: 007-spec-viewer-webview

## Research Questions

Based on Technical Context unknowns and dependencies:

1. How should markdown be rendered in VS Code webviews?
2. How should WebviewPanel singleton pattern be implemented?
3. How should file watchers work for live content updates?
4. What markdown library (if any) should be used?

---

## 1. Markdown Rendering in VS Code Webviews

### Decision: Reuse Custom Markdown Renderer

**Rationale**: The project already has a battle-tested custom markdown rendering pipeline in `webview/src/render/` and `webview/src/markdown/parser.ts`. This provides:
- Zero external dependencies
- Built-in HTML escaping for security
- Full control over rendering output
- Consistent styling with existing webviews

### Alternatives Considered

| Library | Bundle Size | Pros | Cons | Verdict |
|---------|-------------|------|------|---------|
| marked.js | ~30KB | CommonMark compliance, plugins | Requires DOMPurify for security | Rejected - adds complexity |
| markdown-it | ~50KB | GFM + extensions, table support | Larger bundle, extra build config | Rejected - overkill |
| showdown | ~80KB | GFM support | Slower, largest bundle | Rejected - performance |
| Custom (current) | 0KB | Proven, secure, fast | Limited features | **Selected** |

### Implementation Pattern

```typescript
// From existing parser.ts
export function parseInlineMarkdown(line: string): string {
    return line
        .replace(/&/g, '&amp;')        // Escape HTML first
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // ... other patterns
}
```

**Key**: Always escape HTML entities BEFORE applying markdown patterns to prevent XSS.

### Syntax Highlighting

**Decision**: Use highlight.js v11 from CDN (already integrated)

```html
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/highlight.min.js"></script>
```

Apply highlighting after render:
```typescript
contentEl.querySelectorAll('code[class*="language-"]').forEach(block => {
    hljs.highlightElement(block);
});
```

---

## 2. WebviewPanel Singleton Pattern

### Decision: Follow SpecEditorProvider Pattern

**Rationale**: The existing `SpecEditorProvider` (`src/features/spec-editor/specEditorProvider.ts`) already implements a correct singleton pattern that can be adapted.

### Pattern from Codebase

```typescript
// From specEditorProvider.ts (lines 49-54)
public async show(): Promise<void> {
    if (this.panel) {
        this.panel.reveal();
        return;
    }
    this.panel = vscode.window.createWebviewPanel(...);
}

// Disposal handling (lines 88-92)
this.panel.onDidDispose(() => {
    this.panel = undefined;
    this.sessionId = undefined;
});
```

### Spec Viewer Adaptation

```typescript
export class SpecViewerProvider {
    private panel: vscode.WebviewPanel | undefined;
    private currentSpec: SpecViewerState | undefined;

    public async show(specPath: string, documentType: string): Promise<void> {
        if (this.panel) {
            await this.updateContent(specPath, documentType);
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'speckit.specViewer',
            'Spec Viewer',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: false }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.currentSpec = undefined;
        });

        await this.updateContent(specPath, documentType);
    }
}
```

### Content Update Strategy

**Decision**: Use webview message passing instead of HTML regeneration

```typescript
// Extension side
this.panel.webview.postMessage({
    type: 'contentUpdated',
    content: markdownText,
    documentType: documentType
});

// Webview side
window.addEventListener('message', (event) => {
    if (event.data.type === 'contentUpdated') {
        renderContent(event.data.content);
        hljs.highlightAll?.();
    }
});
```

**Benefits**: Achieves <500ms document switch (SC-002) without page reload.

---

## 3. File Watcher for Live Updates

### Decision: 500ms Debounce with Spec-Specific Pattern

**Rationale**: The project uses debounced file watchers in `src/core/fileWatchers.ts`. For responsive updates (SC-005: <2s), use 500ms debounce.

### Pattern from Codebase

```typescript
// From fileWatchers.ts (lines 168-189)
let debounceTimeout: NodeJS.Timeout | undefined;
const handleChange = async (uri: vscode.Uri) => {
    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(async () => {
        // Handle change
    }, 500);
};
```

### Spec Viewer Implementation

```typescript
export function setupSpecViewerWatcher(
    specViewer: SpecViewerProvider,
    context: vscode.ExtensionContext
): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/specs/**/*.md');

    let debounceTimer: NodeJS.Timeout | undefined;

    watcher.onDidChange((uri) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            specViewer.refreshIfDisplaying(uri.fsPath);
        }, 500);
    });

    watcher.onDidDelete((uri) => {
        specViewer.handleFileDeleted(uri.fsPath);
    });

    context.subscriptions.push(watcher);
}
```

---

## 4. CSP Security Configuration

### Decision: Match SpecEditorProvider CSP with CDN Allowlist

**Rationale**: The spec-editor already has a secure CSP configuration that can be adapted.

### CSP Template

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;
               img-src ${webview.cspSource} data: https:;
               font-src ${webview.cspSource};
               connect-src https://cdn.jsdelivr.net;">
```

**Key additions for spec viewer**:
- `https://cdn.jsdelivr.net` in script-src for highlight.js
- `connect-src` for potential CDN fetches

---

## 5. Tab Navigation Design

### Decision: Tab Bar Component in Webview

Based on FR-003 (navigation controls) and FR-005 (active tab highlighting):

```html
<nav class="spec-tabs">
    <button class="tab-button active" data-doc="spec">Spec</button>
    <button class="tab-button" data-doc="plan">Plan</button>
    <button class="tab-button" data-doc="tasks">Tasks</button>
    <!-- Related docs added dynamically -->
</nav>
```

### Tab Click Handler

```typescript
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        vscode.postMessage({
            type: 'switchDocument',
            documentType: btn.dataset.doc
        });
    });
});
```

---

## 6. Integration Points

### Tree View Command Integration

Current behavior: `speckit.openSpecFile` opens file in VS Code editor

**New behavior**: Override to open in spec viewer panel

```typescript
// In extension.ts
vscode.commands.registerCommand('speckit.openSpecFile', (filePath: string) => {
    // Check if it's a spec document (spec.md, plan.md, tasks.md, or related)
    if (isSpecDocument(filePath)) {
        specViewer.show(filePath, getDocumentType(filePath));
    } else {
        // Fallback to standard file opening
        openSpecFile(filePath, { outputChannel });
    }
});
```

### Edit Action Integration

FR-006 requires "Edit" action to open in standard text editor:

```typescript
// Webview to extension message
vscode.postMessage({ type: 'editDocument', filePath: currentFilePath });

// Extension handler
if (message.type === 'editDocument') {
    const doc = await vscode.workspace.openTextDocument(message.filePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}
```

---

## Summary of Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Markdown Rendering | Custom renderer | Zero deps, proven, secure |
| Syntax Highlighting | highlight.js v11 CDN | Already integrated |
| Panel Pattern | Singleton with state | Follows spec-editor |
| Content Updates | Message passing | <500ms switch time |
| File Watching | 500ms debounce | <2s refresh goal |
| CSP | Nonce + CDN allowlist | Security compliance |
| Tab Navigation | Webview buttons | Native-feeling tabs |

---

## References

- `src/features/spec-editor/specEditorProvider.ts` - Singleton pattern
- `src/core/fileWatchers.ts` - Debounce pattern
- `webview/src/render/contentRenderer.ts` - Markdown rendering
- `webview/src/markdown/parser.ts` - Inline parsing
