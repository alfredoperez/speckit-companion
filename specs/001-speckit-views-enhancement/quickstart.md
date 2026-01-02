# Quickstart: SpecKit Views Enhancement

**Feature**: 001-speckit-views-enhancement
**Date**: 2026-01-02

## Overview

This document provides step-by-step implementation guidance for the SpecKit Views Enhancement feature.

---

## Prerequisites

- Node.js 18+ installed
- VS Code ^1.84.0 (for extension development)
- Extension dependencies installed (`npm install`)

---

## Implementation Order

### Step 1: Fix Initialization Message (US1)

**File**: `src/extension.ts`

**Location**: Lines 50-53

**Current Code**:
```typescript
// Show init suggestion when CLI is installed but workspace is not initialized
if (cliInstalled && !workspaceInitialized) {
    await showInitSuggestion(context);
}
```

**Fixed Code**:
```typescript
// Show init suggestion when CLI is installed but workspace is not initialized
// ONLY if a workspace is actually open (US1 fix)
const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
if (cliInstalled && !workspaceInitialized && hasWorkspace) {
    await showInitSuggestion(context);
}
```

**Test**: Open VS Code without a workspace. Verify no initialization message appears.

---

### Step 2: Add SpecKit File Interfaces

**File**: `src/features/steering/types.ts` (new file)

Copy contents from `contracts/speckit-files.ts` into production code.

---

### Step 3: Implement getSpecKitFiles() Method

**File**: `src/features/steering/steeringExplorerProvider.ts`

Add after line 242:

```typescript
/**
 * Scans .specify/ directory for SpecKit files
 */
private async getSpecKitFiles(): Promise<{
    constitution: { name: string; path: string } | null;
    scripts: Array<{ name: string; path: string }>;
    templates: Array<{ name: string; path: string }>;
}> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return { constitution: null, scripts: [], templates: [] };
    }

    const basePath = path.join(workspaceFolder.uri.fsPath, '.specify');
    const result = {
        constitution: null as { name: string; path: string } | null,
        scripts: [] as Array<{ name: string; path: string }>,
        templates: [] as Array<{ name: string; path: string }>,
    };

    // Check constitution
    const constitutionPath = path.join(basePath, 'memory', 'constitution.md');
    if (fs.existsSync(constitutionPath)) {
        result.constitution = { name: 'constitution.md', path: constitutionPath };
    }

    // Check scripts directory (including subdirectories)
    const scriptsPath = path.join(basePath, 'scripts');
    result.scripts = await this.scanDirectory(scriptsPath, true);

    // Check templates directory
    const templatesPath = path.join(basePath, 'templates');
    result.templates = await this.scanDirectory(templatesPath, false);

    return result;
}

/**
 * Helper to scan a directory for files
 */
private async scanDirectory(
    dirPath: string,
    recursive: boolean
): Promise<Array<{ name: string; path: string }>> {
    const files: Array<{ name: string; path: string }> = [];

    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

        for (const [name, type] of entries) {
            const fullPath = path.join(dirPath, name);
            if (type === vscode.FileType.File) {
                files.push({ name, path: fullPath });
            } else if (type === vscode.FileType.Directory && recursive) {
                const subFiles = await this.scanDirectory(fullPath, true);
                files.push(...subFiles);
            }
        }
    } catch {
        // Directory doesn't exist, return empty array
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
}
```

---

### Step 4: Update getChildren() for SpecKit Section

**File**: `src/features/steering/steeringExplorerProvider.ts`

In `getChildren()` method, add SpecKit section after steering docs (around line 103):

```typescript
// After the steering docs section, before create buttons

// SpecKit Files section
const specKitFiles = await this.getSpecKitFiles();
const hasSpecKitContent = specKitFiles.constitution ||
    specKitFiles.scripts.length > 0 ||
    specKitFiles.templates.length > 0;

if (hasSpecKitContent) {
    items.push(new SteeringItem(
        'SpecKit Files',
        vscode.TreeItemCollapsibleState.Expanded,
        'speckit-header',
        '',
        this.context
    ));
}
```

Add handling for SpecKit context values in `getChildren()`:

```typescript
} else if (element.contextValue === 'speckit-header') {
    return this.getSpecKitHeaderChildren();
} else if (element.contextValue === 'speckit-scripts-category') {
    return this.getSpecKitScripts();
} else if (element.contextValue === 'speckit-templates-category') {
    return this.getSpecKitTemplates();
}
```

---

### Step 5: Add Child Resolution Methods

```typescript
private async getSpecKitHeaderChildren(): Promise<SteeringItem[]> {
    const items: SteeringItem[] = [];
    const specKitFiles = await this.getSpecKitFiles();
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // Constitution
    if (specKitFiles.constitution) {
        items.push(new SteeringItem(
            'Constitution',
            vscode.TreeItemCollapsibleState.None,
            'speckit-constitution',
            specKitFiles.constitution.path,
            this.context,
            {
                command: 'vscode.open',
                title: 'Open Constitution',
                arguments: [vscode.Uri.file(specKitFiles.constitution.path)]
            },
            path.relative(workspacePath, specKitFiles.constitution.path)
        ));
    }

    // Scripts category
    if (specKitFiles.scripts.length > 0) {
        items.push(new SteeringItem(
            'Scripts',
            vscode.TreeItemCollapsibleState.Expanded,
            'speckit-scripts-category',
            '',
            this.context
        ));
    }

    // Templates category
    if (specKitFiles.templates.length > 0) {
        items.push(new SteeringItem(
            'Templates',
            vscode.TreeItemCollapsibleState.Expanded,
            'speckit-templates-category',
            '',
            this.context
        ));
    }

    return items;
}

private async getSpecKitScripts(): Promise<SteeringItem[]> {
    const specKitFiles = await this.getSpecKitFiles();
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    return specKitFiles.scripts.map(script => new SteeringItem(
        script.name,
        vscode.TreeItemCollapsibleState.None,
        'speckit-script',
        script.path,
        this.context,
        {
            command: 'vscode.open',
            title: 'Open Script',
            arguments: [vscode.Uri.file(script.path)]
        },
        path.relative(workspacePath, script.path)
    ));
}

private async getSpecKitTemplates(): Promise<SteeringItem[]> {
    const specKitFiles = await this.getSpecKitFiles();
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    return specKitFiles.templates.map(template => new SteeringItem(
        template.name,
        vscode.TreeItemCollapsibleState.None,
        'speckit-template',
        template.path,
        this.context,
        {
            command: 'vscode.open',
            title: 'Open Template',
            arguments: [vscode.Uri.file(template.path)]
        },
        path.relative(workspacePath, template.path)
    ));
}
```

---

### Step 6: Add Icon Handling in SteeringItem

**File**: `src/features/steering/steeringExplorerProvider.ts`

In the `SteeringItem` constructor, add icon cases:

```typescript
} else if (contextValue === 'speckit-header') {
    this.iconPath = new vscode.ThemeIcon('law');
    this.tooltip = 'SpecKit project configuration files';
} else if (contextValue === 'speckit-constitution') {
    this.iconPath = new vscode.ThemeIcon('law');
    this.tooltip = `Project Constitution: ${resourcePath}`;
    this.description = filename;
} else if (contextValue === 'speckit-scripts-category') {
    this.iconPath = new vscode.ThemeIcon('code');
    this.tooltip = 'SpecKit automation scripts';
} else if (contextValue === 'speckit-script') {
    this.iconPath = new vscode.ThemeIcon('terminal');
    this.tooltip = `Script: ${resourcePath}`;
    this.description = filename;
} else if (contextValue === 'speckit-templates-category') {
    this.iconPath = new vscode.ThemeIcon('note');
    this.tooltip = 'SpecKit document templates';
} else if (contextValue === 'speckit-template') {
    this.iconPath = new vscode.ThemeIcon('file');
    this.tooltip = `Template: ${resourcePath}`;
    this.description = filename;
}
```

---

### Step 7: Add File Watcher for .specify/

**File**: `src/core/fileWatchers.ts`

Add watcher for SpecKit files:

```typescript
// Add alongside existing claude watcher
const specifyWatcher = vscode.workspace.createFileSystemWatcher('**/.specify/**/*');

specifyWatcher.onDidCreate((uri) => debouncedRefresh('Create', uri));
specifyWatcher.onDidDelete((uri) => debouncedRefresh('Delete', uri));
specifyWatcher.onDidChange((uri) => debouncedRefresh('Change', uri));

context.subscriptions.push(specifyWatcher);
```

---

## Testing Checklist

### US1: Contextual Initialization Message

- [ ] Open VS Code without workspace → No init message
- [ ] Open VS Code with workspace, CLI not installed → No init message
- [ ] Open VS Code with workspace, CLI installed, already initialized → No init message
- [ ] Open VS Code with workspace, CLI installed, not initialized → Init message appears

### US2: SpecKit Files in Steering View

- [ ] Workspace with `.specify/memory/constitution.md` → Constitution visible
- [ ] Workspace with `.specify/scripts/` files → Scripts category visible
- [ ] Workspace with `.specify/templates/` files → Templates category visible
- [ ] Click file → Opens in editor

### US3: Organized Categories

- [ ] Categories are collapsible
- [ ] Files appear under correct category
- [ ] Icons match file type
- [ ] Tooltips show full paths

### Edge Cases

- [ ] Empty `.specify/` directory → No SpecKit section
- [ ] Only constitution exists → Only Constitution shown
- [ ] File watcher: Add file → View updates
- [ ] File watcher: Delete file → View updates

---

## Build & Run

```bash
# Compile
npm run compile

# Watch mode (development)
npm run watch

# Press F5 in VS Code to launch Extension Development Host
```
