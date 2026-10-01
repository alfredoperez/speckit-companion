import * as vscode from 'vscode';
import { Timing } from '../../core/constants';
import { completedStatusForStep, STEP_NAMES, StepName } from '../../core/types/specContext';
import { shellRunIn } from '../../core/utils/terminalUtils';
import { labelFor } from '../spec-viewer/stepCompletionNotifier';
import { readSpecContextSyncSafe } from './specContextReader';
import { retractStepStart, RunPosition, runPositionOf, runUntouchedSince } from './stepLifecycle';
import { untrack } from './terminalStepTracker';

type DispatchResult = vscode.Terminal | null | undefined | void;

export interface StepDispatchWatch {
    /** Call once the dispatch's own start has been written. */
    started(): void;
    /** Run the dispatch: a throw puts the run back and rethrows; otherwise the command's exit is watched in the background. */
    run<T extends DispatchResult>(dispatch: () => Promise<T>): Promise<T>;
    /** Settles once the command's exit has been judged; a non-zero exit soon after it started, before anything was recorded, is reported. */
    attach(terminal: DispatchResult): Promise<void>;
}

export interface StepDispatchWatchOptions {
    specDir: string;
    step: string;
    /** The workflow's label for the step, when it has one. */
    label?: string;
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

/** Begin watching one step dispatch; call before the step's start is written. */
export function watchStepDispatch(options: StepDispatchWatchOptions): StepDispatchWatch {
    const { specDir, step, fromStep, completesFromStep, outputChannel } = options;
    const label = options.label ?? labelFor(step);
    const since = Date.now();
    const recorded = readPosition(specDir);
    const from = recorded && completesFromStep ? settledLeaving(recorded, step) : recorded ?? positionWithoutRecord(fromStep);
    let started: RunPosition | undefined;

    const watch: StepDispatchWatch = {
        started() {
            started = readPosition(specDir);
        },
        async run(dispatch) {
            let result;
            try {
                result = await dispatch();
            } catch (err) {
                if (started && from && runUntouchedSince(readSpecContextSafely(specDir), started)) {
                    await retractStepStart(specDir, step, from, started);
                }
                throw err;
            }
            void watch.attach(result);
            return result;
        },
        async attach(terminal) {
            const at = started;
            if (!terminal || !at) return;
            const run = shellRunIn(terminal, since);
            if (!run?.ended) return;
            const exitCode = await run.ended;
            if (!exitCode) return;
            // An interactive assistant that exits with an error long after it started has run; only a quick failure means it never did.
            if (Date.now() - run.startedAt > Timing.dispatchFailureWindowMs) return;
            await reportFailedDispatch({ terminal, specDir, step, label, from, started: at, exitCode, outputChannel });
        },
    };
    return watch;
}

function readSpecContextSafely(specDir: string) {
    try {
        return readSpecContextSyncSafe(specDir);
    } catch {
        return null;
    }
}

async function reportFailedDispatch(args: {
    terminal: vscode.Terminal;
    specDir: string;
    step: string;
    label: string;
    from: RunPosition | undefined;
    started: RunPosition;
    exitCode: number;
    outputChannel?: vscode.OutputChannel;
}): Promise<void> {
    const { terminal, specDir, step, label, from, started, exitCode, outputChannel } = args;
    if (!runUntouchedSince(readSpecContextSafely(specDir), started)) return;

    untrack(terminal);
    const retracted = from ? await retractStepStart(specDir, step, from, started) : false;
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
