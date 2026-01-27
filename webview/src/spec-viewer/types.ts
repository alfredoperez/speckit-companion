/**
 * Type definitions for the Spec Viewer webview
 */

// ============================================
// VS Code API Types
// ============================================

export interface VSCodeApi {
    postMessage: (message: ViewerToExtensionMessage) => void;
    getState: <T>() => T | undefined;
    setState: <T>(state: T) => void;
}

// ============================================
// Document Types (mirrored from extension)
// ============================================

export type CoreDocumentType = 'spec' | 'plan' | 'tasks';
export type DocumentType = CoreDocumentType | string;

export interface SpecDocument {
    type: DocumentType;
    displayName: string;
    fileName: string;
    filePath: string;
    exists: boolean;
    isCore: boolean;
    category?: 'core' | 'related';
}

/**
 * Footer button state for message-based updates
 */
export interface FooterState {
    showApproveButton: boolean;
    approveText: string;
}

/**
 * Navigation state for message-based updates
 */
export interface NavState {
    coreDocs: SpecDocument[];
    relatedDocs: SpecDocument[];
    currentDoc: DocumentType;
    workflowPhase: 'spec' | 'plan' | 'tasks' | 'done';
    taskCompletionPercent: number;
    isViewingRelatedDoc: boolean;
    footerState?: FooterState;
}

// ============================================
// Webview State
// ============================================

/**
 * State saved in webview for restoration
 */
export interface ViewerWebviewState {
    /** Currently selected document type */
    currentDocument: DocumentType;

    /** Scroll position in content area */
    scrollPosition: number;

    /** Last known spec directory */
    specDirectory: string;
}

// ============================================
// Message Types: Webview → Extension
// ============================================

export type ViewerToExtensionMessage =
    | { type: 'switchDocument'; documentType: DocumentType }
    | { type: 'editDocument' }
    | { type: 'refreshContent' }
    | { type: 'ready' }
    // Hover action messages
    | { type: 'refineLine'; lineNum: number; content: string; instruction: string }
    | { type: 'editLine'; lineNum: number; newText: string }
    | { type: 'removeLine'; lineNum: number }
    // Task checkbox toggle
    | { type: 'toggleCheckbox'; lineNum: number; checked: boolean }
    // Footer action messages
    | { type: 'editSource' }
    | { type: 'regenerate' }
    | { type: 'approve' }
    | { type: 'clarify' }
    // Stepper navigation
    | { type: 'stepperClick'; phase: 'spec' | 'plan' | 'tasks' | 'done' }
    // Batch refinements submission (GitHub-style review)
    | { type: 'submitRefinements'; refinements: Array<{ lineNum: number; lineContent: string; comment: string }> };

// ============================================
// Message Types: Extension → Webview
// ============================================

export type ExtensionToViewerMessage =
    | { type: 'contentUpdated'; content: string; documentType: DocumentType; specName: string; navState?: NavState }
    | { type: 'documentsUpdated'; documents: SpecDocument[]; currentDocument: DocumentType }
    | { type: 'error'; message: string; recoverable: boolean }
    | { type: 'fileDeleted'; filePath: string }
    | { type: 'navStateUpdated'; navState: NavState };

// ============================================
// Refinement Types (GitHub-style review)
// ============================================

/**
 * Line type for context-aware quick actions
 */
export type LineType = 'user-story' | 'acceptance' | 'task' | 'section' | 'paragraph';

/**
 * A pending refinement comment on a specific line
 */
export interface Refinement {
    /** Unique identifier for the refinement */
    id: string;
    /** Source line number in the document */
    lineNum: number;
    /** Original content of the line */
    lineContent: string;
    /** User's comment/instruction for refinement */
    comment: string;
    /** Type of line for context-aware actions */
    lineType: LineType;
}
