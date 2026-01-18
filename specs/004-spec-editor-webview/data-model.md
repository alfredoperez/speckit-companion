# Data Model: Spec Editor Webview

**Feature**: 004-spec-editor-webview | **Date**: 2026-01-02

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SpecEditorSession                           │
│─────────────────────────────────────────────────────────────────────│
│ id: string (UUID)                                                   │
│ specName: string | undefined                                        │
│ createdAt: number (timestamp)                                       │
│ status: 'editing' | 'previewing' | 'submitting' | 'completed'       │
├─────────────────────────────────────────────────────────────────────┤
│                              1                                      │
│                              │                                      │
│                              ▼                                      │
│                           has one                                   │
│                              │                                      │
│                              ▼                                      │
│                              1                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           SpecDraft                                 │
│─────────────────────────────────────────────────────────────────────│
│ sessionId: string (FK to SpecEditorSession)                         │
│ content: string                                                     │
│ cursorPosition: number                                              │
│ lastSaved: number (timestamp)                                       │
├─────────────────────────────────────────────────────────────────────┤
│                              1                                      │
│                              │                                      │
│                              ▼                                      │
│                          has many                                   │
│                              │                                      │
│                              ▼                                      │
│                              *                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AttachedImage                                │
│─────────────────────────────────────────────────────────────────────│
│ id: string (UUID)                                                   │
│ sessionId: string (FK to SpecEditorSession)                         │
│ originalName: string                                                │
│ format: 'png' | 'jpg' | 'gif' | 'webp'                              │
│ size: number (bytes)                                                │
│ dimensions: { width: number; height: number } | undefined           │
│ thumbnailDataUri: string                                            │
│ filePath: string (path to stored file)                              │
│ addedAt: number (timestamp)                                         │
└─────────────────────────────────────────────────────────────────────┘

                                │
                                │ On submit, generates:
                                ▼

┌─────────────────────────────────────────────────────────────────────┐
│                         TempSpecFile                                │
│─────────────────────────────────────────────────────────────────────│
│ id: string (UUID)                                                   │
│ sessionId: string (FK to SpecEditorSession)                         │
│ markdownFilePath: string                                            │
│ imageFilePaths: Map<string, string> (imageId -> path)               │
│ createdAt: number (timestamp)                                       │
│ expiresAt: number (timestamp)                                       │
│ status: 'active' | 'submitted' | 'completed' | 'orphaned'           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Entity Definitions

### SpecEditorSession

Represents an active spec editor webview session.

```typescript
interface SpecEditorSession {
    /** Unique identifier for this editor session */
    id: string;

    /** Optional name for the spec being created (set before submit) */
    specName?: string;

    /** Timestamp when session was created */
    createdAt: number;

    /** Current state of the editor */
    status: SpecEditorStatus;
}

type SpecEditorStatus =
    | 'editing'      // User is composing content
    | 'previewing'   // User is viewing preview
    | 'submitting'   // Submission in progress
    | 'completed';   // Submission finished
```

**Lifecycle**:
1. Created when webview panel opens
2. Status changes as user interacts
3. Destroyed when panel closes or submission completes

**Storage**: In-memory only (WebviewPanel context)

---

### SpecDraft

Represents unsaved spec content being edited.

```typescript
interface SpecDraft {
    /** Reference to parent session */
    sessionId: string;

    /** The text content of the spec */
    content: string;

    /** Cursor position for restoration */
    cursorPosition: number;

    /** Timestamp of last auto-save */
    lastSaved: number;
}
```

**Validation Rules**:
- `content`: Required, max 50,000 characters
- `cursorPosition`: Must be within content bounds

**Storage**: Webview state (vscode.getState/setState)

**Auto-save Trigger**: On every input event, debounced 300ms

---

### AttachedImage

An image attached to a spec.

```typescript
interface AttachedImage {
    /** Unique identifier for this image */
    id: string;

    /** Reference to parent session */
    sessionId: string;

    /** Original filename from user */
    originalName: string;

    /** Image format */
    format: ImageFormat;

    /** File size in bytes */
    size: number;

    /** Image dimensions (if available) */
    dimensions?: {
        width: number;
        height: number;
    };

    /** Base64 data URI for thumbnail display */
    thumbnailDataUri: string;

    /** Path to stored file in globalStorageUri */
    filePath: string;

    /** Timestamp when added */
    addedAt: number;
}

type ImageFormat = 'png' | 'jpg' | 'gif' | 'webp';
```

**Validation Rules**:
- `size`: Max 2MB per image (2,097,152 bytes)
- `format`: Must be one of supported formats
- Total attachments per session: Max 10MB

**Storage**:
- Metadata: Webview state + extension context
- File: `globalStorageUri/spec-editor/{sessionId}/images/{id}.{format}`

---

### TempSpecFile

A temporary markdown file generated from submitted spec.

```typescript
interface TempSpecFile {
    /** Unique identifier for this temp file set */
    id: string;

    /** Reference to parent session */
    sessionId: string;

    /** Path to the generated markdown file */
    markdownFilePath: string;

    /** Map of image IDs to their file paths */
    imageFilePaths: Map<string, string>;

    /** Timestamp when created */
    createdAt: number;

    /** Timestamp when files should be cleaned up */
    expiresAt: number;

    /** Current status */
    status: TempFileStatus;
}

type TempFileStatus =
    | 'active'      // Files in use
    | 'submitted'   // Sent to CLI
    | 'completed'   // Workflow done, pending cleanup
    | 'orphaned';   // From previous session, pending cleanup
```

**Validation Rules**:
- `markdownFilePath`: Must exist and be writable
- `expiresAt`: Must be in future when created

**Storage**:
- Manifest: `globalStorageUri/spec-editor/manifest.json`
- Files: `globalStorageUri/spec-editor/{id}/`

---

## State Transitions

### SpecEditorSession Status

```
┌──────────┐    open webview    ┌───────────┐
│  (none)  │ ─────────────────► │  editing  │
└──────────┘                    └─────┬─────┘
                                      │
                   ┌──────────────────┼──────────────────┐
                   │ click preview    │                  │
                   ▼                  │                  │
             ┌───────────┐            │                  │
             │ previewing│◄───────────┘                  │
             └─────┬─────┘   back to edit               │
                   │                                     │
                   │ click submit                        │ click submit
                   │                                     │
                   ▼                                     ▼
             ┌───────────┐                         ┌───────────┐
             │ submitting│◄────────────────────────│ submitting│
             └─────┬─────┘                         └─────┬─────┘
                   │                                     │
                   │ CLI returns                         │
                   ▼                                     ▼
             ┌───────────┐                         ┌───────────┐
             │ completed │                         │ completed │
             └───────────┘                         └───────────┘
```

### TempSpecFile Status

```
┌──────────┐   submission started   ┌────────┐
│  (none)  │ ─────────────────────► │ active │
└──────────┘                        └────┬───┘
                                         │
                      CLI execution done │
                                         ▼
                                    ┌───────────┐
                                    │ submitted │
                                    └─────┬─────┘
                                          │
                   workflow complete      │      CLI timeout/error
              ┌───────────────────────────┼────────────────────────┐
              ▼                           │                        ▼
        ┌───────────┐                     │                  ┌──────────┐
        │ completed │                     │                  │ orphaned │
        └─────┬─────┘                     │                  └────┬─────┘
              │                           │                       │
              │ after 5 min               │                       │ startup cleanup
              │ grace period              │                       │ (>24h old)
              ▼                           ▼                       ▼
        ┌───────────┐              ┌───────────┐            ┌───────────┐
        │ (deleted) │              │ (deleted) │            │ (deleted) │
        └───────────┘              └───────────┘            └───────────┘
```

---

## Relationships

| Parent | Child | Cardinality | Description |
|--------|-------|-------------|-------------|
| SpecEditorSession | SpecDraft | 1:1 | Each session has exactly one draft |
| SpecEditorSession | AttachedImage | 1:* | Session can have 0-N images |
| SpecEditorSession | TempSpecFile | 1:0..1 | Session generates 0 or 1 temp file set |

---

## Storage Locations

| Entity | Storage Type | Location |
|--------|--------------|----------|
| SpecEditorSession | In-memory | WebviewPanel context |
| SpecDraft | Webview state | vscode.getState/setState |
| AttachedImage (metadata) | Webview state + extension | vscode.getState + context |
| AttachedImage (file) | File system | globalStorageUri/spec-editor/{sessionId}/images/ |
| TempSpecFile (manifest) | File system | globalStorageUri/spec-editor/manifest.json |
| TempSpecFile (files) | File system | globalStorageUri/spec-editor/{id}/ |

---

## File System Structure

```
context.globalStorageUri/
└── spec-editor/
    ├── manifest.json                    # TempFileManifest
    ├── {sessionId}/                     # Active editing session
    │   └── images/
    │       ├── img-uuid-1.png
    │       └── img-uuid-2.jpg
    └── {tempFileId}/                    # Submitted spec files
        ├── spec.md
        └── images/
            ├── img-uuid-1.png
            └── img-uuid-2.jpg
```

---

## Manifest Schema

```typescript
interface TempFileManifest {
    /** Schema version for migration */
    version: '1.0';

    /** Map of temp file set ID to metadata */
    files: Record<string, TempSpecFile>;

    /** Timestamp of last cleanup run */
    lastCleanup: number;
}
```

Example:

```json
{
    "version": "1.0",
    "files": {
        "temp-abc123": {
            "id": "temp-abc123",
            "sessionId": "session-xyz789",
            "markdownFilePath": "/path/to/spec.md",
            "imageFilePaths": {
                "img-001": "/path/to/images/img-001.png"
            },
            "createdAt": 1704218400000,
            "expiresAt": 1704218700000,
            "status": "completed"
        }
    },
    "lastCleanup": 1704218400000
}
```

---

## Size Limits

| Constraint | Limit | Enforcement |
|------------|-------|-------------|
| Single image size | 2 MB | Validate on attachment, reject with error |
| Total attachments per session | 10 MB | Validate on attachment, reject with error |
| Draft content length | 50,000 chars | Validate on input, show warning |
| Max images per session | 20 | Validate on attachment, reject with error |
| Thumbnail size | 100x100 px | Resize on generation |

---

## Cleanup Thresholds

| Scenario | Threshold | Action |
|----------|-----------|--------|
| Completed temp files | 5 minutes | Delete files, remove from manifest |
| Orphaned temp files | 24 hours | Delete files, remove from manifest |
| Cleanup check frequency | On startup + hourly | Scan manifest, delete expired |
