export type HostIde = 'vscode' | 'cursor' | 'windsurf' | 'unknown';

/** The one host-editor detection both the IDE Chat display name and its icon read, so a row's label and mark can never disagree. */
export function detectHostIde(uriScheme: string | undefined, appName: string | undefined): HostIde {
    const scheme = (uriScheme || '').toLowerCase();
    const app = (appName || '').toLowerCase();
    if (scheme === 'cursor' || app.includes('cursor')) { return 'cursor'; }
    if (scheme === 'windsurf' || app.includes('windsurf')) { return 'windsurf'; }
    if (scheme === 'vscode' || scheme === 'vscode-insiders' || app.includes('visual studio code')) { return 'vscode'; }
    return 'unknown';
}
