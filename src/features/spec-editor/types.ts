/**
 * Type definitions for the Spec Editor feature
 */

// ============================================
// Session and Draft Types
// ============================================

/**
 * Represents an active spec editor webview session
 */
export interface SpecEditorSession {
    /** Unique identifier for this editor session */
    id: string;

    /** Optional name for the spec being created (set before submit) */
    specName?: string;

    /** Timestamp when session was created */
    createdAt: number;

    /** Current state of the editor */
    status: SpecEditorStatus;
}

export type SpecEditorStatus =
    | 'editing'      // User is composing content
    | 'previewing'   // User is viewing preview
    | 'submitting'   // Submission in progress
    | 'completed';   // Submission finished

/**
 * Represents unsaved spec content being edited
 */
export interface SpecDraft {
    /** Reference to parent session */
    sessionId: string;

    /** The text content of the spec */
    content: string;

    /** Cursor position for restoration */
    cursorPosition: number;

    /** Timestamp of last auto-save */
    lastSaved: number;
}

// ============================================
// Image Attachment Types
// ============================================

export type ImageFormat = 'png' | 'jpg' | 'gif' | 'webp';

/**
 * An image attached to a spec
 */
export interface AttachedImage {
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

// ============================================
// Temp File Types
// ============================================

export type TempFileStatus =
    | 'active'      // Files in use
    | 'submitted'   // Sent to CLI
    | 'completed'   // Workflow done, pending cleanup
    | 'orphaned';   // From previous session, pending cleanup

/**
 * A temporary markdown file generated from submitted spec
 */
export interface TempSpecFile {
    /** Unique identifier for this temp file set */
    id: string;

    /** Reference to parent session */
    sessionId: string;

    /** Path to the generated markdown file */
    markdownFilePath: string;

    /** Map of image IDs to their file paths */
    imageFilePaths: Record<string, string>;

    /** Timestamp when created */
    createdAt: number;

    /** Timestamp when files should be cleaned up */
    expiresAt: number;

    /** Current status */
    status: TempFileStatus;
}

/**
 * Manifest for tracking temp files across sessions
 */
export interface TempFileManifest {
    /** Schema version for migration */
    version: '1.0';

    /** Map of temp file set ID to metadata */
    files: Record<string, TempSpecFile>;

    /** Timestamp of last cleanup run */
    lastCleanup: number;
}

// ============================================
// Message Types: Webview → Extension
// ============================================

export type SpecEditorToExtensionMessage =
    | { type: 'submit'; content: string; images: string[] }
    | { type: 'preview' }
    | { type: 'attachImage'; name: string; size: number; dataUri: string }
    | { type: 'removeImage'; imageId: string }
    | { type: 'loadTemplate'; specPath: string }
    | { type: 'requestTemplateDialog' }
    | { type: 'cancel' };

// ============================================
// Message Types: Extension → Webview
// ============================================

export type ExtensionToSpecEditorMessage =
    | { type: 'imageSaved'; imageId: string; thumbnailUri: string; originalName: string }
    | { type: 'imageRemoved'; imageId: string }
    | { type: 'templateLoaded'; content: string }
    | { type: 'previewContent'; markdown: string }
    | { type: 'submissionStarted' }
    | { type: 'submissionComplete' }
    | { type: 'error'; message: string }
    | { type: 'restoreImages'; images: Array<{ id: string; thumbnailUri: string; originalName: string }> };

// ============================================
// Size Limits
// ============================================

export const SIZE_LIMITS = {
    /** Max 2MB per image */
    SINGLE_IMAGE_BYTES: 2 * 1024 * 1024,
    /** Max 10MB total attachments */
    TOTAL_ATTACHMENTS_BYTES: 10 * 1024 * 1024,
    /** Max 50,000 characters for draft content */
    DRAFT_CONTENT_CHARS: 50_000,
    /** Max 20 images per session */
    MAX_IMAGES: 20,
    /** Thumbnail dimensions */
    THUMBNAIL_SIZE: 100
} as const;

// ============================================
// Cleanup Thresholds
// ============================================

export const CLEANUP_THRESHOLDS = {
    /** 5 minutes grace period for completed files */
    COMPLETED_FILES_MS: 5 * 60 * 1000,
    /** 24 hours for orphaned files */
    ORPHANED_FILES_MS: 24 * 60 * 60 * 1000
} as const;
