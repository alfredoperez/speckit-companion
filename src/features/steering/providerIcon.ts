import { AIProviders } from '../../core/constants';
import { HostIde } from '../../core/utils/hostIde';

export type ProviderIconKey =
    /** A single colored SVG under `assets/icons/providers/`. */
    | { kind: 'asset'; file: string }
    /** A monochrome mark shipping `<name>-light.svg` / `<name>-dark.svg`. */
    | { kind: 'mono'; name: string }
    /** A themed Codicon — the neutral fallback. */
    | { kind: 'codicon'; id: string };

export const NEUTRAL_PROVIDER_ICON: ProviderIconKey = { kind: 'codicon', id: 'comment-discussion' };

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

/** Providers with no shipped vendor mark fall back to a themed Codicon that matches their QuickPick icon rather than the neutral chat glyph. */
const CODICON: Record<string, string> = {
    [AIProviders.ANTIGRAVITY]: 'rocket',
};

const IDE_CHAT_MARKS: Record<HostIde, ProviderIconKey> = {
    vscode: { kind: 'mono', name: 'copilot' },
    cursor: { kind: 'mono', name: 'cursor' },
    windsurf: { kind: 'mono', name: 'windsurf' },
    unknown: NEUTRAL_PROVIDER_ICON,
};

/** No official Wibey mark ships with the extension, so both Wibey providers resolve to the neutral glyph deliberately rather than falling through. */
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
    if (CODICON[providerId]) {
        return { kind: 'codicon', id: CODICON[providerId] };
    }
    return NEUTRAL_PROVIDER_ICON;
}
