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
// once, in the `speckit-viewer` package contract, bound to the extension's
// report pages in `src/protocol/viewer.ts`, and compiled by both sides. This
// file used to re-declare all of it, which is how the extension came to have
// three message variants the webview had never heard of.
export * from '../../../src/protocol/viewer';

// The `.spec-context.json` shapes and the serialized viewer state (whose footer
// drops the `visibleWhen` predicate the extension-side `FooterAction` carries)
// come from the package contract and are re-exported here.
export type {
    CapabilityContentView,
    CheckpointStatus,
    ClassificationEntry,
    RiskEntry,
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

import type { ReviewCommentStatus } from '../../../src/core/types/specContext';


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


export type {
    ConvergeAddedTask,
    ConvergeOutcome,
    ConvergePassRow,
    ConvergeResult,
} from '../../../src/core/types/specContext';
export type { SerializedFooterAction, ViewerState } from 'speckit-viewer/contract/viewerState';


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
