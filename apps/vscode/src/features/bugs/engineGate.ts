import * as vscode from 'vscode';
import { runInTerminal } from '../../core/utils/terminalUtils';
import { gateChoice, resumeCommand, type EngineRun, type GateVerdict } from './engineFormat';

export function coerceGateVerdict(value: unknown): GateVerdict | undefined {
    return value === 'approve' || value === 'reject' ? value : undefined;
}

/**
 * Resumes a run paused at the bundled review gate in a terminal and types the verdict at its prompt.
 * The gate only reads a choice from a terminal you can type in, so a headless resume would stop at it again.
 */
export async function answerReviewGate(root: string, run: EngineRun | undefined, verdict: GateVerdict): Promise<vscode.Terminal | undefined> {
    const choice = gateChoice(run, verdict);
    const command = run && resumeCommand(run.runId);
    if (!choice || !command) return undefined;
    const terminal = vscode.window.createTerminal({ name: `Spec Kit bug review (${verdict})`, cwd: root });
    terminal.show();
    await runInTerminal(terminal, command);
    // Typed ahead: the line waits in the terminal until the gate's prompt reads it.
    terminal.sendText(choice, true);
    return terminal;
}
