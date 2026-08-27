/**
 * Type definitions for the Spec Viewer feature
 */

import * as vscode from 'vscode';
import { SpecStatuses } from '../../core/constants';
import type { CoreDocumentType } from '../../protocol/viewer';

// The wire contract — document vocabulary, payload shapes, message unions —
// lives in one module both this side and the webview compile.
export * from '../../protocol/viewer';

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
    | typeof SpecStatuses.ARCHIVED        // Read-only - shows Reactivate only
    | 'draft';                            // Presentation only - a living spec still carrying
                                          // its `[DRAFT]` banner; renders the muted
                                          // `.spec-badge--draft` pill. Not a lifecycle state,
                                          // so it is deliberately absent from `SpecStatuses`.

/**
 * Check if a status allows editing/refinement
 */
export function isEditableStatus(status: SpecStatus): boolean {
    return status === SpecStatuses.ACTIVE || status === SpecStatuses.TASKS_DONE;
}
