import * as vscode from 'vscode';
import { completedStatusForStep, STEP_NAMES, StepName } from '../../core/types/specContext';
import { shellRunIn } from '../../core/utils/terminalUtils';
import { readSpecContextSyncSafe } from './specContextReader';
import { retractStepStart, RunPosition, runPositionOf, runUntouchedSince } from './stepLifecycle';
import { untrack } from './terminalStepTracker';

export interface StepDispatchWatch {
    /** Call once the dispatch's own start has been written. */
    started(): void;
    /** Call with what the provider returned; settles once a command that exits non-zero before the step records anything is reported. */
    attach(terminal: vscode.Terminal | null | undefined | void): Promise<void>;
}

export interface StepDispatchWatchOptions {
    specDir: string;
    step: string;
    /** The step the click moved the run off, when the spec has no record yet to say so. */
    fromStep?: string;
    /** The dispatch itself records the step it leaves as complete. */
    completesFromStep?: boolean;
    outputChannel?: vscode.OutputChannel;
}

function readPosition(specDir: string): RunPosition | undefined {
    try {
        return runPositionOf(readSpecContextSyncSafe(specDir));
    } catch {
        return undefined;
    }
}

function positionWithoutRecord(fromStep: string | undefined): RunPosition | undefined {
    if (!fromStep || !STEP_NAMES.includes(fromStep as StepName)) return undefined;
    const step = fromStep as StepName;
    return { status: completedStatusForStep(step) ?? 'draft', currentStep: step, historyLength: 0 };
}

function settledLeaving(position: RunPosition, step: string): RunPosition {
    if (position.currentStep === step) return position;
    return { ...position, status: completedStatusForStep(position.currentStep) ?? position.status };
}

export function stepLabel(step: string): string {
    return step.length === 0 ? step : step.charAt(0).toUpperCase() + step.slice(1);
}

/** Begin watching one step dispatch; call before the step's start is written. */
export function watchStepDispatch(options: StepDispatchWatchOptions): StepDispatchWatch {
    const { specDir, step, fromStep, completesFromStep, outputChannel } = options;
    const since = Date.now();
    const recorded = readPosition(specDir);
    const from = recorded && completesFromStep ? settledLeaving(recorded, step) : recorded ?? positionWithoutRecord(fromStep);
    let started: RunPosition | undefined;

    return {
        started() {
            started = readPosition(specDir);
        },
        async attach(terminal) {
            const at = started;
            if (!terminal || !at || !from) return;
            const run = shellRunIn(terminal, since);
            if (!run?.ended) return;
            const exitCode = await run.ended;
            if (!exitCode) return;
            await reportFailedDispatch({ terminal, specDir, step, from, started: at, exitCode, outputChannel });
        },
    };
}

async function reportFailedDispatch(args: {
    terminal: vscode.Terminal;
    specDir: string;
    step: string;
    from: RunPosition;
    started: RunPosition;
    exitCode: number;
    outputChannel?: vscode.OutputChannel;
}): Promise<void> {
    const { terminal, specDir, step, from, started, exitCode, outputChannel } = args;
    let ctx;
    try {
        ctx = readSpecContextSyncSafe(specDir);
    } catch {
        return;
    }
    if (!runUntouchedSince(ctx, started)) return;

    untrack(terminal);
    const retracted = await retractStepStart(specDir, step, from, started);
    const label = stepLabel(step);
    outputChannel?.appendLine(
        `[dispatch] ${label} did not run: exit code ${exitCode} before anything was recorded${retracted ? ', running state cleared' : ''}`,
    );
    const cleared = retracted ? ` ${label} is no longer shown as running.` : '';
    const choice = await vscode.window.showErrorMessage(
        `${label} did not run: the command in the "${terminal.name}" terminal exited with code ${exitCode} before the step recorded anything.${cleared}`,
        'Show Terminal',
    );
    if (choice === 'Show Terminal') terminal.show();
}
