import * as vscode from 'vscode';
import * as fs from 'fs';
import { Timing } from '../constants';
import { AIExecutionResult } from '../../ai-providers/aiProvider';
import * as path from 'path';

/** One command handed to a terminal; only a shell-integration run has `ended` (its exit code, or undefined if the terminal closed). */
export interface ShellRun {
    startedAt: number;
    via: 'shell-integration' | 'send-text';
    ended?: Promise<number | undefined>;
}

export interface RunInTerminalOptions {
    /** False types the command without pressing Enter, so the user runs it. */
    autoExecute?: boolean;
    /** A hidden terminal gets no "waiting for the terminal" notice. */
    hidden?: boolean;
}

const runs = new WeakMap<vscode.Terminal, ShellRun>();

/** The command `runInTerminal` last ran in this terminal, if it was handed over at or after `since`. */
export function shellRunIn(terminal: vscode.Terminal, since = 0): ShellRun | undefined {
    const run = runs.get(terminal);
    return run && run.startedAt >= since ? run : undefined;
}

function shellIntegrationApiAvailable(): boolean {
    return typeof vscode.window.onDidChangeTerminalShellIntegration === 'function';
}

const INTEGRATED_SHELLS = new Set(['bash', 'zsh', 'fish', 'pwsh', 'powershell']);

/** Only the shells VS Code injects integration into can report ready; others (sh, nu, cmd) get no signal to wait for. */
export function shellIntegrationExpected(): boolean {
    if (!shellIntegrationApiAvailable()) return false;
    const enabled = vscode.workspace
        .getConfiguration('terminal.integrated')
        ?.get<unknown>('shellIntegration.enabled');
    if (enabled === false) return false;
    const shellPath = vscode.env.shell;
    if (!shellPath) return true;
    const name = path.basename(shellPath.replace(/\\/g, '/')).toLowerCase().replace(/\.exe$/, '');
    return INTEGRATED_SHELLS.has(name);
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Integration activates only after the user's startup files finish, so it marks the shell being at its prompt. */
export function waitForShellIntegration(terminal: vscode.Terminal, timeoutMs: number): Promise<boolean> {
    if (terminal.shellIntegration) return Promise.resolve(true);
    if (!shellIntegrationApiAvailable()) {
        return delay(timeoutMs).then(() => !!terminal.shellIntegration);
    }
    return new Promise<boolean>(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            listener.dispose();
            clearTimeout(timer);
            resolve(!!terminal.shellIntegration);
        };
        const listener = vscode.window.onDidChangeTerminalShellIntegration(e => {
            if (e.terminal === terminal) finish();
        });
        const timer = setTimeout(finish, timeoutMs);
    });
}

const pendingEnds = new Map<vscode.TerminalShellExecution, { terminal: vscode.Terminal; resolve: (code: number | undefined) => void }>();
let endListenersRegistered = false;

function settle(execution: vscode.TerminalShellExecution, code: number | undefined): void {
    const pending = pendingEnds.get(execution);
    if (!pending) return;
    pendingEnds.delete(execution);
    pending.resolve(code);
}

function ensureEndListeners(): void {
    if (endListenersRegistered) return;
    endListenersRegistered = true;
    vscode.window.onDidEndTerminalShellExecution(e => settle(e.execution, e.exitCode));
    if (typeof vscode.window.onDidCloseTerminal === 'function') {
        vscode.window.onDidCloseTerminal(closed => {
            for (const [execution, pending] of pendingEnds) {
                if (pending.terminal === closed) settle(execution, undefined);
            }
        });
    }
}

function watchExecutionEnd(
    terminal: vscode.Terminal,
    execution: vscode.TerminalShellExecution,
): Promise<number | undefined> | undefined {
    if (typeof vscode.window.onDidEndTerminalShellExecution !== 'function') return undefined;
    ensureEndListeners();
    return new Promise(resolve => pendingEnds.set(execution, { terminal, resolve }));
}

/** Show a notice while the wait drags on, so a shell asking a question at startup is noticed. */
function noticeWhileWaiting(terminal: vscode.Terminal, waiting: Promise<unknown>): void {
    const timer = setTimeout(() => {
        void vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Waiting for the "${terminal.name}" terminal to finish starting. If it is asking a question, answer it there.`,
            },
            () => waiting,
        );
    }, Timing.shellWaitNoticeMs);
    void waiting.finally(() => clearTimeout(timer));
}

/** The one way the extension runs a terminal command: nothing is typed until the shell is at its prompt. */
export async function runInTerminal(
    terminal: vscode.Terminal,
    commandLine: string,
    options: RunInTerminalOptions = {},
): Promise<ShellRun> {
    const { autoExecute = true, hidden = false } = options;

    // Shell integration interrupts a running command to start a new one.
    const previous = runs.get(terminal);
    if (previous?.ended) {
        await Promise.race([previous.ended, delay(Timing.previousCommandWaitMs)]);
    }

    if (!terminal.shellIntegration) {
        // A hidden terminal cannot be answered, so it never waits long for a prompt the user cannot see.
        const expected = shellIntegrationExpected() && !hidden;
        const waiting = waitForShellIntegration(
            terminal,
            expected ? Timing.shellIntegrationTimeoutMs : Timing.shellStartFallbackMs,
        );
        if (expected) noticeWhileWaiting(terminal, waiting);
        await waiting;
    }

    const run: ShellRun = { startedAt: Date.now(), via: 'send-text' };
    const integration = terminal.shellIntegration;
    if (integration && autoExecute) {
        try {
            const execution = integration.executeCommand(commandLine);
            run.via = 'shell-integration';
            run.ended = watchExecutionEnd(terminal, execution);
        } catch {
            terminal.sendText(commandLine, true);
        }
    } else {
        terminal.sendText(commandLine, autoExecute);
    }
    runs.set(terminal, run);
    return run;
}

export interface ExecuteInHiddenTerminalOptions {
    commandLine: string;
    cwd: string | undefined;
    terminalName: string;
    outputChannel: vscode.OutputChannel;
    logPrefix: string;
    cleanupFn?: () => Promise<void>;
    tempFilePath?: string;
    logCommandOnFailure?: boolean;
}

/** Execute a command in a hidden terminal and report its exit code when shell integration can. */
export async function executeCommandInHiddenTerminal(
    options: ExecuteInHiddenTerminalOptions
): Promise<AIExecutionResult> {
    const {
        commandLine,
        cwd,
        terminalName,
        outputChannel,
        logPrefix,
        cleanupFn,
        tempFilePath,
        logCommandOnFailure = false
    } = options;

    const terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd,
        hideFromUser: true
    });

    const run = await runInTerminal(terminal, commandLine, { hidden: true });

    if (run.ended) {
        const exitCode = await run.ended;
        if (exitCode !== 0) {
            outputChannel.appendLine(`[${logPrefix}] Command failed with exit code: ${exitCode}`);
            if (logCommandOnFailure) {
                outputChannel.appendLine(`[${logPrefix}] Command was: ${commandLine}`);
            }
        }
        setTimeout(async () => {
            terminal.dispose();
            if (cleanupFn) {
                await cleanupFn();
            }
            if (tempFilePath) {
                try {
                    await fs.promises.unlink(tempFilePath);
                    outputChannel.appendLine(`[${logPrefix}] Cleaned up temp file: ${tempFilePath}`);
                } catch (e) {
                    outputChannel.appendLine(`[${logPrefix}] Failed to cleanup temp file: ${e}`);
                }
            }
        }, Timing.terminalDisposeDelay);
        return { exitCode, output: undefined };
    }

    outputChannel.appendLine(`[${logPrefix}] Shell integration not available, using fallback mode`);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ exitCode: undefined });
            terminal.dispose();
            if (tempFilePath) {
                fs.promises.unlink(tempFilePath).catch(() => {});
            }
            if (cleanupFn) {
                cleanupFn().catch(() => {});
            }
        }, Timing.shellStartFallbackMs);
    });
}
