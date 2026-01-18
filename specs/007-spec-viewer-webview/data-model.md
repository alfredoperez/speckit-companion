# Data Model: Unified Spec Viewer Webview Panel

**Date**: 2026-01-13 | **Feature**: 007-spec-viewer-webview

## Overview

This document defines the data structures for the Spec Viewer feature. The viewer is a read-only panel that displays spec documents with navigation between spec/plan/tasks files.

---

## Core Entities

### 1. SpecViewerState

The primary state object tracking the current viewer context.

```typescript
/**
 * State for the spec viewer panel
 * Tracks which spec and document is currently displayed
 */
interface SpecViewerState {
    /** Display name of the spec (derived from folder name) */
    specName: string;

    /** Absolute path to the spec directory */
    specDirectory: string;

    /** Currently displayed document type */
    currentDocument: DocumentType;

    /** List of all available documents in this spec */
    availableDocuments: SpecDocument[];

    /** Timestamp of last content update */
    lastUpdated: number;
}
```

### 2. DocumentType

Enumeration of document types for navigation.

```typescript
/**
 * Core document types in the spec workflow
 */
type CoreDocumentType = 'spec' | 'plan' | 'tasks';

/**
 * Extended to include related documents
 * Related docs are identified by their filename
 */
type DocumentType = CoreDocumentType | string;

/**
 * Document type constants for consistency
 */
const CORE_DOCUMENTS = {
    SPEC: 'spec',
    PLAN: 'plan',
    TASKS: 'tasks'
} as const;

/**
 * File name mapping for core documents
 */
const CORE_DOCUMENT_FILES: Record<CoreDocumentType, string> = {
    spec: 'spec.md',
    plan: 'plan.md',
    tasks: 'tasks.md'
};
```

### 3. SpecDocument

Metadata for a single document in the spec.

```typescript
/**
 * Represents a document available in the spec viewer
 */
interface SpecDocument {
    /** Document type for navigation */
    type: DocumentType;

    /** Display name shown in tab (e.g., "Spec", "Plan", "Research") */
    displayName: string;

    /** Filename (e.g., "spec.md", "research.md") */
    fileName: string;

    /** Absolute file path */
    filePath: string;

    /** Whether the file exists on disk */
    exists: boolean;

    /** Whether this is a core document (spec/plan/tasks) */
    isCore: boolean;
}
```

### 4. ViewerPanelConfig

Configuration for the WebviewPanel.

```typescript
/**
 * Configuration for creating the viewer panel
 */
interface ViewerPanelConfig {
    /** Panel identifier */
    viewType: 'speckit.specViewer';

    /** Panel title (dynamic: "Spec: {specName}") */
    title: string;

    /** Column to open in */
    viewColumn: vscode.ViewColumn;

    /** Webview options */
    options: {
        enableScripts: true;
        retainContextWhenHidden: false;
        localResourceRoots: vscode.Uri[];
    };
}
```

---

## Message Protocols

### Extension → Webview Messages

```typescript
/**
 * Messages sent from extension to webview
 */
type ExtensionToViewerMessage =
    | {
          type: 'contentUpdated';
          content: string;
          documentType: DocumentType;
          specName: string;
      }
    | {
          type: 'documentsUpdated';
          documents: SpecDocument[];
          currentDocument: DocumentType;
      }
    | {
          type: 'error';
          message: string;
          recoverable: boolean;
      }
    | {
          type: 'fileDeleted';
          filePath: string;
      };
```

### Webview → Extension Messages

```typescript
/**
 * Messages sent from webview to extension
 */
type ViewerToExtensionMessage =
    | {
          type: 'switchDocument';
          documentType: DocumentType;
      }
    | {
          type: 'editDocument';
      }
    | {
          type: 'refreshContent';
      }
    | {
          type: 'ready';
      };
```

---

## Webview State

### ViewerWebviewState

State persisted via vscode.setState() for state restoration.

```typescript
/**
 * State saved in webview for restoration
 */
interface ViewerWebviewState {
    /** Currently selected document type */
    currentDocument: DocumentType;

    /** Scroll position in content area */
    scrollPosition: number;

    /** Last known spec directory */
    specDirectory: string;
}
```

---

## Validation Rules

### Spec Directory Validation

```typescript
/**
 * Validates that a path is a valid spec directory
 */
function isValidSpecDirectory(dirPath: string): boolean {
    // Must be under specs/ directory
    // Must contain at least one of: spec.md, plan.md, tasks.md
    // Must not be hidden (no leading .)
}
```

### Document Existence Rules

| Document | Required | Empty State Message |
|----------|----------|---------------------|
| spec.md | No | "No specification file found. Create one to define requirements." |
| plan.md | No | "No implementation plan found. Run /speckit.plan to generate." |
| tasks.md | No | "No tasks file found. Run /speckit.tasks to generate." |
| related docs | No | (not shown if doesn't exist) |

---

## State Transitions

### Panel Lifecycle

```
[No Panel]
    ↓ (user clicks document)
[Creating]
    ↓ (panel created, content loaded)
[Displaying]
    ↓ (user switches document)
[Updating] → [Displaying]
    ↓ (user closes panel)
[Disposed] → [No Panel]
```

### Document Navigation

```
[Spec Tab Active]
    ↓ (click Plan tab)
[Load plan.md content]
    ↓ (render markdown)
[Plan Tab Active]
    ↓ (file watcher: plan.md changed)
[Refresh content]
    ↓ (re-render)
[Plan Tab Active (updated)]
```

---

## File Structure Expectations

### Standard Spec Directory

```
specs/{spec-name}/
├── spec.md          # Requirements (CoreDocument)
├── plan.md          # Implementation plan (CoreDocument)
├── tasks.md         # Task breakdown (CoreDocument)
├── research.md      # Research notes (RelatedDocument)
├── data-model.md    # Data model (RelatedDocument)
└── quickstart.md    # Quick start guide (RelatedDocument)
```

### Document Discovery Order

1. Core documents (spec, plan, tasks) - always shown in tabs
2. Related documents - sorted alphabetically, shown after core tabs

---

## Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SpecViewerProvider                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ panel: WebviewPanel | undefined                      │    │
│  │ state: SpecViewerState | undefined                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ manages                          │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SpecViewerState                         │    │
│  │  - specName: string                                  │    │
│  │  - specDirectory: string                             │    │
│  │  - currentDocument: DocumentType                     │    │
│  │  - availableDocuments: SpecDocument[]                │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ contains                         │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SpecDocument[]                          │    │
│  │  [0] spec  → spec.md   (isCore: true)               │    │
│  │  [1] plan  → plan.md   (isCore: true)               │    │
│  │  [2] tasks → tasks.md  (isCore: true)               │    │
│  │  [3] research → research.md (isCore: false)         │    │
│  │  ...                                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Index of Types

| Type | Purpose | File Location |
|------|---------|---------------|
| SpecViewerState | Main viewer state | `src/features/spec-viewer/types.ts` |
| DocumentType | Document identification | `src/features/spec-viewer/types.ts` |
| SpecDocument | Document metadata | `src/features/spec-viewer/types.ts` |
| ViewerPanelConfig | Panel configuration | `src/features/spec-viewer/types.ts` |
| ExtensionToViewerMessage | Extension→Webview messages | `src/features/spec-viewer/types.ts` |
| ViewerToExtensionMessage | Webview→Extension messages | `webview/src/spec-viewer/types.ts` |
| ViewerWebviewState | Webview persistence state | `webview/src/spec-viewer/types.ts` |
