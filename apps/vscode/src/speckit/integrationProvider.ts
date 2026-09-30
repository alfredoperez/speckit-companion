import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    AIProviderType,
    PROVIDER_PATHS,
    getConfiguredProviderType,
    getProviderDisplayName,
    setIntegrationProviderOverride,
} from '../ai-providers/aiProvider';
import { detectHostIde } from '../ai-providers/ideChatProvider';
import { resolveIntegrationProvider } from './specKitAgent';

const KEPT_KEY = 'speckit.integrationProviderKept';

/** The agent Spec Kit records as this project's default, or undefined when the file does not name one. */
export function parseIntegrationAgent(text: string): string | undefined {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (typeof data !== 'object' || data === null) { return undefined; }
    const record = data as Record<string, unknown>;
    for (const key of ['default_integration', 'integration']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) { return value.trim(); }
    }
    return undefined;
}

function readIntegrationAgent(root: string, log: (message: string) => void): string | undefined {
    let text: string;
    try {
        text = fs.readFileSync(path.join(root, '.specify', 'integration.json'), 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            log('[integration] Could not read .specify/integration.json; keeping speckit.aiProvider');
        }
        return undefined;
    }
    const agent = parseIntegrationAgent(text);
    if (!agent) { log('[integration] .specify/integration.json names no default integration; keeping speckit.aiProvider'); }
    return agent;
}

/**
 * When the project's Spec Kit integration names a different agent than `speckit.aiProvider`
 * resolves to, use the provider for that agent and say so. The setting is never rewritten;
 * "Keep" remembers the choice for this project.
 */
export function applyIntegrationProvider(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    const log = (message: string) => outputChannel.appendLine(message);
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return; }

    const agent = readIntegrationAgent(root, log);
    if (!agent) { return; }

    const configured = getConfiguredProviderType();
    const target = resolveIntegrationProvider(configured, detectHostIde(), agent);
    if (!target || !(target in PROVIDER_PATHS)) { return; }

    const pair = `${agent}|${configured}`;
    if (context.workspaceState.get<string>(KEPT_KEY) === pair) {
        log(`[integration] Project integration is ${agent}; keeping speckit.aiProvider ${configured} as chosen`);
        return;
    }

    setIntegrationProviderOverride(target as AIProviderType);
    const configuredName = getProviderDisplayName(configured);
    const targetName = getProviderDisplayName(target as AIProviderType);
    log(`[integration] Project integration is ${agent} but speckit.aiProvider is ${configured} → using ${target}`);

    const keep = `Keep ${configuredName}`;
    void Promise.resolve(vscode.window.showInformationMessage(
        `This project's Spec Kit integration is ${agent}, but the AI provider setting is ${configuredName}. Using ${targetName} for this project.`,
        keep
    )).then(async choice => {
        if (choice !== keep) { return; }
        setIntegrationProviderOverride(undefined);
        await context.workspaceState.update(KEPT_KEY, pair);
        log(`[integration] Keeping ${configured} over project integration ${agent}`);
    }).catch(() => log('[integration] Could not remember the kept provider; the message will show again'));
}
