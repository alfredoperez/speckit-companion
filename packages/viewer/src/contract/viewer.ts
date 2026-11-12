import type { ReviewCommentDoc } from './specContext';
import type { ViewerState } from './viewerState';

/** Ticked and total task boxes in a tasks document. */
export interface TaskCounts {
    checked: number;
    total: number;
}

/** Which banner a surface shows: the install pitch, or the out-of-date update naming both versions. */
export type InstallPrompt =
    | { kind: 'install' }
    | { kind: 'update'; installed: string; expected: string };

/**
 * The spec viewer's wire contract: everything the extension and the webview
 * both have to agree on — the document vocabulary, the payload shapes, and the
 * two message unions.
 *
 * It lives outside both features because it belongs to neither. Each side used
 * to declare its own copy of all of this, and they drifted: three message
 * variants existed on the extension side alone, posted from an inline script
 * that bypassed the webview's copy entirely.
 *
 * Keep this module free of `vscode` imports — the webview compiles it too.
 */
// ============================================
// Document Types
// ============================================

/**
 * Core document types in the spec workflow
 */
export type CoreDocumentType = 'spec' | 'plan' | 'tasks';

/**
 * Workflow-defined document types (custom step names like "design", "prototype")
 */
export type WorkflowDocumentType = string;

/**
 * Extended to include related and workflow documents
 * Related docs are identified by their filename
 */
export type DocumentType = CoreDocumentType | WorkflowDocumentType;

// ============================================
// Phase Types (for stepper)
// ============================================

/**
 * Phase completion information
 */
export interface PhaseInfo {
    /** Phase number (1=Spec, 2=Plan, 3=Tasks, 4=Done) */
    phase: 1 | 2 | 3 | 4;
    /** Phase label */
    label: string;
    /** Whether this phase's file exists */
    completed: boolean;
    /** Whether this is the currently viewed phase */
    active: boolean;
    /** For Tasks phase: completion percentage */
    progressPercent?: number;
}

/**
 * Document category for navigation
 */
export type DocumentCategory = 'core' | 'related' | 'action';

/**
 * Document type constants for consistency
 */
export const CORE_DOCUMENTS = {
    SPEC: 'spec',
    PLAN: 'plan',
    TASKS: 'tasks'
} as const;

/**
 * File name mapping for core documents
 */
export const CORE_DOCUMENT_FILES: Record<CoreDocumentType, string> = {
    spec: 'spec.md',
    plan: 'plan.md',
    tasks: 'tasks.md'
};

/**
 * Display name mapping for core documents
 */
export const CORE_DOCUMENT_LABELS: Record<CoreDocumentType, string> = {
    spec: 'Spec',
    plan: 'Plan',
    tasks: 'Tasks'
};

// ============================================
// Document and State Types
// ============================================

/**
 * Represents a document available in the spec viewer
 */
export interface SpecDocument {
    /** Document type for navigation */
    type: DocumentType;

    /** Label shown in tab (e.g., "Spec", "Plan", "Research") */
    label: string;

    /** Filename (e.g., "spec.md", "research.md") */
    fileName: string;

    /** Absolute file path */
    filePath: string;

    /** Whether the file exists on disk */
    exists: boolean;

    /** Whether this is a core document (spec/plan/tasks) */
    isCore: boolean;

    /** Category for navigation grouping */
    category: DocumentCategory;

    /** Parent workflow step name (e.g., 'specify') when discovered via subDir */
    parentStep?: string;
}

/**
 * Enhancement button configuration for footer
 */
export interface EnhancementButton {
    /** Button label */
    label: string;
    /** Command to execute */
    command: string;
    /** Icon to display */
    icon: string;
    /** Tooltip text */
    tooltip?: string;
}


/**
 * State for the spec viewer panel
 * Tracks which spec and document is currently displayed
 */
export interface SpecViewerState {
    /** Display name of the spec (derived from folder name) */
    specName: string;

    /** Bug-report mode: a `.specify/bugs/<slug>/` folder shown read-only, with no run record. */
    bug?: boolean;

    /** Which report set a read-only panel shows; bugs when a read-only panel names none. */
    reportSet?: 'bugs' | 'ideas';

    /** Absolute path to the spec directory */
    specDirectory: string;

    /** Absolute path to the change root (parent of specs/ subdir), or null for flat layout */
    changeRoot?: string | null;

    /** Currently displayed document type */
    currentDocument: DocumentType;

    /**
     * What the entry point asked to land on. Clicking a document row in the tree
     * is a request for that document; opening the spec itself is not, and leaves
     * this unset so the viewer's own rule decides.
     */
    landing?: 'overview' | 'document';

    /** Label of the document that was deleted while on screen, until the reader navigates. */
    removedDocument?: string;

    /** List of all available documents in this spec */
    availableDocuments: SpecDocument[];

    /** Timestamp of last content update */
    lastUpdated: number;

    /** Phase information for the stepper */
    phases: PhaseInfo[];

    /** Current phase number (1-4) */
    currentPhase: 1 | 2 | 3 | 4;

    /** Task completion percentage (0-100) */
    taskCompletionPercent: number;

    /** Ticked and total task boxes in tasks.md, cached beside the percentage they produce. */
    taskCounts?: TaskCounts;
}

// ============================================
// Staleness Types
// ============================================

/**
 * Staleness information for a single document
 */
export interface StalenessInfo {
    /** Whether this document is stale relative to its upstream */
    isStale: boolean;
    /** Human-readable reason (e.g., "Plan was generated before the current spec") */
    staleReason: string;
    /** Label of the newest upstream document that caused staleness */
    newerUpstream: string;
}

/**
 * Map of document type to its staleness state
 */
export type StalenessMap = Record<DocumentType, StalenessInfo>;

// ============================================
// Message Protocols
// ============================================

/**
 * Navigation state for message-based updates.
 *
 * Footer-relevant duplicates (`footerState`, `runningStep*`) were removed: the
 * footer now derives entirely from the serialized `ViewerState`. `NavState`
 * carries only navigation/document concerns plus the workflow-derived
 * `enhancementButtons`.
 */
export interface NavState<Report = unknown> {
    /** The next steps a bug or idea page offers, computed from its files; report panels only. */
    reportActions?: { id: string; label: string; primary: boolean }[];
    /** Which report set the panel shows and, on the Story or Decision document, its page model; report panels only. */
    report?: Report;
    /** Header title came from the document's own H1, so skip slug casing. */
    titleFromHeading?: boolean;
    /** Core documents with existence state */
    coreDocs: SpecDocument[];
    /** Related documents */
    relatedDocs: SpecDocument[];
    /** Currently displayed document type */
    currentDoc: DocumentType;
    /** Current workflow phase (step type of the last existing doc) */
    workflowPhase: string;
    /** Task completion percentage */
    taskCompletionPercent: number;
    /** Ticked and total task boxes in tasks.md: the header's task count, from the same read as the percentage. */
    taskCounts?: TaskCounts;
    /** Whether viewing a related doc */
    isViewingRelatedDoc: boolean;
    /** Enhancement buttons config */
    enhancementButtons?: EnhancementButton[];
    /** Staleness state for each core document */
    stalenessMap?: StalenessMap;
    /** Spec status (read by the header badge fallback; not a footer input) */
    specStatus?: string;
    /** tasks.md text beside the spec, for the spec page's per-story progress; "" when absent, left out when the refresh read no files. */
    tasksMarkdown?: string;
    /** Current task ID from spec-context (for in-progress badge) */
    currentTask?: string | null;
    /** Active workflow step being worked on (mapped to tab name: spec/plan/tasks) — drives step-tab in-flight visuals */
    activeStep?: string | null;
    /** Step history for determining completed steps */
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
    /** Badge text for the metadata bar */
    badgeText?: string | null;
    /** Created date derived from spec-context stepHistory */
    createdDate?: string | null;
    /** Last updated date derived from spec-context stepHistory/updated */
    lastUpdatedDate?: string | null;
    /** Human-readable spec name from spec-context.json */
    specContextName?: string | null;
    /** Git branch name from spec-context.json (workingBranch with fallback to branch) */
    branch?: string | null;
    /** currentStep from spec-context.json — drives implement-phase pill on the last step tab */
    currentStep?: string | null;
    /** Current document file path */
    filePath?: string | null;
    /** Display label for the current doc type (e.g., "Spec", "Plan") */
    docTypeLabel?: string | null;
    /** Whether the Activity toggle is shown (from `speckit.viewer.activityPanel` setting). */
    activityPanelEnabled?: boolean;
    /**
     * The landing the entry point asked for, when it asked. Set to `'document'`
     * by a tree click on a specific document; absent when the spec was opened as
     * a whole, which is the case the viewer's own landing rule is for.
     */
    landing?: 'overview' | 'document';
    /** Label of the document that was deleted while it was showing, so the fallback is not silent. */
    removedDocument?: string | null;
    /** Which banner the Activity panel renders (viewer only): install, update, or none. */
    installPrompt?: InstallPrompt | null;
    /** Run-recovery affordance for a quiet in-flight run (issue #418). */
    runRecovery?: { show: boolean; mode: 'stalled' | 'stale'; message: string; minutesQuiet: number };
    /** Display name of the assistant the spec's last step was sent to; feature spec panels only. */
    assistantName?: string;
    /** True while the spec has a live terminal Companion opened. */
    hasTerminal?: boolean;
}

/**
 * Messages sent from extension to webview
 */
export type ExtensionToViewerMessage<State = ViewerState, Report = unknown> =
    | {
          type: 'contentUpdated';
          content: string;
          documentType: DocumentType;
          specName: string;
          /** Navigation state for updating tabs without full page reload */
          navState?: NavState<Report>;
          /** Derived ViewerState (status, pulse, highlights, footer, substep). */
          viewerState?: State;
      }
    | {
          type: 'documentsUpdated';
          documents: SpecDocument[];
          currentDocument: DocumentType;
      }
    | {
          type: 'error';
          message: string;
          recoverable: boolean;
      }
    | {
          type: 'fileDeleted';
          filePath: string;
      }
    // The spec folder the panel is keyed by no longer exists (moved, renamed or
    // deleted). The panel cannot follow it; the reader reopens from the sidebar.
    | {
          type: 'specMoved';
          specDirectory: string;
      }
    | {
          type: 'navStateUpdated';
          navState: NavState<Report>;
      }
    | {
          type: 'viewerStateUpdated';
          /** Complete derived ViewerState — the footer's sole input. */
          viewerState: State;
          /** Complete NavState — never a partial; carries nav-only fields (enhancementButtons, docs, dates) so no footer-affecting message is partial. */
          navState: NavState<Report>;
      }
    | {
          type: 'actionToast';
          message: string;
      };

/**
 * Messages sent from webview to extension
 */
export type ViewerToExtensionMessage =
    | {
          type: 'switchDocument';
          documentType: DocumentType;
      }
    | {
          type: 'editDocument';
      }
    | {
          type: 'refreshContent';
      }
    | {
          type: 'ready';
      }
    // Hover action messages
    | {
          type: 'refineLine';
          lineNum: number;
          content: string;
          instruction: string;
      }
    | {
          type: 'editLine';
          lineNum: number;
          newText: string;
      }
    | {
          type: 'removeLine';
          lineNum: number;
      }
    // Task checkbox toggle
    | {
          type: 'toggleCheckbox';
          lineNum: number;
          checked: boolean;
      }
    // Footer action messages
    | {
          type: 'editSource';
      }
    | {
          type: 'regenerate';
      }
    | {
          type: 'approve';
      }
    | {
          type: 'showTerminal';
      }
    | {
          type: 'clarify';
          command?: string;
      }
    | {
          type: 'footerAction';
          id: string;
      }
    | {
          type: 'stepperClick';
          phase: string;
      }
    // Persisted review comments — written to .spec-context.json on each mutation.
    // `doc` is any document the viewer can show, not just the three core ones:
    // the stored type (`ReviewCommentDoc`) was widened for `data-model`,
    // `research` and the like, and the viewer has been sending them all along —
    // this wire type stayed narrow only because each side checked its own copy.
    | {
          type: 'addComment';
          id: string;
          doc: ReviewCommentDoc;
          lineNum: number;
          lineContent: string;
          comment: string;
      }
    | {
          type: 'removeComment';
          id: string;
      }
    | {
          type: 'editComment';
          id: string;
          comment: string;
      }
    // Run refinement for one document's pending comments (inline button + Activity)
    | {
          type: 'runDocRefinement';
          doc: ReviewCommentDoc;
      }
    // Lifecycle actions
    | {
          type: 'completeSpec';
      }
    | {
          type: 'archiveSpec';
      }
    | {
          type: 'reactivateSpec';
      }
    // Run-recovery affordance (issue #418) — quiet in-flight run
    | {
          type: 'resumeRun';
      }
    | {
          type: 'setStatus';
      }
    // The reader chose the Overview inside the viewer, so the entry point's
    // document request is spent. Sent because a content refresh reassigns the
    // panel HTML and the webview's own mode does not survive that.
    | {
          type: 'overviewChosen';
      }
    // A bug or idea page's footer button: the id only, the extension re-reads the item
    | {
          type: 'reportAction';
          id: string;
      }
    // An answer to one open question on a bug or idea report; the extension checks the question against the file
    | {
          type: 'reportAnswer';
          question: string;
          answer: string;
          document: string;
      }
    // A spec's Source row that names an idea folder
    | {
          type: 'openIdea';
          folder: string;
      }
    // File reference click
    | {
          type: 'openFile';
          filename: string;
          line?: number;
      }
    // Webview render-time error (reported by error boundaries)
    | {
          type: 'webviewError';
          source: string;
          message: string;
          stack?: string;
      }
    // Install banner actions (shown only when the spec-kit extension is missing)
    | {
          type: 'installSpecKitExtension';
          /** The banner that was clicked, so the click is attributed to the install or the update prompt. */
          prompt?: InstallPrompt;
      }
    | {
          type: 'openReadme';
      }
    | {
          type: 'dismissInstallBanner';
          /** The banner that was closed, so the right dismissal flag is written even if the gap has since changed. */
          prompt: InstallPrompt;
      };
