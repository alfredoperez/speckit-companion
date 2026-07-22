/**
 * Thin wrapper around `specContextWriter` that the extension uses to record
 * step/substep lifecycle transitions in `.spec-context.json` independently of
 * AI cooperation. All errors are logged-and-swallowed (R002) so dispatch is
 * never blocked by a write failure.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import {
    SpecContext,
    STATUS_OWNING_STEP,
    StepName,
    TransitionBy,
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
import { deriveSpecName } from './specContextManager';

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
    by: TransitionBy
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
    by: TransitionBy
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
    by: TransitionBy
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
    by: TransitionBy = 'extension'
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
 * Force-override a spec's status as a manual recovery escape hatch (#347).
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
    by: TransitionBy = 'user'
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
                    // Manual recovery re-stamps an honest boundary even when the
                    // stranded step already has a start (#347) — opt out of the
                    // idempotent start-dedup the automatic advance path uses.
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
    by: TransitionBy = 'extension'
): Promise<void> {
    try {
        await updateSpecContext(
            specDir,
            ctx => {
                const status = deriveInProgressStatus(ctx.currentStep);
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

function deriveInProgressStatus(step: StepName): Status {
    switch (step) {
        case 'specify':
        case 'clarify':
            return 'specifying';
        case 'plan':
            return 'planning';
        case 'tasks':
        case 'analyze':
            return 'tasking';
        case 'implement':
            return 'implementing';
    }
}

export async function completeSubstep(
    specDir: string,
    step: StepName,
    substep: string,
    by: TransitionBy
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
