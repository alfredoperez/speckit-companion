/**
 * Tracks which spec/step a spawned terminal is associated with so that
 * `vscode.window.onDidCloseTerminal` can fire `stepLifecycle.completeStep`
 * when the AI never wrote `.spec-context.json` itself.
 */

import * as vscode from 'vscode';
import { StepName } from '../../core/types/specContext';
import { completeStep } from './stepLifecycle';

interface Tracked {
    specDir: string;
    step: StepName;
}

const tracked = new Map<vscode.Terminal, Tracked>();

/** Associate a terminal with a spec/step so close → completeStep. */
export function track(
    terminal: vscode.Terminal | undefined,
    specDir: string,
    step: StepName
): void {
    if (!terminal) return;
    tracked.set(terminal, { specDir, step });
}

/**
 * Subscribe to terminal-close events. Returns a disposable that the caller
 * pushes into `context.subscriptions`.
 */
export function register(_context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.onDidCloseTerminal(async terminal => {
        const entry = tracked.get(terminal);
        if (!entry) return;
        tracked.delete(terminal);
        await completeStep(entry.specDir, entry.step, 'extension');
    });
}

/** Test helper — clears all tracked terminals. */
export function _resetForTests(): void {
    tracked.clear();
}
