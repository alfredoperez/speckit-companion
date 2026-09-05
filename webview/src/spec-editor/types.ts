/**
 * Type definitions for the Spec Editor webview (browser-side)
 */

import type { InstallPrompt } from '../../../src/protocol/viewer';

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

/** How the workflow was selected: untouched pre-selection, ordinary change, or the one-spec Companion trial. */
export type WorkflowChosenAs = 'default' | 'picked' | 'trial';

export type SpecEditorToExtensionMessage =
    | { type: 'submit'; content: string; images: string[]; workflow: string; chosenAs: WorkflowChosenAs }
    | { type: 'submitAuto'; content: string; images: string[]; workflow: string; chosenAs: WorkflowChosenAs }
    | { type: 'submitCommand'; content: string; images: string[]; workflow: string; chosenAs: WorkflowChosenAs; command: string }
    | { type: 'preview' }
    | { type: 'attachImage'; name: string; size: number; dataUri: string }
    | { type: 'removeImage'; imageId: string }
    | { type: 'ready' }
    | { type: 'cancel' }
    | { type: 'installSpecKitExtension' }
    | { type: 'openReadme' }
    | { type: 'dismissInstallBanner'; prompt: InstallPrompt };

// ============================================
// Message Types: Extension → Webview
// ============================================

export interface WorkflowDefinition {
    name: string;
    displayName: string;
    /** Rendered visibly on the choice card — never only a tooltip. */
    description: string;
    /** false renders the card in its install-to-enable state. */
    installed: boolean;
    specifyCommands?: Array<{ name: string; title: string; command: string; tooltip?: string }>;
    supportsAuto?: boolean;
}

export type ExtensionToSpecEditorMessage =
    | { type: 'init'; workflows: WorkflowDefinition[]; defaultWorkflow?: string }
    | { type: 'imageSaved'; imageId: string; thumbnailUri: string; originalName: string }
    | { type: 'imageRemoved'; imageId: string }
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
