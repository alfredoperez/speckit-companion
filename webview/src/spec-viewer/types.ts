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
// The wire contract
// ============================================

// The document vocabulary, payload shapes and message unions are declared
// once, in `src/protocol/viewer.ts`, and compiled by both sides. This file
// used to re-declare all of it, which is how the extension came to have
// three message variants the webview had never heard of.
export * from '../../../src/protocol/viewer';

// The `.spec-context.json` shapes the viewer renders are declared once, in the
// contract module, and re-exported here. Only the two types below stay local:
// they are the *serialized* wire form of the footer, which drops the
// `visibleWhen` predicate the extension-side `FooterAction` carries.
export type {
    CapabilityContentView,
    CheckpointStatus,
    ClassificationEntry,
    ConcernEntry,
    FooterScope,
    HistoryEntry,
    HistoryEntryFrom,
    LivingSpecsView,
    ReviewComment,
    ReviewCommentAnchor,
    ReviewCommentStatus,
    StepBadgeState,
    StepHistoryEntry,
    SubstepEntry,
    TaskSummary,
    TimingSummary,
    ViewerCoverageRow,
    ViewerDecision,
    ViewerVerification,
} from '../../../src/core/types/specContext';

import type {
    CheckpointStatus,
    FooterScope,
    ReviewCommentStatus,
    ClassificationEntry,
    ConcernEntry,
    HistoryEntry,
    LivingSpecsView,
    ReviewComment,
    StepBadgeState,
    StepHistoryEntry,
    TaskSummary,
    TimingSummary,
    ViewerCoverageRow,
    ViewerDecision,
    ViewerVerification,
} from '../../../src/core/types/specContext';


import type { ViewerToExtensionMessage } from '../../../src/protocol/viewer';

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


/** Serializable footer action — visibleWhen function is stripped before send. */
export interface SerializedFooterAction {
    id: string;
    label: string;
    scope: FooterScope;
    tooltip: string;
}


// ============================================
// Persisted review comments
// ============================================


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
    timing?: TimingSummary;
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
