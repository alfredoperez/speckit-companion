import * as path from 'path';
import * as vscode from 'vscode';
import { getAIProvider } from '../../extension';
import { LivingSpecsExplorerProvider } from './livingSpecsExplorerProvider';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import { reportLivingSpecDrift, reportLivingSpecSync } from '../../core/telemetry';
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

/** Directory names that are never a code area worth adopting. */
const AREA_SKIP = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', 'vendor', '__pycache__']);

/** Top-level source roots worth expanding one level, so `src/features` is offered and not just `src`. */
const AREA_EXPAND = new Set(['src', 'app', 'apps', 'lib', 'libs', 'packages', 'components', 'features']);

async function readDirs(dir: vscode.Uri): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(dir);
        return entries
            .filter(([name, kind]) => kind === vscode.FileType.Directory && !name.startsWith('.') && !AREA_SKIP.has(name))
            .map(([name]) => name);
    } catch {
        return [];
    }
}

/** The directories a user would plausibly adopt: top level, plus one level inside the usual source roots. */
export async function listCodeAreas(root: string): Promise<string[]> {
    const rootUri = vscode.Uri.file(root);
    const top = await readDirs(rootUri);
    const areas: string[] = [];
    for (const name of top.sort()) {
        areas.push(name);
        if (!AREA_EXPAND.has(name)) continue;
        const children = await readDirs(vscode.Uri.joinPath(rootUri, name));
        for (const child of children.sort()) {
            areas.push(`${name}/${child}`);
        }
    }
    return areas;
}

const TYPE_A_PATH = '$(edit) Type a path\u2026';

/** Ask which part of the codebase to adopt. Returns undefined when the user backs out. */
async function pickCodeArea(root: string): Promise<string | undefined> {
    const areas = await listCodeAreas(root);
    const items: vscode.QuickPickItem[] = areas.map(label => ({ label }));
    items.push({ label: TYPE_A_PATH, alwaysShow: true });

    const picked = await vscode.window.showQuickPick(items, {
        title: 'Adopt Code Area',
        placeHolder: 'Which part of the codebase should become living specs?',
        matchOnDescription: true,
    });
    if (!picked) {
        return undefined;
    }
    if (picked.label !== TYPE_A_PATH) {
        return picked.label;
    }
    const typed = await vscode.window.showInputBox({
        title: 'Adopt Code Area',
        prompt: 'Path to adopt, relative to the workspace root',
        placeHolder: 'src/features/checkout',
        validateInput: value => (value.trim() ? undefined : 'Enter a path to adopt'),
    });
    return typed?.trim() || undefined;
}

type SpecLayout = 'central' | 'colocated';

/** The registry a fresh project starts from: on, default exemptions, nothing adopted yet. */
export function initialRegistry(layout: SpecLayout): string {
    const where = layout === 'central'
        ? 'capabilities/<name>/<name>.spec.md, all under one root'
        : '<area>/<name>.spec.md, next to the code each one describes';
    return [
        '# Living specs for this project.',
        `# Specs go at ${where}.`,
        '# Adopt a code area to add the first capability.',
        'enabled: true',
        'exempt: ["*.config.*", "*.test.*", "**/migrations/**"]',
        'capabilities: []',
        '',
    ].join('\n');
}

async function pickLayout(): Promise<SpecLayout | undefined> {
    const central = 'Central — one folder holds every spec';
    const colocated = 'Next to the code — each spec sits in the folder it describes';
    const picked = await vscode.window.showQuickPick(
        [
            { label: colocated, detail: 'The spec travels with the code when it moves, and shows up in a folder you already have open.' },
            { label: central, detail: 'Easy to read end to end, and the spec stays put when code moves.' },
        ],
        { title: 'Where should living specs live?', placeHolder: 'You can move them later with Move Living Spec.' },
    );
    if (!picked) {
        return undefined;
    }
    return picked.label === central ? 'central' : 'colocated';
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
export function buildLivingUpdatePrompt(name: string, specPath: string, changedFiles: string[] | undefined): string {
    const lines = [
        `The "${name}" living spec has drifted — the code it describes changed since the spec was last committed.`,
        `Edit this spec file in place: ${specPath}`,
        'Update the living spec to match the current code. UPDATE, do not regenerate: keep every requirement,',
        'clarification, and acceptance scenario already written, and revise only what the code changes require.',
        '',
    ];
    if (changedFiles && changedFiles.length > 0) {
        lines.push("Files changed since the spec's last commit:");
        for (const file of changedFiles) {
            lines.push(`- ${file}`);
        }
    } else {
        // undefined = the git check failed/timed out (distinct from an empty result).
        if (changedFiles === undefined) {
            lines.push('(The changed-file list could not be determined — git was unavailable or the check timed out.)');
        }
        lines.push(
            "Inspect the files under this capability's match globs to find what changed since the spec's last commit.",
        );
    }
    return lines.join('\n');
}

async function dispatchUpdate(cap: ResolvedCapability, outputChannel: vscode.OutputChannel): Promise<void> {
    const root = workspaceRoot();
    // Preserve undefined (git failed/timed out) vs [] (computed, none) — the
    // prompt says different things for each.
    const changed = root ? await readDriftedFiles(root, cap) : undefined;
    outputChannel.appendLine(
        `[SpecKit] Update living spec "${cap.name}" — ${changed === undefined ? 'changed files unknown' : `${changed.length} changed file(s)`} in prompt`,
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
            reportLivingSpecDrift();
            const root = workspaceRoot();
            let scoped = item;
            if (!item?.capability && root && item?.capabilitySpecPath) {
                const cap = resolveCapabilityBySpecPath(root, item.capabilitySpecPath);
                if (cap) scoped = { ...item, capability: cap };
            }
            outputChannel.appendLine(`[SpecKit] Living-spec drift check for: ${capabilityName(scoped) || '(all capabilities)'}`);
            await dispatchScoped('living-drift', 'SpecKit - Living-Spec Drift', scoped);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.coverage', async (item?: LivingSpecNode) => {
            outputChannel.appendLine(`[SpecKit] Coverage check for: ${capabilityName(item) || '(all capabilities)'}`);
            await dispatchScoped('living-coverage', 'SpecKit - Requirement Coverage', item);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.init', async () => {
            const root = workspaceRoot();
            if (!root) {
                vscode.window.showWarningMessage('Open a folder before setting up living specs.');
                return;
            }
            const registry = vscode.Uri.file(path.join(root, 'living-specs.yml'));
            try {
                await vscode.workspace.fs.stat(registry);
                vscode.window.showInformationMessage('This project already has a living-specs.yml.');
                await vscode.commands.executeCommand('vscode.open', registry);
                return;
            } catch {
                // No registry yet, which is the case this command exists for.
            }

            const layout = await pickLayout();
            if (!layout) {
                outputChannel.appendLine('[SpecKit] Living-spec setup cancelled at the layout prompt');
                return;
            }
            await vscode.workspace.fs.writeFile(registry, Buffer.from(initialRegistry(layout), 'utf8'));
            outputChannel.appendLine(`[SpecKit] Wrote living-specs.yml (${layout} layout)`);
            provider.refresh();

            const adopt = 'Adopt a code area';
            const choice = await vscode.window.showInformationMessage(
                'Living specs are on. Adopt a code area to write the first one.',
                adopt,
            );
            if (choice === adopt) {
                await vscode.commands.executeCommand('speckit.livingSpecs.adopt', { layout });
            }
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.adopt', async (opts?: { layout?: SpecLayout }) => {
            const root = workspaceRoot();
            if (!root) {
                vscode.window.showWarningMessage('Open a folder before adopting a code area.');
                return;
            }
            const area = await pickCodeArea(root);
            if (!area) {
                outputChannel.appendLine('[SpecKit] Living-spec adoption cancelled at the area prompt');
                return;
            }
            // Setup already asked where specs live, so adoption must not ask again.
            const layout = opts?.layout ? ` --layout ${opts.layout}` : '';
            outputChannel.appendLine(`[SpecKit] Living-spec adoption dispatched for: ${area}`);
            await getAIProvider().executeSlashCommand(
                `/speckit.companion.living-adopt ${area}${layout}`,
                'SpecKit - Adopt Code Area',
                true,
            );
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.sync', async () => {
            reportLivingSpecSync();
            outputChannel.appendLine('[SpecKit] Living-spec sync from current changes dispatched');
            await getAIProvider().executeSlashCommand('/speckit.companion.living-sync', 'SpecKit - Sync Living Specs', true);
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
            // Prefer the capability name; a centralized spec's basename is just
            // "spec.md". Show the relative path so it's unambiguous which file goes.
            const label = capabilityName(item) || path.basename(rel);
            const confirm = await vscode.window.showWarningMessage(
                `Delete "${label}"? This cannot be undone.`,
                { modal: true, detail: rel },
                'Delete'
            );
            if (confirm !== 'Delete') return;
            try {
                await vscode.workspace.fs.delete(vscode.Uri.file(path.join(root, rel)), { recursive: false });
            } catch (err) {
                vscode.window.showErrorMessage(`Could not delete ${label}: ${err instanceof Error ? err.message : String(err)}`);
                return;
            }
            provider.refresh();
            NotificationUtils.showAutoDismissNotification(`Deleted "${label}"`);
        }),
        vscode.commands.registerCommand('speckit.livingSpecs.refresh', () => {
            provider.refresh();
        }),
    );
}
