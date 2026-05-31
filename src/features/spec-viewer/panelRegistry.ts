/**
 * Panel registry — owns the per-spec-directory `PanelInstance` lifecycle.
 *
 * Lifted out of `specViewerProvider.ts` in Phase 12 so the provider stays
 * focused on orchestration (read documents, compute derived state, render
 * HTML, route messages) and the lifecycle plumbing (Map ownership, debounce
 * timers, first-open gating) lives in one place.
 *
 * The provider holds one `PanelRegistry` per session; everything that used
 * to touch `this.panels.*` now goes through the registry methods, which
 * makes the lifecycle behaviour individually unit-testable without spinning
 * up a real `vscode.WebviewPanel`.
 */

import * as vscode from "vscode";
import { SpecViewerState } from "./types";
import type { FeatureWorkflowContext } from "../workflows/types";

/**
 * Per-spec-directory panel state. One instance per open spec viewer.
 */
export interface PanelInstance {
    panel: vscode.WebviewPanel;
    state: SpecViewerState;
    debounceTimer: NodeJS.Timeout | undefined;
    lastFeatureCtx?: FeatureWorkflowContext | null;
    /**
     * True after the first `updateContent` run for this panel. Gates the
     * `ensureSpecContext` write so tab clicks never (re)create the file —
     * first-open may write a backfill if the file is missing; every
     * subsequent navigation is strictly read-only.
     */
    firstOpenComplete: boolean;
}

export class PanelRegistry {
    private readonly panels = new Map<string, PanelInstance>();

    get(specDirectory: string): PanelInstance | undefined {
        return this.panels.get(specDirectory);
    }

    set(specDirectory: string, instance: PanelInstance): void {
        this.panels.set(specDirectory, instance);
    }

    has(specDirectory: string): boolean {
        return this.panels.has(specDirectory);
    }

    /**
     * Remove an instance and clear its pending debounce, if any. Used in
     * the panel's `onDidDispose` callback so the lifecycle hooks stay
     * symmetric.
     */
    delete(specDirectory: string): void {
        const instance = this.panels.get(specDirectory);
        if (instance?.debounceTimer) {
            clearTimeout(instance.debounceTimer);
        }
        this.panels.delete(specDirectory);
    }

    /**
     * Iterate every live panel. Used for broadcast operations such as
     * `handleFileDeleted` where every viewer needs to react to a workspace
     * event.
     */
    forEach(fn: (instance: PanelInstance, specDirectory: string) => void): void {
        this.panels.forEach((instance, specDirectory) => fn(instance, specDirectory));
    }

    /**
     * Iteration support for `for ... of` loops. Yields `[specDirectory, instance]`
     * pairs in insertion order, matching the underlying Map's contract.
     */
    [Symbol.iterator](): IterableIterator<[string, PanelInstance]> {
        return this.panels.entries();
    }
}
