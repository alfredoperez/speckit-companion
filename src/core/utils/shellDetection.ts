import * as vscode from 'vscode';
import * as path from 'path';

export type Shell = 'bash' | 'powershell' | 'cmd' | 'unknown';

export function detectShell(): Shell {
    const shellPath = vscode.env.shell;
    if (shellPath && shellPath.length > 0) {
        const basename = path.basename(shellPath).toLowerCase().replace(/\.exe$/, '');
        if (basename === 'pwsh' || basename === 'powershell') return 'powershell';
        if (basename === 'cmd') return 'cmd';
        if (basename === 'bash' || basename === 'zsh' || basename === 'sh') return 'bash';
        return 'unknown';
    }
    return process.platform === 'win32' ? 'powershell' : 'bash';
}

export function formatPromptFileSubstitution(shell: Shell, absPath: string): string {
    switch (shell) {
        case 'powershell':
            // Single-quoted path so `$` in the path is not expanded.
            return `$(Get-Content -Raw '${absPath}')`;
        case 'cmd':
            return '';
        case 'bash':
        case 'unknown':
        default:
            return `$(cat "${absPath}")`;
    }
}
