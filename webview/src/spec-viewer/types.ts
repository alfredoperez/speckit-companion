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
    category?: 'core' | 'related' | 'action';
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
 * Navigation state for message-based updates.
 *
 * Footer-relevant duplicates (`footerState`, `runningStep*`) were removed: the
 * footer now derives entirely from `ViewerState`. `NavState` carries only
 * navigation/document concerns plus the workflow-derived `enhancementButtons`.
 */
/**
 * Capability facts shown in the header for a living spec.
 *
 * Every optional field is absent — never zeroed — when it could not be
 * determined, so "no coverage tier" stays distinguishable from "nothing
 * covered". Mirrors `LivingHeaderMeta` on the extension side.
 */
export interface LivingHeaderMeta {
    capabilityName: string;
    specPath: string;
    location: 'centralized' | 'colocated';
    match: string[];
    requirements?: number;
    scenarios?: number;
    coverage?: { covered: number; total: number };
    drifted?: boolean;
}

export interface NavState {
    /** Living-spec mode: hide the workflow stepper and footer. */
    livingMode?: boolean;
    /** Capability facts for the header; living-spec mode only. */
    livingMeta?: LivingHeaderMeta | null;
    /** Header title came from the document's own H1, so skip slug casing. */
    titleFromHeading?: boolean;
    coreDocs: SpecDocument[];
    relatedDocs: SpecDocument[];
    currentDoc: DocumentType;
    workflowPhase: string;
    taskCompletionPercent: number;
    isViewingRelatedDoc: boolean;
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
    /** Whether the Activity toggle is shown (from `speckit.viewer.activityPanel` setting). */
    activityPanelEnabled?: boolean;
    /** Whether to render the install banner inside the Activity panel (viewer only). */
    showInstallPrompt?: boolean;
    /** Run-recovery affordance for a quiet in-flight run (issue #418). */
    runRecovery?: { show: boolean; mode: 'stalled' | 'stale'; message: string; minutesQuiet: number };
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

export interface HistoryEntryFrom {
    step: string | null;
    substep: string | null;
}

export interface HistoryEntry {
    step: string;
    substep: string | null;
    /** Per-task id on implement entries (substep is null on these). */
    task?: string;
    kind?: 'start' | 'complete';
    /** Legacy, read-only: writers no longer emit it. Present on old records. */
    from?: HistoryEntryFrom;
    by: string;
    at: string;
}

/** @deprecated Renamed to `HistoryEntryFrom`. */
export type TransitionFrom = HistoryEntryFrom;
/** @deprecated Renamed to `HistoryEntry`. */
export type Transition = HistoryEntry;

export interface SubstepEntry {
    name: string;
    startedAt: string;
    completedAt: string | null;
}

export interface StepHistoryEntry {
    startedAt: string;
    completedAt: string | null;
    /** Array form on some specs, Record form on others — normalize at consumer. */
    substeps?: SubstepEntry[] | Record<string, { startedAt: string; completedAt: string | null }>;
    /** True only when both boundaries were extension-stamped — spans safe to present as durations. */
    durationTrusted?: boolean;
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

/** Normalized reasoning-trail entries (mirror of the extension's Viewer* types). */
export interface ViewerDecision {
    decision: string;
    why?: string;
    rejected?: string;
}

export interface ViewerVerification {
    what: string;
    result?: string;
    command?: string;
    warnings?: string[];
}

export interface ViewerCoverageRow {
    req: string;
    title?: string;
    tasks: string[];
    tests: string[];
}

export interface ClassificationEntry {
    projectedFiles?: number;
    projectedTasks?: number;
    scopeSignal?: string;
    verdict: string;
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
    history: HistoryEntry[];
    stepHistory: Record<string, StepHistoryEntry>;
    approach?: string;
    lastAction?: string;
    taskSummaries?: Record<string, TaskSummary>;
    /** Normalized: legacy string entries arrive as `{decision}`. */
    decisions?: ViewerDecision[];
    concerns?: ConcernEntry[];
    filesModified?: string[];
    prUrl?: string;
    prNumber?: number;
    checkpointStatus?: CheckpointStatus;
    stepSummaries?: Record<string, Record<string, unknown>>;
    /** Persisted inline review comments, for restore + the Activity list. */
    reviewComments?: ReviewComment[];
    /** Living specs this feature loaded/synced (LS·7). Absent when none. */
    livingSpecs?: LivingSpecsView;
    /** Reasoning-trail capture, normalized for rendering. */
    intent?: string;
    expectations?: string[];
    context?: string[];
    verified?: ViewerVerification[];
    coverage?: ViewerCoverageRow[];
    classification?: ClassificationEntry;
}

/** Normalized living-specs view: loaded into context + folded back at completion. */
export interface LivingSpecsView {
    loaded: string[];
    synced: string[];
    /**
     * Per-capability readable content, resolved and parsed extension-side.
     * Absent when content loading wasn't attempted (legacy payloads render the
     * names-only list). Every loaded/synced name appears exactly once.
     */
    capabilities?: CapabilityContentView[];
}

/** One touched capability, pre-parsed for rendering: plain text only. */
export interface CapabilityContentView {
    name: string;
    /** False when the spec file is missing, unreadable, out-of-root, oversized, or unresolved. */
    available: boolean;
    /** Intro paragraph before the requirements section, marker-stripped. */
    purpose?: string;
    /** One row per requirement heading; text is the first body paragraph, marker-stripped. */
    requirements?: { id: string; text: string }[];
    synced: boolean;
    /** Fold-back counts from the feature spec's delta blocks; absent when none (never zeros). */
    delta?: { added?: number; modified?: number; removed?: number; renamed?: number };
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
    // Run-recovery affordance (issue #418) — quiet in-flight run
    | { type: 'resumeRun' }
    | { type: 'setStatus' }
    // Stepper navigation
    | { type: 'stepperClick'; phase: string }
    // Persisted review comments — written to .spec-context.json on each mutation
    | { type: 'addComment'; id: string; doc: DocumentType; lineNum: number; lineContent: string; comment: string }
    | { type: 'removeComment'; id: string }
    | { type: 'editComment'; id: string; comment: string }
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
    | { type: 'viewerStateUpdated'; viewerState: ViewerState; navState?: NavState }
    | { type: 'livingHealthResolved'; livingMeta: LivingHeaderMeta }
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
    /** Whether the comment is still awaiting refinement, or already dispatched. */
    status: ReviewCommentStatus;
}
