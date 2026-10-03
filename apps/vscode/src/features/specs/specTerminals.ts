import * as path from 'path';
import * as vscode from 'vscode';

const terminals = new Map<string, vscode.Terminal>();
let notify: (() => void) | undefined;

export function rememberSpecTerminal(specDir: string, terminal: vscode.Terminal | undefined): void {
    if (!terminal) return;
    terminals.set(path.resolve(specDir), terminal);
    notify?.();
}

export function getSpecTerminal(specDir: string): vscode.Terminal | undefined {
    return terminals.get(path.resolve(specDir));
}

export function registerSpecTerminals(onChange: () => void): vscode.Disposable {
    notify = onChange;
    const subscription = vscode.window.onDidCloseTerminal(closed => {
        let forgotten = false;
        for (const [specDir, terminal] of terminals) {
            if (terminal !== closed) continue;
            terminals.delete(specDir);
            forgotten = true;
        }
        if (forgotten) onChange();
    });
    return {
        dispose: () => {
            subscription.dispose();
            if (notify === onChange) notify = undefined;
        },
    };
}

export function _resetForTests(): void {
    terminals.clear();
    notify = undefined;
}
