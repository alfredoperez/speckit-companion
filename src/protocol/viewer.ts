import type { ReviewCommentDoc } from '../core/types/specContext';

/** Which banner a surface shows: the install pitch, or the out-of-date update naming both versions. */
export type InstallPrompt =
    | { kind: 'install' }
    | { kind: 'update'; installed: string; expected: string };

export { updateBannerText } from './installBannerBody';

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

    /**
     * Living-spec document mode: the panel renders a capability's living spec
     * (and its tier siblings) with no workflow chrome — no stepper, no footer
     * actions, no `.spec-context.json` reads or backfills.
     */
    living?: boolean;

    /**
     * The tier file the living panel was opened from. Tier siblings are
     * derived from this path, not from the directory — a colocated spec
     * (`storage.spec.md`) has no `spec.md` in its directory.
     */
    livingSourcePath?: string;

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
// Living Spec Header
// ============================================

/**
 * Capability facts shown in the viewer header for a living spec.
 *
 * Every optional field is absent — never zeroed — when it could not be
 * determined, so "no coverage tier" stays distinguishable from "nothing
 * covered". `coverage` and `drifted` come from the Living Specs sidebar's own
 * `readCapabilityHealth`, so the two surfaces cannot disagree.
 */
export interface LivingHeaderMeta {
    capabilityName: string;
    /** Repo-relative POSIX path of the spec file. */
    specPath: string;
    location: 'centralized' | 'colocated';
    /** Membership globs the capability claims. May be empty. */
    match: string[];
    requirements?: number;
    scenarios?: number;
    coverage?: { covered: number; total: number };
    drifted?: boolean;
}

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
export interface NavState {
    /** Living-spec mode: webview hides the workflow stepper and footer. */
    livingMode?: boolean;
    /** Capability facts for the header; living-spec mode only. */
    livingMeta?: LivingHeaderMeta | null;
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
    /** Whether viewing a related doc */
    isViewingRelatedDoc: boolean;
    /** Enhancement buttons config */
    enhancementButtons?: EnhancementButton[];
    /** Staleness state for each core document */
    stalenessMap?: StalenessMap;
    /** Spec status (read by the header badge fallback; not a footer input) */
    specStatus?: string;
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
    /** Which banner the Activity panel renders (viewer only): install, update, or none. */
    installPrompt?: InstallPrompt | null;
    /** Run-recovery affordance for a quiet in-flight run (issue #418). */
    runRecovery?: { show: boolean; mode: 'stalled' | 'stale'; message: string; minutesQuiet: number };
}

/**
 * Messages sent from extension to webview
 */
export type ExtensionToViewerMessage =
    | {
          type: 'contentUpdated';
          content: string;
          documentType: DocumentType;
          specName: string;
          /** Navigation state for updating tabs without full page reload */
          navState?: NavState;
          /** Derived ViewerState (status, pulse, highlights, footer, substep). */
          viewerState?: import('../core/types/specContext').ViewerState;
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
    | {
          type: 'navStateUpdated';
          navState: NavState;
      }
    | {
          type: 'viewerStateUpdated';
          /** Complete derived ViewerState — the footer's sole input. */
          viewerState: import('../core/types/specContext').ViewerState;
          /** Complete NavState — never a partial; carries nav-only fields (enhancementButtons, docs, dates) so no footer-affecting message is partial. */
          navState: NavState;
      }
    | {
          type: 'livingHealthResolved';
          /** The fact bundle with coverage/drift folded in, once the health call returns. */
          livingMeta: LivingHeaderMeta;
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
    // Living-spec drift → fold the changed code back into the spec
    | {
          type: 'livingUpdate';
      }
    // Re-check this capability against the code — the header's action when nothing has drifted
    | {
          type: 'livingCheckDrift';
      }
    // Update every drifted living spec from the current changes — the footer's second action
    | {
          type: 'livingSyncAll';
      }
    // A Covers glob was clicked: reveal its folder in the Explorer
    | {
          type: 'revealGlob';
          glob: string;
      }
    // The reader chose the Overview inside the viewer, so the entry point's
    // document request is spent. Sent because a content refresh reassigns the
    // panel HTML and the webview's own mode does not survive that.
    | {
          type: 'overviewChosen';
      }
    // File reference click
    | {
          type: 'openFile';
          filename: string;
      }
    // Living-specs chip click — open the capability in the Living Specs viewer
    | {
          type: 'openLivingSpec';
          capabilityName: string;
          specPath?: string;
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
      }
    | {
          type: 'openReadme';
      }
    | {
          type: 'dismissInstallBanner';
      };
