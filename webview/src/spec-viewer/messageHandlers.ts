/**
 * Routing for messages the extension sends this webview.
 *
 * One handler per variant, in a map the compiler checks for completeness: a
 * variant added to the protocol fails this build until it is handled. The
 * hand-written switch this replaces would have ignored it instead, which is how
 * three of its cases came to be empty stubs.
 *
 * The dispatcher itself is the same module the extension side routes with
 * (`src/core/utils/dispatcher.ts`), so both ends of the protocol behave alike.
 */

import { createDispatcher, type DispatcherMap } from '../../../src/core/utils/dispatcher';
import { showToast } from '../shared/components/Toast';
import { navState, viewerState, historyEntries } from './signals';
import { setCurrentTask, setHasSpecContext, setLivingMode, setTaskSummaries } from './markdown';
import type { ExtensionToViewerMessage, NavState, ViewerState } from './types';

/**
 * Push a navState onto the signals and the renderer's flags together.
 *
 * Three message variants carried their own copy of this block, each with a
 * comment explaining why the repetition was necessary; a renderer flag left
 * behind by one of them paints the next render in a stale mode.
 */
export function applyNavState(next: NavState): void {
    navState.value = next;
    if (next.currentTask !== undefined) setCurrentTask(next.currentTask);
    setHasSpecContext(!!(next.specContextName || next.badgeText));
    setLivingMode(!!next.livingMode);
}

/** Push a viewerState onto the signals it feeds. */
export function applyViewerState(next: ViewerState): void {
    viewerState.value = next;
    historyEntries.value = next.history ?? [];
    setTaskSummaries(next.taskSummaries ?? null);
}

export function buildHandlers(
    updateContent: (content: string) => void,
): DispatcherMap<ExtensionToViewerMessage, []> {
    return {
        contentUpdated: message => {
            if (message.navState) applyNavState(message.navState);
            if (message.viewerState) applyViewerState(message.viewerState);
            updateContent(message.content);
        },

        navStateUpdated: message => {
            if (message.navState) applyNavState(message.navState);
        },

        livingHealthResolved: message => {
            if (navState.value) {
                navState.value = { ...navState.value, livingMeta: message.livingMeta };
            }
        },

        viewerStateUpdated: message => {
            applyViewerState(message.viewerState);
            // Carries a COMPLETE navState (same builder as `contentUpdated`), so
            // it replaces the prior snapshot rather than merging — and can stand
            // alone before the first `contentUpdated` arrives.
            if (message.navState) applyNavState(message.navState);
        },

        documentsUpdated: () => {
            // The document list renders from navState; nothing to do here.
        },

        error: message => {
            console.error('[SpecViewer] Error:', message.message);
        },

        fileDeleted: () => {
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.textContent = '';
                const empty = document.createElement('div');
                empty.className = 'empty-state';
                empty.textContent = 'The file has been deleted.';
                contentArea.appendChild(empty);
            }
        },

        actionToast: message => {
            showToast('action-toast', message.message);
        },
    };
}

export function createMessageRouter(
    updateContent: (content: string) => void,
): (event: MessageEvent) => void {
    const dispatch = createDispatcher(buildHandlers(updateContent));
    return event => {
        void dispatch(event.data as ExtensionToViewerMessage);
    };
}
