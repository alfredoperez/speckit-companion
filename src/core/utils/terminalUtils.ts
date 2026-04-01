import * as vscode from 'vscode';
import * as fs from 'fs';
import { Timing } from '../constants';
import { AIExecutionResult } from '../../ai-providers/aiProvider';

/**
 * Waits for a terminal's shell to be ready before sending commands.
 * Uses VS Code's shell integration API when available, with a timeout fallback.
 */
export function waitForShellReady(
    terminal: vscode.Terminal,
    timeoutMs: number = Timing.shellReadyTimeoutMs
): Promise<void> {
    // Already ready
    if (terminal.shellIntegration) {
        return Promise.resolve();
    }

    // Fallback if the event API doesn't exist (VS Code < 1.93)
    if (!vscode.window.onDidChangeTerminalShellIntegration) {
        return new Promise(resolve => setTimeout(resolve, timeoutMs));
    }

    return new Promise<void>(resolve => {
        let resolved = false;

        const listener = vscode.window.onDidChangeTerminalShellIntegration(e => {
            if (e.terminal === terminal && !resolved) {
                resolved = true;
                listener.dispose();
                clearTimeout(timer);
                resolve();
            }
        });

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                listener.dispose();
                resolve();
            }
        }, timeoutMs);
    });
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

/**
 * Execute a command in a hidden terminal using shell integration when available,
 * with a fallback to sendText + timeout.
 */
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

    await waitForShellReady(terminal);

    if (terminal.shellIntegration) {
        const execution = terminal.shellIntegration.executeCommand(commandLine);

        return new Promise((resolve) => {
            const disposable = vscode.window.onDidEndTerminalShellExecution(event => {
                if (event.terminal === terminal && event.execution === execution) {
                    disposable.dispose();

                    if (event.exitCode !== 0) {
                        outputChannel.appendLine(`[${logPrefix}] Command failed with exit code: ${event.exitCode}`);
                        if (logCommandOnFailure) {
                            outputChannel.appendLine(`[${logPrefix}] Command was: ${commandLine}`);
                        }
                    }

                    resolve({
                        exitCode: event.exitCode,
                        output: undefined
                    });

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
                }
            });
        });
    } else {
        outputChannel.appendLine(`[${logPrefix}] Shell integration not available, using fallback mode`);
        terminal.sendText(commandLine);

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
            }, Timing.shellReadyTimeoutMs);
        });
    }
}
