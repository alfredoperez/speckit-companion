# Data Model: SpecKit Views Enhancement

**Feature**: 001-speckit-views-enhancement
**Date**: 2026-01-02
**Status**: Complete

## Overview

This feature introduces new data structures for representing SpecKit files in the steering view. Since this is a VS Code extension (not a database-backed application), the data model focuses on TypeScript interfaces and tree item structures.

---

## Entities

### 1. SpecKitFileCategory

Represents a category of SpecKit files displayed in the steering view.

```typescript
interface SpecKitFileCategory {
  name: string;           // Display name (e.g., "Scripts", "Templates")
  contextValue: string;   // Tree item context for routing/menus
  icon: string;           // VS Code ThemeIcon name
  collapsible: boolean;   // Whether category can expand/collapse
  files: SpecKitFile[];   // Files within this category
}
```

**Validation Rules**:
- `name` must be non-empty string
- `contextValue` must match pattern: `speckit-{category}-category`
- `icon` must be valid VS Code ThemeIcon name

### 2. SpecKitFile

Represents an individual SpecKit file (constitution, script, or template).

```typescript
interface SpecKitFile {
  name: string;           // File name (without path)
  path: string;           // Absolute file system path
  type: SpecKitFileType;  // Classification of the file
  description?: string;   // Optional relative path for display
}

type SpecKitFileType = 'constitution' | 'script' | 'template';
```

**Validation Rules**:
- `name` must be non-empty string
- `path` must be valid absolute path
- `type` must be one of defined SpecKitFileType values

### 3. SpecKitFilesResult

Aggregated result from scanning `.specify/` directory.

```typescript
interface SpecKitFilesResult {
  constitution: SpecKitFile | null;
  scripts: SpecKitFile[];
  templates: SpecKitFile[];
}
```

**Validation Rules**:
- `constitution` is null if `.specify/memory/constitution.md` doesn't exist
- `scripts` is empty array if `.specify/scripts/` doesn't exist or is empty
- `templates` is empty array if `.specify/templates/` doesn't exist or is empty

---

## Tree Item Context Values

These context values route tree item behavior and enable context menus.

| contextValue | Description | Collapsible | Has Command |
|--------------|-------------|-------------|-------------|
| `speckit-header` | SpecKit Files category header | Yes (Expanded) | No |
| `speckit-constitution` | Constitution file | No | Yes (open file) |
| `speckit-scripts-category` | Scripts category | Yes (Expanded) | No |
| `speckit-script` | Individual script file | No | Yes (open file) |
| `speckit-templates-category` | Templates category | Yes (Expanded) | No |
| `speckit-template` | Individual template file | No | Yes (open file) |

---

## State Transitions

### Steering View State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                       Initial Load                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Check Workspace Open                          │
│            (vscode.workspace.workspaceFolders)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   No Workspace          │     │   Workspace Open        │
│   (Show nothing)        │     │   (Scan for files)      │
└─────────────────────────┘     └─────────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────────────────┐
                              │         Check .specify/ exists      │
                              └─────────────────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                              ▼                               ▼
                ┌─────────────────────────┐     ┌─────────────────────────┐
                │   No .specify/          │     │   .specify/ exists      │
                │   (No SpecKit section)  │     │   (Show SpecKit files)  │
                └─────────────────────────┘     └─────────────────────────┘
```

### Initialization Message State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Extension Activation                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Check Workspace Folders Exist                      │
│           (!workspaceFolders || length === 0)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   No Workspace          │     │   Workspace Open        │
│   (Skip init message)   │     │   (Continue checks)     │
└─────────────────────────┘     └─────────────────────────┘
                                              │
                                              ▼
                              ┌─────────────────────────────────────┐
                              │      Check CLI Installed            │
                              └─────────────────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                              ▼                               ▼
                ┌─────────────────────────┐     ┌─────────────────────────┐
                │   CLI Not Installed     │     │   CLI Installed         │
                │   (Skip init message)   │     │   (Continue checks)     │
                └─────────────────────────┘     └─────────────────────────┘
                                                              │
                                                              ▼
                                              ┌─────────────────────────────────────┐
                                              │    Check Already Initialized        │
                                              └─────────────────────────────────────┘
                                                              │
                                              ┌───────────────┴───────────────┐
                                              │                               │
                                              ▼                               ▼
                                ┌─────────────────────────┐     ┌─────────────────────────┐
                                │   Already Initialized   │     │   Not Initialized       │
                                │   (Skip init message)   │     │   (Show init message)   │
                                └─────────────────────────┘     └─────────────────────────┘
```

---

## Directory Structure

### SpecKit Files Location

```
workspace/
└── .specify/
    ├── memory/
    │   └── constitution.md    # Project constitution file
    ├── scripts/
    │   ├── bash/
    │   │   ├── setup-plan.sh
    │   │   └── update-agent-context.sh
    │   └── powershell/
    │       ├── setup-plan.ps1
    │       └── update-agent-context.ps1
    └── templates/
        ├── spec-template.md
        ├── plan-template.md
        └── tasks-template.md
```

### Steering View Hierarchy

```
Steering View (speckit.views.steering)
├── Global Rule (claude-md-global)
├── Project Rule (claude-md-project)
├── Steering Docs (steering-header)
│   └── [steering documents...]
├── SpecKit Files (speckit-header)          ← NEW
│   ├── Constitution (speckit-constitution)  ← NEW
│   ├── Scripts (speckit-scripts-category)   ← NEW
│   │   └── [script files...]                ← NEW
│   └── Templates (speckit-templates-category) ← NEW
│       └── [template files...]              ← NEW
└── [Create buttons...]
```

---

## Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                   SteeringExplorerProvider                       │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐ │
│  │ SteeringItem │ ◄───│SpecKitFile   │ ◄───│ File System      │ │
│  │ (TreeItem)   │     │ (Interface)  │     │ (.specify/)      │ │
│  └──────────────┘     └──────────────┘     └──────────────────┘ │
│         │                                                        │
│         │ renders                                                │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              VS Code Tree View                            │   │
│  │  (speckit.views.steering)                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Changes

### SteeringExplorerProvider Methods

New method to add:

```typescript
/**
 * Scans .specify/ directory for SpecKit files
 * @returns Promise<SpecKitFilesResult> containing constitution, scripts, templates
 */
private async getSpecKitFiles(): Promise<SpecKitFilesResult>
```

### SteeringItem Constructor Extensions

New context values to handle:
- `speckit-header`
- `speckit-constitution`
- `speckit-scripts-category`
- `speckit-script`
- `speckit-templates-category`
- `speckit-template`

---

## Performance Considerations

1. **File scanning**: Use `vscode.workspace.fs.readDirectory()` for async, non-blocking file operations
2. **Caching**: Consider caching `SpecKitFilesResult` with invalidation on file watcher events
3. **Debouncing**: File watcher refresh should be debounced (1000ms per existing pattern)
4. **Lazy loading**: Children are only loaded when parent is expanded (built into TreeDataProvider)
