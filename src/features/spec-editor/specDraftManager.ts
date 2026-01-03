import * as vscode from 'vscode';
import type { SpecDraft } from './types';

/**
 * Manages draft persistence for spec editor using workspaceState.
 * Provides backup persistence for drafts (in addition to webview state).
 */
export class SpecDraftManager {
    private static readonly DRAFT_KEY_PREFIX = 'specEditor.draft.';

    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Save a draft to workspace state
     */
    async saveDraft(draft: SpecDraft): Promise<void> {
        const key = this.getDraftKey(draft.sessionId);
        await this.context.workspaceState.update(key, draft);
    }

    /**
     * Load a draft from workspace state
     */
    async loadDraft(sessionId: string): Promise<SpecDraft | undefined> {
        const key = this.getDraftKey(sessionId);
        return this.context.workspaceState.get<SpecDraft>(key);
    }

    /**
     * Delete a draft from workspace state
     */
    async deleteDraft(sessionId: string): Promise<void> {
        const key = this.getDraftKey(sessionId);
        await this.context.workspaceState.update(key, undefined);
    }

    /**
     * Get all stored draft session IDs
     */
    getAllDraftSessionIds(): string[] {
        const keys = this.context.workspaceState.keys();
        return keys
            .filter(key => key.startsWith(SpecDraftManager.DRAFT_KEY_PREFIX))
            .map(key => key.substring(SpecDraftManager.DRAFT_KEY_PREFIX.length));
    }

    /**
     * Clean up old drafts (older than 24 hours)
     */
    async cleanupOldDrafts(): Promise<string[]> {
        const sessionIds = this.getAllDraftSessionIds();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const cleanedIds: string[] = [];

        for (const sessionId of sessionIds) {
            const draft = await this.loadDraft(sessionId);
            if (draft && (now - draft.lastSaved) > maxAge) {
                await this.deleteDraft(sessionId);
                cleanedIds.push(sessionId);
            }
        }

        return cleanedIds;
    }

    /**
     * Get the storage key for a session's draft
     */
    private getDraftKey(sessionId: string): string {
        return `${SpecDraftManager.DRAFT_KEY_PREFIX}${sessionId}`;
    }
}
