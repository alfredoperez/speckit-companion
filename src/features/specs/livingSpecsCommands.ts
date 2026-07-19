import * as vscode from 'vscode';
import { getAIProvider } from '../../extension';
import { LivingSpecsExplorerProvider } from './livingSpecsExplorerProvider';
import { ResolvedCapability } from './livingSpecsModel';

/**
 * Actions for the Living Specs view: dispatch the existing
 * `/speckit.companion.living-{drift,coverage,adopt}` commands to the AI provider —
 * the same one-way `executeSlashCommand` path every other Companion command
 * uses — plus a refresh that recomputes row health. The extension never runs
 * the workspace Python itself.
 */

interface CapabilityNode {
    capability?: ResolvedCapability;
}

function capabilityName(item?: CapabilityNode): string {
    return item?.capability?.name?.trim() ?? '';
}

async function dispatchScoped(command: 'living-drift' | 'living-coverage', title: string, item?: CapabilityNode): Promise<void> {
    const name = capabilityName(item);
    const text = name ? `/speckit.companion.${command} ${name}` : `/speckit.companion.${command}`;
    await getAIProvider().executeSlashCommand(text, title, true);
}

export function registerLivingSpecsCommands(
    context: vscode.ExtensionContext,
    provider: LivingSpecsExplorerProvider,
    outputChannel: vscode.OutputChannel,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.livingSpecs.drift', async (item?: CapabilityNode) => {
            outputChannel.appendLine(`[SpecKit] Living-spec drift check for: ${capabilityName(item) || '(all capabilities)'}`);
            await dispatchScoped('living-drift', 'SpecKit - Living-Spec Drift', item);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.coverage', async (item?: CapabilityNode) => {
            outputChannel.appendLine(`[SpecKit] Coverage check for: ${capabilityName(item) || '(all capabilities)'}`);
            await dispatchScoped('living-coverage', 'SpecKit - Requirement Coverage', item);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.adopt', async () => {
            outputChannel.appendLine('[SpecKit] Living-spec adoption wizard dispatched');
            await getAIProvider().executeSlashCommand('/speckit.companion.living-adopt', 'SpecKit - Adopt Code Area', true);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.refresh', () => {
            provider.refresh();
        }),
    );
}
