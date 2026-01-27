/**
 * Type definitions for the Spec Viewer feature
 */

import * as vscode from 'vscode';

// ============================================
// Document Types
// ============================================

/**
 * Core document types in the spec workflow
 */
export type CoreDocumentType = 'spec' | 'plan' | 'tasks';

/**
 * Extended to include related documents
 * Related docs are identified by their filename
 */
export type DocumentType = CoreDocumentType | string;

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
export const CORE_DOCUMENT_DISPLAY_NAMES: Record<CoreDocumentType, string> = {
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

    /** Display name shown in tab (e.g., "Spec", "Plan", "Research") */
    displayName: string;

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
 * Phase-specific enhancement buttons
 */
export const PHASE_ENHANCEMENT_BUTTONS: Record<CoreDocumentType, EnhancementButton> = {
    spec: {
        label: 'Clarify',
        command: 'speckit.clarify',
        icon: '❓',
        tooltip: 'Refine any requirements further'
    },
    plan: {
        label: 'Checklist',
        command: 'speckit.checklist',
        icon: '✅',
        tooltip: 'Generate a checklist for the plan'
    },
    tasks: {
        label: 'Analyze',
        command: 'speckit.analyze',
        icon: '🔍',
        tooltip: 'Analyze task consistency'
    }
};

/**
 * State for the spec viewer panel
 * Tracks which spec and document is currently displayed
 */
export interface SpecViewerState {
    /** Display name of the spec (derived from folder name) */
    specName: string;

    /** Absolute path to the spec directory */
    specDirectory: string;

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
    /** Current workflow phase */
    workflowPhase: 'spec' | 'plan' | 'tasks' | 'done';
    /** Task completion percentage */
    taskCompletionPercent: number;
    /** Whether viewing a related doc */
    isViewingRelatedDoc: boolean;
    /** Footer button state for dynamic updates */
    footerState?: FooterState;
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
      }
    | {
          type: 'stepperClick';
          phase: 'spec' | 'plan' | 'tasks' | 'done';
      }
    | {
          type: 'submitRefinements';
          refinements: Array<{ lineNum: number; lineContent: string; comment: string }>;
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
    | 'draft'           // Default - shows all editing controls
    | 'in-progress'     // Shows all editing controls
    | 'spec-completed'  // Hides add-comment buttons, DRAFT badge, refinement CTAs
    | 'plan-completed'  // Future use
    | 'done';           // Future use

/**
 * Check if a status allows editing/refinement
 */
export function isEditableStatus(status: SpecStatus): boolean {
    return status === 'draft' || status === 'in-progress';
}
