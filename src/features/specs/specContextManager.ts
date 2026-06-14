/**
 * Compatibility shim around the canonical `specContextWriter` for callers
 * that still use the legacy `FeatureWorkflowContext` shape. All writes go
 * through `writeSpecContext` so the canonical `history[]` field stays the
 * single source of truth — never re-emit the deprecated `transitions[]` or
 * persisted `stepHistory{}`.
 *
 * Reads return raw on-disk data (so callers that depend on legacy fields —
 * e.g., the sidebar's quick stepHistory lookup — keep working until they're
 * migrated to derive timing from `history[]` themselves).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    FeatureWorkflowContext,
    SpecStatus,
    FEATURE_CONTEXT_FILE,
    TransitionEntry,
} from '../workflows/types';
import { SpecStatuses } from '../../core/constants';
import { formatDocName } from '../workflow-editor/workflow/specInfoParser';
import {
    HistoryEntry,
    HistoryEntryFrom,
    StepName,
    STEP_NAMES,
} from '../../core/types/specContext';
import {
    setStepStarted as canonicalSetStepStarted,
    setStepCompleted as canonicalSetStepCompleted,
    updateSpecContext as canonicalUpdateSpecContext,
} from './specContextWriter';
import { normalizeSpecContext } from './specContextReader';
import { isStepLevelEntry, lastEntryIsCompletionFor } from './historyHelpers';

/**
 * Try reading a JSON file, return parsed content or undefined.
 */
function tryReadJsonSync(filePath: string): Record<string, unknown> | undefined {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return undefined;
    }
}

/**
 * Try reading a JSON file async, return parsed content or undefined.
 */
async function tryReadJson(filePath: string): Promise<Record<string, unknown> | undefined> {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return undefined;
    }
}

/**
 * Read .spec-context.json from a spec directory. Returns the raw on-disk
 * shape (for legacy callers); fields like `transitions` may be absent for
 * files written by the canonical writer — use `history` instead when
 * available.
 */
export async function readSpecContext(specDir: string): Promise<FeatureWorkflowContext | undefined> {
    const data = await tryReadJson(path.join(specDir, FEATURE_CONTEXT_FILE));
    if (data) {
        return data as unknown as FeatureWorkflowContext;
    }
    return undefined;
}

/**
 * Synchronous version of readSpecContext for use in tree providers.
 */
export function readSpecContextSync(specDir: string): FeatureWorkflowContext | undefined {
    const data = tryReadJsonSync(path.join(specDir, FEATURE_CONTEXT_FILE));
    if (data) {
        return data as unknown as FeatureWorkflowContext;
    }
    return undefined;
}

function isStepName(value: string | undefined): value is StepName {
    return !!value && (STEP_NAMES as readonly string[]).includes(value);
}

/**
 * Update .spec-context.json with a partial update (read-then-merge).
 *
 * Routes through the canonical writer so `history[]` is the only persisted
 * lifecycle log. Step/substep changes are translated into a canonical
 * history entry; other partial fields are applied verbatim.
 */
export async function updateSpecContext(
    specDir: string,
    partial: Partial<FeatureWorkflowContext>
): Promise<void> {
    const newStep = partial.currentStep;
    const newSubstep = (partial as Record<string, unknown>).substep as
        | string
        | null
        | undefined;
    const hasStepChange = newStep !== undefined || newSubstep !== undefined;

    await canonicalUpdateSpecContext(
        specDir,
        (ctx) => {
            // Apply all non-history fields straight from the partial.
            const next = { ...ctx } as Record<string, unknown>;
            for (const [k, v] of Object.entries(partial)) {
                if (k === 'transitions' || k === 'stepHistory') continue; // legacy fields, never write
                next[k] = v;
            }

            // If the caller is signalling a step/substep change, append the
            // matching canonical history entry. The canonical writer
            // enforces append-only on `history`.
            if (hasStepChange) {
                const oldStep = (ctx as Record<string, unknown>).currentStep as
                    | string
                    | undefined;
                const oldSubstep = (ctx as Record<string, unknown>).substep as
                    | string
                    | null
                    | undefined;
                const stepChanged = newStep !== undefined && newStep !== oldStep;
                const substepChanged =
                    newSubstep !== undefined && newSubstep !== oldSubstep;
                if (stepChanged || substepChanged) {
                    const from: HistoryEntryFrom = {
                        step: (oldStep ?? null) as StepName | null,
                        substep: oldSubstep ?? null,
                    };
                    const resolvedStep = (newStep ?? oldStep ?? '') as string;
                    const resolvedSubstep =
                        newSubstep !== undefined ? newSubstep : (oldSubstep ?? null);
                    if (isStepName(resolvedStep)) {
                        const entry: HistoryEntry = {
                            step: resolvedStep,
                            substep: resolvedSubstep,
                            kind: 'start',
                            from,
                            by: 'extension',
                            at: new Date().toISOString(),
                        };
                        next.history = [...(ctx.history ?? []), entry];
                    }
                }
            }

            return next as typeof ctx;
        },
        // Fallback: brand-new spec context. The canonical writer reads
        // FILE then merges; if file is absent it uses this.
        normalizeSpecContext({
            specName: '',
            branch: '',
            currentStep: 'specify',
            status: 'draft',
            history: [],
        }),
    );
}

/**
 * Derive a human-readable spec name from a directory slug.
 * E.g., "046-spec-viewer-header-redesign" → "Spec Viewer Header Redesign"
 */
export function deriveSpecName(specDir: string): string {
    const slug = path.basename(specDir);
    const withoutPrefix = slug.replace(/^\d+-/, '');
    return formatDocName(withoutPrefix);
}

/**
 * Update step progress when user clicks a step command.
 *
 * For lifecycle steps (specify / plan / tasks / implement), the canonical
 * `setStepStarted` in `specContextWriter` already handles the
 * complete-on-advance + start atomically — this function is now a thin
 * wrapper that also fills `specName` when missing. For non-lifecycle
 * (custom workflow) steps, falls back to `updateSpecContext` so callers
 * can still record arbitrary step names without breaking the canonical
 * history shape.
 */
export async function updateStepProgress(
    specDir: string,
    stepName: string,
    _workflowStepNames: string[]
): Promise<void> {
    const isLifecycle = isStepName(stepName);
    const ctx = await readSpecContext(specDir);
    const specName = ctx?.specName || deriveSpecName(specDir);

    if (isLifecycle) {
        // Complete any in-flight prior lifecycle step + start the new one,
        // atomically, via the canonical writer. Idempotent: re-advancing
        // to the step that's already current is a no-op (matches the
        // legacy `if (!stepHistory[stepName])` behavior).
        await canonicalUpdateSpecContext(
            specDir,
            (c) => {
                let next = { ...c, specName };
                const prevStep = c.currentStep;
                if (prevStep === stepName && stepHasBeenStarted(c.history ?? [], stepName as StepName)) {
                    // Already on this step AND it has at least one start-entry —
                    // re-advance is a no-op (matches the legacy idempotent
                    // `if (!stepHistory[stepName])` behavior).
                    return next;
                }
                if (
                    isStepName(prevStep) &&
                    prevStep !== stepName &&
                    !lastEntryIsCompletionFor(c.history ?? [], prevStep)
                ) {
                    next = canonicalSetStepCompleted(next, prevStep, 'extension');
                }
                next = canonicalSetStepStarted(next, stepName as StepName, 'extension');
                return next;
            },
            normalizeSpecContext({
                specName,
                branch: '',
                currentStep: 'specify',
                status: 'draft',
                history: [],
            }),
        );
        return;
    }

    // Non-lifecycle (custom) step — record via the generic partial path.
    await updateSpecContext(specDir, {
        currentStep: stepName,
        status: ctx?.status || SpecStatuses.ACTIVE,
        specName,
    });
}

/** True iff `history` contains any *start* entry for `step` (not a completion). */
function stepHasBeenStarted(history: HistoryEntry[], step: StepName): boolean {
    for (const e of history) {
        if (e.step !== step) continue;
        if (!isStepLevelEntry(e)) continue;
        if (e.kind === 'start') return true;
    }
    return false;
}

/**
 * Set the spec status (active, completed, archived).
 */
export async function setSpecStatus(
    specDir: string,
    status: SpecStatus
): Promise<void> {
    await updateSpecContext(specDir, { status });
}

// Re-export so callers can still import the legacy type if they need it.
export type { TransitionEntry };
