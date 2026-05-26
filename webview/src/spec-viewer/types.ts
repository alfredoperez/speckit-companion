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
    /** Spec 099: running step's artifact exists with non-trivial content. */
    runningStepArtifactReady?: boolean;
    /** Spec 099: `startedAt` of the running step, for footer timeout recovery. */
    runningStepStartedAt?: string | null;
    /** Spec 099: human label of the running step (e.g. "Tasks", "Implementation"). */
    runningStepLabel?: string | null;
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    badgeText?: string | null;
    createdDate?: string | null;
    lastUpdatedDate?: string | null;
    specContextName?: string | null;
    branch?: string | null;
    currentStep?: string | null;
    filePath?: string | null;
    docTypeLabel?: string | null;
    activityPanelMode?: 'off' | 'beta' | 'on';
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

export interface TransitionFrom {
    step: string | null;
    substep: string | null;
}

export interface Transition {
    step: string;
    substep: string | null;
    from: TransitionFrom;
    by: string;
    at: string;
}

export interface SubstepEntry {
    name: string;
    startedAt: string;
    completedAt: string | null;
}

export interface StepHistoryEntry {
    startedAt: string;
    completedAt: string | null;
    /** Array on SDD specs, Record on speckit specs — normalize at consumer. */
    substeps?: SubstepEntry[] | Record<string, { startedAt: string; completedAt: string | null }>;
}

export interface TaskSummary {
    status: string;
    did?: string;
    files?: string[];
    concerns?: string[];
}

export interface ConcernEntry {
    task?: string;
    note: string;
}

export interface CheckpointStatus {
    commit?: boolean;
    pr?: boolean;
}

// ============================================
// Persisted review comments
// ============================================

export type ReviewCommentStatus = 'pending' | 'applied';

export interface ReviewCommentAnchor {
    heading: string | null;
    blockText: string;
    line: number;
}

/** A persisted inline review comment (mirrors the extension `ReviewComment`). */
export interface ReviewComment {
    id: string;
    doc: DocumentType;
    anchor: ReviewCommentAnchor;
    comment: string;
    status: ReviewCommentStatus;
    createdAt: string;
}

export interface ViewerState {
    status: string;
    activeStep: string;
    steps: Record<string, StepBadgeState>;
    pulse: string | null;
    highlights: string[];
    activeSubstep: { step: string; name: string } | null;
    footer: SerializedFooterAction[];
    transitions: Transition[];
    stepHistory: Record<string, StepHistoryEntry>;
    approach?: string;
    lastAction?: string;
    taskSummaries?: Record<string, TaskSummary>;
    decisions?: string[];
    concerns?: ConcernEntry[];
    filesModified?: string[];
    prUrl?: string;
    prNumber?: number;
    checkpointStatus?: CheckpointStatus;
    stepSummaries?: Record<string, Record<string, unknown>>;
    /** Persisted inline review comments, for restore + the Activity list. */
    reviewComments?: ReviewComment[];
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
    // Spec 099: manual completion fallback for the running step
    | { type: 'markStepComplete' }
    // Lifecycle actions
    | { type: 'completeSpec' }
    | { type: 'archiveSpec' }
    | { type: 'reactivateSpec' }
    // Stepper navigation
    | { type: 'stepperClick'; phase: string }
    // Persisted review comments — written to .spec-context.json on each mutation
    | { type: 'addComment'; id: string; doc: DocumentType; lineNum: number; lineContent: string; comment: string }
    | { type: 'removeComment'; id: string }
    // Run refinement for one document's pending comments (from the Activity list)
    | { type: 'runDocRefinement'; doc: DocumentType }
    // File reference click
    | { type: 'openFile'; filename: string }
    // Webview render-time error (reported by error boundaries)
    | { type: 'webviewError'; source: string; message: string; stack?: string };

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
