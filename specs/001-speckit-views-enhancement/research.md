# Research: SpecKit Views Enhancement

**Feature**: 001-speckit-views-enhancement
**Date**: 2026-01-02
**Status**: Complete

## Summary

This document consolidates research findings for implementing two enhancements to the SpecKit Companion VS Code extension:
1. Contextual initialization message display
2. SpecKit files visibility in steering view

---

## Research Topics

### 1. Workspace Detection in VS Code Extensions

**Decision**: Use `vscode.workspace.workspaceFolders` API combined with package.json `when` clauses

**Rationale**:
- `vscode.workspace.workspaceFolders` returns `undefined` or empty array when no workspace is open
- VS Code's native `when` clause conditions (`workbenchState == empty || workspaceFolderCount == 0`) provide declarative UI control
- Extension already uses this pattern for view visibility in package.json

**Alternatives Considered**:
- Checking `vscode.window.activeTextEditor` - Rejected: doesn't reliably indicate workspace state
- Using `onDidChangeWorkspaceFolders` events - Not needed for initial check, only for dynamic changes

**Implementation Pattern**:
```typescript
// Check workspace state
const workspaceFolders = vscode.workspace.workspaceFolders;
if (!workspaceFolders || workspaceFolders.length === 0) {
    // No workspace - don't show initialization message
    return;
}
```

**Current State Analysis**:
The extension already checks `workspaceFolders` at line 61-64 of `extension.ts`:
```typescript
const workspaceFolders = vscode.workspace.workspaceFolders;
if (!workspaceFolders || workspaceFolders.length === 0) {
    outputChannel.appendLine('WARNING: No workspace folder found!');
}
```

However, the `showInitSuggestion()` function at line 51 is called BEFORE this check, which causes the issue.

---

### 2. TreeDataProvider Nested Items Pattern

**Decision**: Use context-value-based hierarchical nesting with collapsible headers

**Rationale**:
- Extension already uses this pattern in `steeringExplorerProvider.ts` with `steering-header`
- `AgentsExplorerProvider` demonstrates more complex grouping with `agent-group`
- Pattern is consistent across VS Code extension best practices

**Implementation Pattern** (from existing codebase):
```typescript
// Root level - create collapsible header
items.push(new SteeringItem(
    'SpecKit Files',
    vscode.TreeItemCollapsibleState.Expanded,
    'speckit-header',  // contextValue for routing
    '',
    this.context
));

// Child resolution
} else if (element.contextValue === 'speckit-header') {
    // Return SpecKit files as children
    return this.getSpecKitFiles();
}
```

---

### 3. SpecKit File Detection

**Decision**: Scan `.specify/` directory for constitution, scripts, and templates

**Rationale**:
- `.specify/` is the standard SpecKit directory structure
- Constitution lives at `.specify/memory/constitution.md`
- Scripts at `.specify/scripts/` (bash, powershell subdirectories)
- Templates at `.specify/templates/`

**File Structure**:
```
.specify/
├── memory/
│   └── constitution.md
├── scripts/
│   ├── bash/
│   │   └── *.sh
│   └── powershell/
│       └── *.ps1
└── templates/
    └── *.md
```

**Implementation Pattern**:
```typescript
private async getSpecKitFiles(): Promise<{
    constitution: { path: string } | null;
    scripts: Array<{ name: string; path: string }>;
    templates: Array<{ name: string; path: string }>;
}> {
    const basePath = path.join(workspaceFolder.uri.fsPath, '.specify');
    // Use vscode.workspace.fs.readDirectory for each subdirectory
}
```

---

### 4. Icon Mapping for SpecKit Items

**Decision**: Use VS Code ThemeIcons for consistency with existing views

**Rationale**:
- Extension already uses ThemeIcons extensively
- Provides light/dark theme support automatically
- Familiar to VS Code users

**Icon Assignments**:
| Item Type | Icon | Rationale |
|-----------|------|-----------|
| SpecKit Header | `law` | Constitution/rules theme |
| Constitution | `law` | Project principles document |
| Scripts Category | `code` | Code/automation |
| Individual Script | `terminal` | Command execution |
| Templates Category | `note` | Documentation |
| Individual Template | `file` | Generic file |

---

### 5. File System Watcher Integration

**Decision**: Add watcher for `.specify/` directory to auto-refresh steering view

**Rationale**:
- Extension already uses watchers for `.claude/` directory
- Debounced refresh prevents excessive updates
- Provides reactive UX when files change

**Implementation Pattern** (from fileWatchers.ts):
```typescript
const specifyWatcher = vscode.workspace.createFileSystemWatcher('**/.specify/**/*');

const debouncedRefresh = (uri: vscode.Uri) => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(() => {
        steeringExplorer.refresh();
    }, 1000);
};

specifyWatcher.onDidCreate(debouncedRefresh);
specifyWatcher.onDidDelete(debouncedRefresh);
specifyWatcher.onDidChange(debouncedRefresh);
```

---

### 6. Edge Cases and Error Handling

**Decision**: Graceful degradation with empty arrays for missing directories

**Findings**:
1. **Empty `.specify/` directory**: Show no SpecKit Files section
2. **Missing subdirectories**: Skip that category silently
3. **Malformed files**: Show in list but handle open errors gracefully
4. **External file changes**: File watcher with debounce handles this
5. **Custom steering alongside SpecKit**: Both sections show independently

**Implementation**:
```typescript
try {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    // Process entries
} catch {
    return []; // Directory doesn't exist, return empty
}
```

---

## Key Findings

### Initialization Message Fix

The bug is in `extension.ts` where `showInitSuggestion()` is called at line 51-53 without first checking workspace state:

```typescript
// Current (buggy):
if (cliInstalled && !workspaceInitialized) {
    await showInitSuggestion(context);
}

// Fixed:
if (cliInstalled && !workspaceInitialized && vscode.workspace.workspaceFolders?.length) {
    await showInitSuggestion(context);
}
```

### Steering View Enhancement

The steering view already has the architectural patterns needed. Key additions:
1. New `getSpecKitFiles()` method in `SteeringExplorerProvider`
2. New `contextValue` types: `speckit-header`, `speckit-constitution`, `speckit-scripts-category`, `speckit-script`, `speckit-templates-category`, `speckit-template`
3. Icon assignments in `SteeringItem` constructor
4. File watcher for `.specify/` directory

---

## References

- VS Code TreeView API: https://code.visualstudio.com/api/extension-guides/tree-view
- FileSystemWatcher API: https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher
- When Clause Contexts: https://code.visualstudio.com/api/references/when-clause-contexts
- Existing patterns in codebase:
  - `src/features/steering/steeringExplorerProvider.ts`
  - `src/features/agents/agentsExplorerProvider.ts`
  - `src/core/fileWatchers.ts`
