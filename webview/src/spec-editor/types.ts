/**
 * Type definitions for the Spec Editor webview (browser-side)
 */

// ============================================
// VS Code API Types
// ============================================

export interface VSCodeApi {
    postMessage: (message: SpecEditorToExtensionMessage) => void;
    getState: <T>() => T | undefined;
    setState: <T>(state: T) => void;
}

// ============================================
// Message Types: Webview → Extension
// ============================================

export type SpecEditorToExtensionMessage =
    | { type: 'submit'; content: string; images: string[]; workflow: string }
    | { type: 'preview' }
    | { type: 'attachImage'; name: string; size: number; dataUri: string }
    | { type: 'removeImage'; imageId: string }
    | { type: 'loadTemplate'; specPath: string }
    | { type: 'requestTemplateDialog' }
    | { type: 'ready' }
    | { type: 'cancel' };

// ============================================
// Message Types: Extension → Webview
// ============================================

export interface WorkflowDefinition {
    name: string;
    displayName: string;
    description?: string;
}

export type ExtensionToSpecEditorMessage =
    | { type: 'init'; workflows: WorkflowDefinition[] }
    | { type: 'imageSaved'; imageId: string; thumbnailUri: string; originalName: string }
    | { type: 'imageRemoved'; imageId: string }
    | { type: 'templateLoaded'; content: string }
    | { type: 'previewContent'; markdown: string }
    | { type: 'submissionStarted' }
    | { type: 'submissionComplete' }
    | { type: 'error'; message: string }
    | { type: 'restoreImages'; images: Array<{ id: string; thumbnailUri: string; originalName: string }> };

// ============================================
// Webview State Types
// ============================================

/**
 * State saved in the webview via vscode.setState
 */
export interface SpecEditorWebviewState {
    /** Draft content */
    content: string;

    /** Cursor position for restoration */
    cursorPosition: number;

    /** IDs of attached images */
    attachedImageIds: string[];

    /** Timestamp of last save */
    lastSaved: number;
}

// ============================================
// UI State Types
// ============================================

export interface AttachedImageUI {
    id: string;
    thumbnailUri: string;
    originalName: string;
}

// ============================================
// Size Limits (mirrored from extension)
// ============================================

export const SIZE_LIMITS = {
    /** Max 2MB per image */
    SINGLE_IMAGE_BYTES: 2 * 1024 * 1024,
    /** Max 10MB total attachments */
    TOTAL_ATTACHMENTS_BYTES: 10 * 1024 * 1024,
    /** Max 50,000 characters for draft content */
    DRAFT_CONTENT_CHARS: 50_000,
    /** Max 20 images per session */
    MAX_IMAGES: 20
} as const;

// ============================================
// Supported Image Formats
// ============================================

export const SUPPORTED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
] as const;

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const;
