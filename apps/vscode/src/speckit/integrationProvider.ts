import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfiguredProviderType, getProviderDisplayName } from '../ai-providers/aiProvider';
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
            log('[integration] Could not read .specify/integration.json; no provider suggestion');
        }
        return undefined;
    }
    const agent = parseIntegrationAgent(text);
    if (!agent) { log('[integration] .specify/integration.json is not valid JSON or names no default integration; no provider suggestion'); }
    return agent;
}

function keptPairs(context: vscode.ExtensionContext): string[] {
    const value = context.workspaceState.get<unknown>(KEPT_KEY);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Suggests the provider the project's Spec Kit integration names; only a Switch click changes the setting. */
export async function suggestIntegrationProvider(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<void> {
    const log = (message: string) => outputChannel.appendLine(message);
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return; }

    const agent = readIntegrationAgent(root, log);
    if (!agent) { return; }

    const configured = getConfiguredProviderType();
    const target = resolveIntegrationProvider(configured, detectHostIde(), agent);
    if (!target) { return; }

    const pair = `${agent}|${configured}`;
    if (keptPairs(context).includes(pair)) { return; }

    const configuredName = getProviderDisplayName(configured);
    const targetName = getProviderDisplayName(target);
    const switchLabel = `Switch to ${targetName}`;
    const keepLabel = `Keep ${configuredName}`;

    try {
        const choice = await vscode.window.showInformationMessage(
            `This project was set up with Spec Kit for ${targetName}, but SpecKit Companion is using ${configuredName}.`,
            switchLabel,
            keepLabel
        );
        if (choice === switchLabel) {
            const config = vscode.workspace.getConfiguration('speckit');
            const scope = config.inspect('aiProvider')?.workspaceValue !== undefined
                ? vscode.ConfigurationTarget.Workspace
                : vscode.ConfigurationTarget.Global;
            await config.update('aiProvider', target, scope);
            log(`[integration] Switched speckit.aiProvider to ${target} to match project integration ${agent}`);
            return;
        }
        await context.workspaceState.update(KEPT_KEY, [...keptPairs(context), pair]);
    } catch {
        log('[integration] Could not apply the provider choice; the suggestion will show again');
    }
}
