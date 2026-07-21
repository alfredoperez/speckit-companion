import * as path from 'path';
import * as vscode from 'vscode';
import { getAIProvider } from '../../extension';
import { LivingSpecsExplorerProvider } from './livingSpecsExplorerProvider';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import {
    ResolvedCapability,
    readDriftedFiles,
    resolveCapabilityBySpecPath,
    isPathWithinRoot,
} from './livingSpecsModel';

/**
 * Actions for the Living Specs view: dispatch the `/speckit.companion.living-*`
 * commands to the AI provider — the same one-way `executeSlashCommand` path
 * every other Companion command uses — plus the standard file actions (copy,
 * reveal, delete) the Specs tree offers and an Update action that folds drift
 * back into a spec. The extension never runs the workspace Python itself.
 */

interface LivingSpecNode {
    capability?: ResolvedCapability;
    relPath?: string;
    /** Set by the viewer's Update button so the command can resolve the capability. */
    capabilitySpecPath?: string;
}

function capabilityName(item?: LivingSpecNode): string {
    return item?.capability?.name?.trim() ?? '';
}

function workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function nodeRelPath(item?: LivingSpecNode): string | undefined {
    return item?.relPath ?? item?.capability?.spec;
}

async function dispatchScoped(command: 'living-drift' | 'living-coverage', title: string, item?: LivingSpecNode): Promise<void> {
    const name = capabilityName(item);
    const text = name ? `/speckit.companion.${command} ${name}` : `/speckit.companion.${command}`;
    await getAIProvider().executeSlashCommand(text, title, true);
}

/**
 * The prompt the Update action dispatches: it names the drifted capability, lists
 * the source files that changed since the spec's last commit, and insists on an
 * update rather than a regeneration so every clarification already in the spec
 * survives.
 */
export function buildLivingUpdatePrompt(name: string, specPath: string, changedFiles: string[]): string {
    const lines = [
        `The "${name}" living spec has drifted — the code it describes changed since the spec was last committed.`,
        `Edit this spec file in place: ${specPath}`,
        'Update the living spec to match the current code. UPDATE, do not regenerate: keep every requirement,',
        'clarification, and acceptance scenario already written, and revise only what the code changes require.',
        '',
    ];
    if (changedFiles.length > 0) {
        lines.push("Files changed since the spec's last commit:");
        for (const file of changedFiles) {
            lines.push(`- ${file}`);
        }
    } else {
        lines.push(
            "Inspect the files under this capability's match globs to find what changed since the spec's last commit.",
        );
    }
    return lines.join('\n');
}

async function dispatchUpdate(cap: ResolvedCapability, outputChannel: vscode.OutputChannel): Promise<void> {
    const root = workspaceRoot();
    const changed = root ? (await readDriftedFiles(root, cap)) ?? [] : [];
    outputChannel.appendLine(
        `[SpecKit] Update living spec "${cap.name}" — ${changed.length} changed file(s) in prompt`,
    );
    const prompt = buildLivingUpdatePrompt(cap.name, cap.spec, changed);
    // Natural-language instruction, not a slash command — executeSlashCommand
    // would force a leading `/` on CLI providers and dispatch it as an unknown command.
    await getAIProvider().executeInTerminal(prompt, 'SpecKit - Update Living Spec');
}

export function registerLivingSpecsCommands(
    context: vscode.ExtensionContext,
    provider: LivingSpecsExplorerProvider,
    outputChannel: vscode.OutputChannel,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.livingSpecs.drift', async (item?: LivingSpecNode) => {
            outputChannel.appendLine(`[SpecKit] Living-spec drift check for: ${capabilityName(item) || '(all capabilities)'}`);
            await dispatchScoped('living-drift', 'SpecKit - Living-Spec Drift', item);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.coverage', async (item?: LivingSpecNode) => {
            outputChannel.appendLine(`[SpecKit] Coverage check for: ${capabilityName(item) || '(all capabilities)'}`);
            await dispatchScoped('living-coverage', 'SpecKit - Requirement Coverage', item);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.adopt', async () => {
            outputChannel.appendLine('[SpecKit] Living-spec adoption wizard dispatched');
            await getAIProvider().executeSlashCommand('/speckit.companion.living-adopt', 'SpecKit - Adopt Code Area', true);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.update', async (item?: LivingSpecNode) => {
            const root = workspaceRoot();
            let cap = item?.capability;
            if (!cap && root && item?.capabilitySpecPath) {
                cap = resolveCapabilityBySpecPath(root, item.capabilitySpecPath);
            }
            if (!cap) {
                vscode.window.showWarningMessage('No living spec to update — open one that has drifted.');
                return;
            }
            await dispatchUpdate(cap, outputChannel);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.copyPath', async (item?: LivingSpecNode) => {
            const rel = nodeRelPath(item);
            const root = workspaceRoot();
            if (!rel || !root || !isPathWithinRoot(root, rel)) return;
            const abs = path.join(root, rel);
            await vscode.env.clipboard.writeText(abs);
            NotificationUtils.showAutoDismissNotification(`Copied "${abs}"`);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.copyRelativePath', async (item?: LivingSpecNode) => {
            const rel = nodeRelPath(item);
            if (!rel) return;
            await vscode.env.clipboard.writeText(rel);
            NotificationUtils.showAutoDismissNotification(`Copied "${rel}"`);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.copyName', async (item?: LivingSpecNode) => {
            // A capability row copies its displayed capability name; tier/orphan
            // rows fall back to the file name (basename would give "spec.md" for a
            // centralized capability, not its name).
            const rel = nodeRelPath(item);
            const name = capabilityName(item) || (rel ? path.basename(rel) : '');
            if (!name) return;
            await vscode.env.clipboard.writeText(name);
            NotificationUtils.showAutoDismissNotification(`Copied "${name}"`);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.delete', async (item?: LivingSpecNode) => {
            const rel = nodeRelPath(item);
            const root = workspaceRoot();
            if (!rel || !root) return;
            // Never delete outside the workspace, even if a row carried a bad path.
            if (!isPathWithinRoot(root, rel)) return;
            const name = path.basename(rel);
            const confirm = await vscode.window.showWarningMessage(
                `Delete "${name}"? This cannot be undone.`,
                { modal: true },
                'Delete'
            );
            if (confirm !== 'Delete') return;
            try {
                await vscode.workspace.fs.delete(vscode.Uri.file(path.join(root, rel)), { recursive: false });
            } catch (err) {
                vscode.window.showErrorMessage(`Could not delete ${name}: ${err instanceof Error ? err.message : String(err)}`);
                return;
            }
            provider.refresh();
            NotificationUtils.showAutoDismissNotification(`Deleted "${name}"`);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.refresh', () => {
            provider.refresh();
        }),
    );
}
