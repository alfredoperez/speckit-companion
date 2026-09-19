/**
 * Type definitions for the Spec Editor webview (browser-side)
 */

export type {
    WorkflowChosenAs,
    WorkflowDefinition,
    SpecEditorToExtensionMessage,
    ExtensionToSpecEditorMessage
} from '../../../src/protocol/spec-editor';
export { SIZE_LIMITS } from '../../../src/protocol/spec-editor';

import type { SpecEditorToExtensionMessage } from '../../../src/protocol/spec-editor';

// ============================================
// VS Code API Types
// ============================================

export interface VSCodeApi {
    postMessage: (message: SpecEditorToExtensionMessage) => void;
    getState: <T>() => T | undefined;
    setState: <T>(state: T) => void;
}

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
// Supported Image Formats
// ============================================

export const SUPPORTED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
] as const;

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const;
