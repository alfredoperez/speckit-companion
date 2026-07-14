import { AIProviders } from '../../core/constants';

export type HostIde = 'vscode' | 'cursor' | 'windsurf' | 'unknown';

export type ProviderIconKey =
    /** A single colored SVG under `assets/icons/providers/`. */
    | { kind: 'asset'; file: string }
    /** A monochrome mark shipping `<name>-light.svg` / `<name>-dark.svg`. */
    | { kind: 'mono'; name: string }
    /** A themed Codicon — the neutral fallback. */
    | { kind: 'codicon'; id: string };

export const NEUTRAL_PROVIDER_ICON: ProviderIconKey = { kind: 'codicon', id: 'comment-discussion' };

/**
 * Resolve the host editor from the same two signals `getProviderDisplayName()`
 * reads, so the provider row's label and its mark can never disagree.
 */
export function detectHostIde(uriScheme: string | undefined, appName: string | undefined): HostIde {
    const scheme = (uriScheme || '').toLowerCase();
    const app = (appName || '').toLowerCase();
    if (scheme === 'cursor' || app.includes('cursor')) { return 'cursor'; }
    if (scheme === 'windsurf' || app.includes('windsurf')) { return 'windsurf'; }
    if (scheme === 'vscode' || scheme === 'vscode-insiders' || app.includes('visual studio code')) { return 'vscode'; }
    return 'unknown';
}

const COLORED: Record<string, string> = {
    [AIProviders.CLAUDE]: 'claude.svg',
    [AIProviders.CLAUDE_VSCODE]: 'claude.svg',
    [AIProviders.GEMINI]: 'gemini.svg',
    [AIProviders.QWEN]: 'qwen.svg',
};

const MONOCHROME: Record<string, string> = {
    [AIProviders.COPILOT]: 'copilot',
    [AIProviders.CODEX]: 'codex',
    [AIProviders.OPENCODE]: 'opencode',
};

const IDE_CHAT_MARKS: Record<HostIde, ProviderIconKey> = {
    vscode: { kind: 'mono', name: 'copilot' },
    cursor: { kind: 'mono', name: 'cursor' },
    windsurf: { kind: 'mono', name: 'windsurf' },
    unknown: NEUTRAL_PROVIDER_ICON,
};

/**
 * No official Wibey mark ships with the extension, so both Wibey providers
 * resolve to the neutral chat glyph deliberately rather than falling through.
 */
const DOCUMENTED_NEUTRAL: ReadonlySet<string> = new Set<string>([
    AIProviders.WIBEY,
    AIProviders.WIBEY_VSCODE,
]);

export function resolveProviderIconKey(providerId: string, host: HostIde): ProviderIconKey {
    if (providerId === AIProviders.IDE_CHAT) {
        return IDE_CHAT_MARKS[host];
    }
    if (DOCUMENTED_NEUTRAL.has(providerId)) {
        return NEUTRAL_PROVIDER_ICON;
    }
    if (COLORED[providerId]) {
        return { kind: 'asset', file: COLORED[providerId] };
    }
    if (MONOCHROME[providerId]) {
        return { kind: 'mono', name: MONOCHROME[providerId] };
    }
    return NEUTRAL_PROVIDER_ICON;
}
