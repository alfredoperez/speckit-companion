import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';
import { detectHostIde, HostIde } from '../ai-providers/ideChatProvider';

/**
 * The spec-kit CLI accepted agent identifier the upgrade command passes as
 * `specify init … --ai <agent>`. `claude-code` is NOT a member of this set —
 * the resolver never emits it.
 */
export type SpecKitAgent = string;

/** Safe fallback for any unrecognized / missing provider value. */
const DEFAULT_AGENT = 'claude';

/**
 * Direct provider → agent map, keyed by `speckit.aiProvider` values. Excludes
 * `ide-chat`, which is host-resolved (see IDE_CHAT_HOST_TO_AGENT).
 */
export const PROVIDER_TO_AGENT: Record<string, SpecKitAgent> = {
    [AIProviders.CLAUDE]: 'claude',
    [AIProviders.CLAUDE_VSCODE]: 'claude',
    [AIProviders.GEMINI]: 'gemini',
    [AIProviders.COPILOT]: 'copilot',
    [AIProviders.CODEX]: 'codex',
    [AIProviders.QWEN]: 'qwen',
    [AIProviders.OPENCODE]: 'opencode',
    [AIProviders.ANTIGRAVITY]: 'agy',
};

/** `ide-chat` resolves by detected host editor; unknown hosts fall back to Copilot. */
const IDE_CHAT_HOST_TO_AGENT: Record<HostIde, SpecKitAgent> = {
    vscode: 'copilot',
    cursor: 'cursor-agent',
    windsurf: 'windsurf',
    antigravity: 'agy',
    unknown: 'copilot',
};

/**
 * Pure, total map from the configured provider (plus host, for `ide-chat`) to a
 * valid spec-kit CLI agent. Never throws, never reads config, and never returns
 * `claude-code` — any unrecognized/missing provider resolves to `claude`.
 */
export function resolveSpecKitAgent(provider: string | undefined, host: HostIde): SpecKitAgent {
    if (provider === AIProviders.IDE_CHAT) {
        return IDE_CHAT_HOST_TO_AGENT[host] ?? IDE_CHAT_HOST_TO_AGENT.unknown;
    }
    return PROVIDER_TO_AGENT[provider ?? ''] ?? DEFAULT_AGENT;
}

/**
 * Impure wrapper: reads `speckit.aiProvider`, detects the host, and resolves the
 * agent. Both upgrade dispatch sites call this so neither can hardcode an agent.
 */
export function getConfiguredSpecKitAgent(): SpecKitAgent {
    const provider = vscode.workspace.getConfiguration('speckit').get<string>('aiProvider');
    return resolveSpecKitAgent(provider, detectHostIde());
}
