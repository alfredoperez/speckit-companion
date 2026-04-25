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
    label: string;
    fileName: string;
    filePath: string;
    exists: boolean;
    isCore: boolean;
    category?: 'core' | 'related';
    parentStep?: string;
}

/**
 * Enhancement button configuration
 */
export interface EnhancementButton {
    label: string;
    command: string;
    icon: string;
    tooltip?: string;
}

/**
 * Staleness information for a single document
 */
export interface StalenessInfo {
    isStale: boolean;
    staleReason: string;
    newerUpstream: string;
}

/**
 * Map of document type to its staleness state
 */
export type StalenessMap = Record<DocumentType, StalenessInfo>;

/**
 * Footer button state for message-based updates
 */
export interface FooterState {
    showApproveButton: boolean;
    approveText: string;
    enhancementButtons?: EnhancementButton[];
    specStatus?: string;
}

/**
 * Navigation state for message-based updates
 */
export interface NavState {
    coreDocs: SpecDocument[];
    relatedDocs: SpecDocument[];
    currentDoc: DocumentType;
    workflowPhase: string;
    taskCompletionPercent: number;
    isViewingRelatedDoc: boolean;
    footerState?: FooterState;
    enhancementButtons?: EnhancementButton[];
    stalenessMap?: StalenessMap;
    specStatus?: string;
    currentTask?: string | null;
    activeStep?: string | null;
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    badgeText?: string | null;
    createdDate?: string | null;
    lastUpdatedDate?: string | null;
    specContextName?: string | null;
    branch?: string | null;
    currentStep?: string | null;
    filePath?: string | null;
    docTypeLabel?: string | null;
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
// Viewer State (derived from SpecContext)
// ============================================

export type StepBadgeState = 'not-started' | 'in-progress' | 'completed';
export type FooterScope = 'spec' | 'step';

/** Serializable footer action — visibleWhen function is stripped before send. */
export interface SerializedFooterAction {
    id: string;
    label: string;
    scope: FooterScope;
    tooltip: string;
}

export interface ViewerState {
    status: string;
    activeStep: string;
    steps: Record<string, StepBadgeState>;
    pulse: string | null;
    highlights: string[];
    activeSubstep: { step: string; name: string } | null;
    footer: SerializedFooterAction[];
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
    | { type: 'clarify'; command?: string }
    | { type: 'footerAction'; id: string }
    // Lifecycle actions
    | { type: 'completeSpec' }
    | { type: 'archiveSpec' }
    | { type: 'reactivateSpec' }
    // Stepper navigation
    | { type: 'stepperClick'; phase: string }
    // Batch refinements submission (GitHub-style review)
    | { type: 'submitRefinements'; refinements: Array<{ lineNum: number; lineContent: string; comment: string }> }
    // File reference click
    | { type: 'openFile'; filename: string };

// ============================================
// Message Types: Extension → Webview
// ============================================

export type ExtensionToViewerMessage =
    | { type: 'contentUpdated'; content: string; documentType: DocumentType; specName: string; navState?: NavState; viewerState?: ViewerState }
    | { type: 'documentsUpdated'; documents: SpecDocument[]; currentDocument: DocumentType }
    | { type: 'error'; message: string; recoverable: boolean }
    | { type: 'fileDeleted'; filePath: string }
    | { type: 'navStateUpdated'; navState: NavState }
    | { type: 'viewerStateUpdated'; viewerState: ViewerState }
    | { type: 'actionToast'; message: string };

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
