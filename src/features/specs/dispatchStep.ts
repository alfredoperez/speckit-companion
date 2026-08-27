/**
 * The one path from "run this step" to a command running in the terminal.
 *
 * Sending a pipeline step to the assistant is six things in a fixed order:
 * resolve the command the spec's workflow names, fall back to the stock command
 * (and say so) when it needs the companion extension and that is not installed,
 * record the dispatch, format the command for the provider, wrap it in the
 * lifecycle preamble, and run it. Every surface that dispatched a step carried
 * its own copy of all six — the sidebar and the viewer copies were identical
 * apart from their log prefix — so a fix to any one of them reached one caller.
 *
 * Callers supply `run` rather than reaching for the provider themselves: the
 * viewer already had an injected terminal function for its tests, and the
 * sidebar needs the returned terminal to track it.
 */

import * as vscode from 'vscode';
import { formatCommandForProvider, getConfiguredProviderType } from '../../ai-providers/aiProvider';
import { buildPrompt } from '../../ai-providers/promptBuilder';
import { getSpecTelemetryContext, phaseTelemetryId, sendTelemetryEvent } from '../../core/telemetry';
import { resolveDispatchWithFallback } from './profileDispatch';

export interface StepDispatchRequest {
    /** The command the spec's workflow resolves for this step, before fallback. */
    baseCommand: string;
    /** Canonical step name, for the preamble and telemetry. */
    step: string;
    /** What the command is pointed at — the change root when the spec has one. */
    targetPath: string;
    /** The spec directory, for telemetry and for resolving the fallback. */
    specDirectory: string;
    /** Extra text appended to the command line (the viewer's refinement context). */
    refinementContext?: string;
    /**
     * What the lifecycle preamble is told the spec directory is. The two
     * surfaces genuinely differ here — the sidebar passes a workspace-relative
     * path, the viewer the change root it dispatched against — so it stays the
     * caller's to state rather than being guessed from `targetPath`.
     */
    promptSpecDir: string;
}

export interface StepDispatchDeps<T> {
    outputChannel: vscode.OutputChannel;
    /** Tag on this surface's log lines, e.g. `SpecKit` or `SpecViewer`. */
    logPrefix: string;
    /** Runs the finished prompt. Returns whatever the caller needs back. */
    run: (prompt: string) => Promise<T>;
}

/**
 * Resolve the command to dispatch, warning when the companion command is
 * unavailable. Returns null when there is nothing to run — a companion-only
 * step (mark-complete) with no stock twin and no extension installed.
 */
export function resolveDispatchCommand(
    baseCommand: string,
    specDirectory: string,
    outputChannel: vscode.OutputChannel,
    logPrefix: string,
): string | null {
    const resolution = resolveDispatchWithFallback(baseCommand, specDirectory);
    if (resolution.fellBack) {
        const suffix = resolution.command
            ? `running stock ${resolution.command}`
            : 'no stock equivalent — skipping';
        outputChannel.appendLine(
            `[${logPrefix}] Companion command unavailable — spec-kit extension not installed; ${suffix}.`,
        );
        void vscode.window.showWarningMessage(
            'The SpecKit Companion workflow needs the companion spec-kit extension, which is not installed — running the standard SpecKit flow instead.',
            'Install spec-kit Extension',
        ).then(choice => {
            if (choice === 'Install spec-kit Extension') {
                void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
            }
        });
    }
    return resolution.command;
}

/**
 * Dispatch one pipeline step. Returns what `run` returned, or null when the
 * step was suppressed because there was no command to run.
 */
export async function dispatchStep<T>(
    request: StepDispatchRequest,
    deps: StepDispatchDeps<T>,
): Promise<T | null> {
    const command = resolveDispatchCommand(
        request.baseCommand,
        request.specDirectory,
        deps.outputChannel,
        deps.logPrefix,
    );
    if (!command) {
        return null;
    }

    const specTelemetry = getSpecTelemetryContext(request.specDirectory);
    sendTelemetryEvent('phase.dispatched', {
        providerId: getConfiguredProviderType(),
        phase: phaseTelemetryId(request.step),
        ...(specTelemetry.specInstanceId ? { specInstanceId: specTelemetry.specInstanceId } : {}),
    });

    const formatted = formatCommandForProvider(command);
    const rawPrompt = `/${formatted} ${request.targetPath}`;
    const commandLine = request.refinementContext
        ? `${rawPrompt}${request.refinementContext}`
        : rawPrompt;

    deps.outputChannel.appendLine(`[${deps.logPrefix}] Executing step "${request.step}": ${rawPrompt}`);

    const prompt = buildPrompt({
        command: commandLine,
        step: request.step,
        specDir: request.promptSpecDir,
    });

    return deps.run(prompt);
}
