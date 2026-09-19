/**
 * Type definitions for the Spec Editor feature
 */

export type { WorkflowChosenAs, WorkflowDefinition, SpecEditorToExtensionMessage, ExtensionToSpecEditorMessage } from '../../protocol/spec-editor';
export { SIZE_LIMITS } from '../../protocol/spec-editor';

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

    /**
     * For workspace-staged image sets (OpenCode): the in-workspace
     * `.speckit-companion/spec-editor/<id>/` dir the cleanup sweep deletes.
     * Absent for ordinary globalStorage temp sets (cleaned under baseDir/<id>).
     */
    workspaceStageDir?: string;

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
// Cleanup Thresholds
// ============================================

export const CLEANUP_THRESHOLDS = {
    /** 5 minutes grace period for completed files */
    COMPLETED_FILES_MS: 5 * 60 * 1000,
    /** 24 hours for orphaned files */
    ORPHANED_FILES_MS: 24 * 60 * 60 * 1000
} as const;
