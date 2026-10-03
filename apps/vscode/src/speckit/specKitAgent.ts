import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';
import { detectHostIde, HostIde } from '../ai-providers/ideChatProvider';
import type { AIProviderType } from '../ai-providers/aiProvider';

/** The spec-kit agent id passed to `specify init`; the resolver never emits `claude-code`. */
export type SpecKitAgent = string;

/** The flag a `specify` CLI takes to pick the agent: `--ai` on older CLIs, `--integration` since. */
export type SpecKitAgentFlag = '--integration' | '--ai';

// Agents only the old `--ai` flag knows; `specify integration list` does not name them.
const AI_FLAG_ONLY_AGENTS: ReadonlySet<SpecKitAgent> = new Set(['windsurf']);

/** The agent arguments for `specify init`, or '' when this CLI has no flag for the agent and its own picker must ask. */
export function specKitInitAgentArgs(agent: SpecKitAgent, flag: SpecKitAgentFlag): string {
    if (flag === '--integration' && AI_FLAG_ONLY_AGENTS.has(agent)) { return ''; }
    return `${flag} ${agent}`;
}

/** Safe fallback for any unrecognized / missing provider value. */
const DEFAULT_AGENT = 'claude';

/**
 * Direct provider → agent map, keyed by `speckit.aiProvider` values. Excludes
 * `ide-chat`, which is host-resolved (see IDE_CHAT_HOST_TO_AGENT).
 */
export const PROVIDER_TO_AGENT: Record<string, SpecKitAgent> = {
    [AIProviders.CLAUDE]: 'claude',
    [AIProviders.OMP]: 'omp',
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

// The first provider listed for an agent wins.
const AGENT_TO_PROVIDER: ReadonlyMap<string, AIProviderType> = (() => {
    const map = new Map<string, AIProviderType>();
    for (const [provider, agent] of Object.entries(PROVIDER_TO_AGENT)) {
        if (!map.has(agent)) { map.set(agent, provider as AIProviderType); }
    }
    return map;
})();

/** The provider to suggest for the project's Spec Kit integration agent, or undefined when there is nothing to suggest. */
export function resolveIntegrationProvider(
    configured: AIProviderType,
    host: HostIde,
    integrationAgent: string
): AIProviderType | undefined {
    if (configured === AIProviders.IDE_CHAT && host === 'windsurf') { return undefined; }
    if (configured !== AIProviders.IDE_CHAT && !Object.prototype.hasOwnProperty.call(PROVIDER_TO_AGENT, configured)) { return undefined; }
    if (resolveSpecKitAgent(configured, host) === integrationAgent) { return undefined; }
    return AGENT_TO_PROVIDER.get(integrationAgent);
}

/**
 * Impure wrapper: reads `speckit.aiProvider`, detects the host, and resolves the
 * agent. The init and upgrade dispatch sites call this so none can hardcode an agent.
 */
export function getConfiguredSpecKitAgent(): SpecKitAgent {
    const provider = vscode.workspace.getConfiguration('speckit').get<string>('aiProvider');
    return resolveSpecKitAgent(provider, detectHostIde());
}
