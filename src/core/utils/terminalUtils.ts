import * as vscode from 'vscode';
import { Timing } from '../constants';

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
