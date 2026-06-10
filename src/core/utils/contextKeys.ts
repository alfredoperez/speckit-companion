/**
 * Centralised VS Code context-key writer.
 *
 * Round-3 audit finding: 10+ scattered `vscode.commands.executeCommand('setContext', ...)`
 * call sites with no error handling, no catalogue, no reset hook. Some keys
 * (`speckit.specs.allCollapsed`) get stuck because they're set once at
 * activation and never updated. Others (`speckit.specs.filterActive` vs.
 * `speckit.specs.noFilterMatch`) can race when two writers fire concurrently.
 *
 * This module is the only sanctioned writer. Every key the extension uses is
 * named in `CONTEXT_KEYS` below — adding a key without listing it here means
 * it's invisible to the catalogue and won't be returned by `resetAll()`.
 *
 * The wrapper logs setContext failures (previously silent) and exposes a
 * single `set(key, value)` plus convenience setters per logical category.
 */

import * as vscode from 'vscode';

/**
 * The full catalogue of VS Code context keys this extension writes.
 * Adding a new key requires updating this constant; `setContextKey` only
 * accepts members of this set. That keeps key naming consistent and gives
 * one place to audit "what context keys exist?"
 */
export const CONTEXT_KEYS = {
    cliInstalled: 'speckit.cliInstalled',
    detected: 'speckit.detected',
    constitutionNeedsSetup: 'speckit.constitutionNeedsSetup',
    specsAllCollapsed: 'speckit.specs.allCollapsed',
    specsFilterActive: 'speckit.specs.filterActive',
    specsNoFilterMatch: 'speckit.specs.noFilterMatch',
    specsSortActive: 'speckit.specs.sortActive',
    specsSelectionCount: 'speckit.specs.selection.count',
    specsSelectionMixed: 'speckit.specs.selection.mixed',
    resumeBeta: 'speckit.resumeBeta',
} as const;

export type ContextKeyName = (typeof CONTEXT_KEYS)[keyof typeof CONTEXT_KEYS];

/**
 * Logger surface — pass an OutputChannel (or any sink with `.appendLine`)
 * so the centralised writer can report setContext failures. Optional: when
 * omitted, failures are silently swallowed (matches pre-Phase-14 behaviour).
 */
export interface ContextKeyLogger {
    appendLine(message: string): void;
}

/**
 * Write a context key.
 *
 * The historical pattern `vscode.commands.executeCommand('setContext', key, value)`
 * is exactly equivalent at runtime, but:
 *   - it doesn't await failures,
 *   - it doesn't enforce that `key` is a known catalogued name,
 *   - it doesn't log when the underlying executeCommand rejects (rare but
 *     possible on host extensions that intercept setContext).
 *
 * Going through `setContextKey` gives all three.
 */
export async function setContextKey(
    key: ContextKeyName,
    value: boolean | number | string | null,
    logger?: ContextKeyLogger,
): Promise<void> {
    try {
        await vscode.commands.executeCommand('setContext', key, value);
    } catch (err) {
        logger?.appendLine(
            `[ContextKey] setContext(${key}, ${JSON.stringify(value)}) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

/**
 * Reset every context key to a sensible default. Used by the activation
 * path so stale values from a previous session don't leak into the new
 * one (the prior failure mode for `speckit.specs.allCollapsed`).
 */
export async function resetAllContextKeys(logger?: ContextKeyLogger): Promise<void> {
    await Promise.all([
        setContextKey(CONTEXT_KEYS.cliInstalled, false, logger),
        setContextKey(CONTEXT_KEYS.detected, false, logger),
        setContextKey(CONTEXT_KEYS.constitutionNeedsSetup, false, logger),
        setContextKey(CONTEXT_KEYS.specsAllCollapsed, false, logger),
        setContextKey(CONTEXT_KEYS.specsFilterActive, false, logger),
        setContextKey(CONTEXT_KEYS.specsNoFilterMatch, false, logger),
        setContextKey(CONTEXT_KEYS.specsSortActive, false, logger),
        setContextKey(CONTEXT_KEYS.specsSelectionCount, 0, logger),
        setContextKey(CONTEXT_KEYS.specsSelectionMixed, false, logger),
        setContextKey(CONTEXT_KEYS.resumeBeta, false, logger),
    ]);
}
