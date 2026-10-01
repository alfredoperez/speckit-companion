/**
 * Thin wrapper around `specContextWriter` that the extension uses to record
 * step/substep lifecycle transitions in `.spec-context.json` independently of
 * AI cooperation. All errors are logged-and-swallowed (R002) so dispatch is
 * never blocked by a write failure.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import {
    completedStatusForStep,
    HistoryEntryBy,
    inFlightStatusForStep,
    SpecContext,
    STATUS_OWNING_STEP,
    STEP_NAMES,
    StepName,
} from '../../core/types/specContext';
import {
    appendTransition,
    setStepStarted,
    setStepCompleted,
    setSubstepStarted,
    setSubstepCompleted,
    updateSpecContext,
} from './specContextWriter';
import { Status } from '../../core/types/specContext';
import { deriveSpecName } from '../../core/utils/specDisplayName';

let outputChannel: vscode.OutputChannel | undefined;

/** Optional: register an output channel for lifecycle log messages. */
export function setLifecycleOutputChannel(channel: vscode.OutputChannel): void {
    outputChannel = channel;
}

function logError(action: string, err: unknown): void {
    const msg = `[stepLifecycle] ${action} failed: ${err instanceof Error ? err.message : String(err)}`;
    // eslint-disable-next-line no-console
    console.error(msg);
    outputChannel?.appendLine(msg);
}

function buildFallback(specDir: string, step: StepName): SpecContext {
    return {
        workflow: 'speckit',
        specName: deriveSpecName(specDir),
        branch: '',
        currentStep: step,
        status: 'draft',
        history: [],
    };
}

export async function startStep(
    specDir: string,
    step: StepName,
    by: HistoryEntryBy
): Promise<void> {
    try {
        await updateSpecContext(
            specDir,
            ctx => setStepStarted(ctx, step, by),
            buildFallback(specDir, step)
        );
    } catch (err) {
        logError(`startStep(${path.basename(specDir)}, ${step})`, err);
    }
}

export async function completeStep(
    specDir: string,
    step: StepName,
    by: HistoryEntryBy
): Promise<void> {
    try {
        await updateSpecContext(
            specDir,
            ctx => setStepCompleted(ctx, step, by),
            buildFallback(specDir, step)
        );
    } catch (err) {
        logError(`completeStep(${path.basename(specDir)}, ${step})`, err);
    }
}

export async function startSubstep(
    specDir: string,
    step: StepName,
    substep: string,
    by: HistoryEntryBy
): Promise<void> {
    try {
        await updateSpecContext(
            specDir,
            ctx => setSubstepStarted(ctx, step, substep, by),
            buildFallback(specDir, step)
        );
    } catch (err) {
        logError(`startSubstep(${path.basename(specDir)}, ${step}/${substep})`, err);
    }
}

/** Set canonical status (e.g., 'completed' | 'archived'). Logs a transition. */
export async function setStatus(
    specDir: string,
    status: Status,
    by: HistoryEntryBy = 'extension'
): Promise<boolean> {
    try {
        await updateSpecContext(
            specDir,
            ctx => {
                const at = new Date().toISOString();
                const next = appendTransition(
                    { ...ctx, status },
                    {
                        step: ctx.currentStep,
                        substep: null,
                        kind: 'complete',
                        by,
                        at,
                    }
                );
                return next;
            },
            buildFallback(specDir, 'specify')
        );
        return true;
    } catch (err) {
        logError(`setStatus(${path.basename(specDir)}, ${status})`, err);
        return false;
    }
}


/**
 * Force-override a spec's status as a manual recovery escape hatch.
 *
 * Unlike `setStatus` (which only writes a terminal status and a `complete`
 * boundary for the spec's *existing* `currentStep`), this realigns
 * `currentStep` to the forced status's owning step and records an honest
 * override: `start` for an in-flight status, `complete` for a settled one. That
 * keeps `currentStep`/`status`/`history[]` coherent so the viewer recovers from
 * the forced status instead of staying stranded on the prior step.
 *
 * Terminal statuses (`completed`/`archived`) route through the unchanged
 * `setStatus`, so the mark-complete/archive/bulk callers are untouched.
 */
export async function forceStatus(
    specDir: string,
    status: Status,
    by: HistoryEntryBy = 'user'
): Promise<boolean> {
    if (status === 'completed' || status === 'archived') {
        return setStatus(specDir, status, by);
    }
    const owning = STATUS_OWNING_STEP.get(status);
    if (!owning) {
        // `draft` and any unmapped value: fall back to the plain status write.
        return setStatus(specDir, status, by);
    }
    try {
        await updateSpecContext(
            specDir,
            ctx => {
                const aligned: SpecContext = { ...ctx, currentStep: owning.step };
                return owning.settled
                    ? setStepCompleted(aligned, owning.step, by)
                    // Recovery re-stamps a boundary even on an already-started step — opt out of the start-dedup the automatic path uses.
                    : setStepStarted(aligned, owning.step, by, undefined, false);
            },
            buildFallback(specDir, owning.step)
        );
        return true;
    } catch (err) {
        logError(`forceStatus(${path.basename(specDir)}, ${status})`, err);
        return false;
    }
}

/** Reactivate: derive in-progress status from `currentStep`. */
export async function reactivate(
    specDir: string,
    by: HistoryEntryBy = 'extension'
): Promise<void> {
    try {
        await updateSpecContext(
            specDir,
            ctx => {
                const status = inFlightStatusForStep(ctx.currentStep) ?? ctx.status;
                const at = new Date().toISOString();
                return appendTransition(
                    { ...ctx, status },
                    {
                        step: ctx.currentStep,
                        substep: null,
                        kind: 'complete',
                        by,
                        at,
                    }
                );
            },
            buildFallback(specDir, 'specify')
        );
    } catch (err) {
        logError(`reactivate(${path.basename(specDir)})`, err);
    }
}


/** Where a run stands: enough to tell whether anything was written since. */
export interface RunPosition {
    status: Status;
    currentStep: StepName;
    historyLength: number;
}

export function runPositionOf(ctx: SpecContext | null | undefined): RunPosition | undefined {
    if (!ctx) return undefined;
    return { status: ctx.status, currentStep: ctx.currentStep, historyLength: ctx.history?.length ?? 0 };
}

/** True when the record still stands exactly where `position` saw it. */
export function runUntouchedSince(ctx: SpecContext | null | undefined, position: RunPosition): boolean {
    return !!ctx
        && ctx.status === position.status
        && ctx.currentStep === position.currentStep
        && (ctx.history?.length ?? 0) === position.historyLength;
}

/** Back to `from`, keeping the stray start; a settled step it left is re-stamped complete so its forward button returns. */
export function restoreRunPosition(ctx: SpecContext, step: string, from: RunPosition): SpecContext {
    const back: SpecContext = { ...ctx, status: from.status, currentStep: from.currentStep };
    const settledElsewhere = from.currentStep !== step
        && STEP_NAMES.includes(from.currentStep)
        && from.status === completedStatusForStep(from.currentStep);
    return settledElsewhere ? setStepCompleted(back, from.currentStep, 'extension') : back;
}

/** Undo the running state a failed dispatch wrote, only while nothing has been recorded since; returns whether it did. */
export async function retractStepStart(
    specDir: string,
    step: string,
    from: RunPosition,
    started: RunPosition,
): Promise<boolean> {
    const unchangedByStart = from.status === started.status
        && from.currentStep === started.currentStep
        && from.historyLength === started.historyLength;
    if (unchangedByStart) return false;
    let retracted = false;
    try {
        await updateSpecContext(
            specDir,
            ctx => {
                if (!runUntouchedSince(ctx, started)) return ctx;
                retracted = true;
                return restoreRunPosition(ctx, step, from);
            },
            buildFallback(specDir, from.currentStep),
        );
    } catch (err) {
        logError(`retractStepStart(${path.basename(specDir)}, ${step})`, err);
        return false;
    }
    return retracted;
}

export async function completeSubstep(
    specDir: string,
    step: StepName,
    substep: string,
    by: HistoryEntryBy
): Promise<void> {
    try {
        await updateSpecContext(
            specDir,
            ctx => setSubstepCompleted(ctx, step, substep, by),
            buildFallback(specDir, step)
        );
    } catch (err) {
        logError(`completeSubstep(${path.basename(specDir)}, ${step}/${substep})`, err);
    }
}
