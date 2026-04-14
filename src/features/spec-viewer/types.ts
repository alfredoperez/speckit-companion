/**
 * Type definitions for the Spec Viewer feature
 */

import * as vscode from 'vscode';
import { SpecStatuses } from '../../core/constants';

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
export type DocumentCategory = 'core' | 'related';

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

    /** Absolute path to the spec directory */
    specDirectory: string;

    /** Absolute path to the change root (parent of specs/ subdir), or null for flat layout */
    changeRoot?: string | null;

    /** Currently displayed document type */
    currentDocument: DocumentType;

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
// Panel Configuration
// ============================================

/**
 * Configuration for creating the viewer panel
 */
export interface ViewerPanelConfig {
    /** Panel identifier */
    viewType: 'speckit.specViewer';

    /** Panel title (dynamic: "Spec: {specName}") */
    title: string;

    /** Column to open in */
    viewColumn: vscode.ViewColumn;

    /** Webview options */
    options: {
        enableScripts: true;
        retainContextWhenHidden: false;
        localResourceRoots: vscode.Uri[];
    };
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
 * Footer button state for message-based updates
 */
export interface FooterState {
    /** Whether to show the approve/next-step button */
    showApproveButton: boolean;
    /** Text for the approve button */
    approveText: string;
    /** Enhancement buttons config */
    enhancementButtons?: EnhancementButton[];
    /** Spec status for lifecycle button visibility */
    specStatus?: string;
}

/**
 * Navigation state for message-based updates
 */
export interface NavState {
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
    /** Footer button state for dynamic updates */
    footerState?: FooterState;
    /** Enhancement buttons config */
    enhancementButtons?: EnhancementButton[];
    /** Staleness state for each core document */
    stalenessMap?: StalenessMap;
    /** Spec status for lifecycle button visibility */
    specStatus?: string;
    /** Current task ID from spec-context (for in-progress badge) */
    currentTask?: string | null;
    /** Active SDD step being worked on (mapped to tab name: spec/plan/tasks) */
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
    /** Git branch name from spec-context.json */
    branch?: string | null;
    /** Current document file path */
    filePath?: string | null;
    /** Display label for the current doc type (e.g., "Spec", "Plan") */
    docTypeLabel?: string | null;
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
          viewerState?: import('../../core/types/specContext').ViewerState;
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
    | {
          type: 'submitRefinements';
          refinements: Array<{ lineNum: number; lineContent: string; comment: string }>;
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
    // File reference click
    | {
          type: 'openFile';
          filename: string;
      };

// ============================================
// Empty State Messages
// ============================================

/**
 * Empty state messages for missing documents
 */
export const EMPTY_STATE_MESSAGES: Record<CoreDocumentType, string> = {
    spec: 'No specification file found. Create one to define requirements.',
    plan: 'No implementation plan found. Run /speckit.plan to generate.',
    tasks: 'No tasks file found. Run /speckit.tasks to generate.'
};

/**
 * Default empty state message for related documents
 */
export const DEFAULT_EMPTY_MESSAGE = 'Document not found.';

// ============================================
// Spec Status Types
// ============================================

/**
 * Spec document status values
 * Used to control UI element visibility
 */
export type SpecStatus =
    | typeof SpecStatuses.ACTIVE          // Default - shows all editing controls
    | typeof SpecStatuses.TASKS_DONE      // All tasks 100% - shows Complete as primary CTA
    | typeof SpecStatuses.COMPLETED       // User marked complete - shows Archive + Reactivate
    | typeof SpecStatuses.ARCHIVED;       // Read-only - shows Reactivate only

/**
 * Check if a status allows editing/refinement
 */
export function isEditableStatus(status: SpecStatus): boolean {
    return status === SpecStatuses.ACTIVE || status === SpecStatuses.TASKS_DONE;
}
