/**
 * The pipeline builder panel.
 *
 * Shows the pipeline a build would produce — steps, phases, nodes, hooks, the
 * decision and where its verdicts route — and what this project changed from the
 * shipped default. Building and previewing run the same commands the palette
 * does, so there is one build in the product and not two.
 *
 * Read-mostly by design: the configuration is a file a person edits and reviews
 * in a pull request, so the panel opens it rather than pretending to own it.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    BuilderToExtensionMessage,
    ExtensionToBuilderMessage,
    PipelineGraphResult,
} from '../../protocol/pipeline';
import { createDispatcher, DispatcherMap } from '../../core/utils/dispatcher';
import { readPipelineBuildState, COMPANION_CONFIG_REL } from '../specs/pipelineBuild';
import { readPipelineGraph, resolveGraphScript } from '../specs/pipelineGraph';

const VIEW_TYPE = 'speckit.pipelineBuilder';

function nonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 32; i++) { out += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return out;
}

export class PipelineBuilderPanel {
    private static current: PipelineBuilderPanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly workspaceRoot: string,
    ) {
        this.panel.webview.html = this.html();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(
            message => void this.route(message as BuilderToExtensionMessage),
            null,
            this.disposables,
        );

        // Rebuilding elsewhere, or editing the configuration, should be visible
        // here without anyone remembering to refresh.
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceRoot, '.specify/companion.yml'),
        );
        watcher.onDidChange(() => void this.send(), null, this.disposables);
        watcher.onDidCreate(() => void this.send(), null, this.disposables);
        watcher.onDidDelete(() => void this.send(), null, this.disposables);
        this.disposables.push(watcher);
    }

    static show(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            void vscode.window.showWarningMessage('Open a workspace folder to see its pipeline.');
            return;
        }
        if (PipelineBuilderPanel.current) {
            PipelineBuilderPanel.current.panel.reveal();
            void PipelineBuilderPanel.current.send();
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            VIEW_TYPE,
            'Pipeline Builder',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist'))],
            },
        );
        PipelineBuilderPanel.current = new PipelineBuilderPanel(
            panel, context, outputChannel, workspaceRoot);
    }

    private readonly handlers: DispatcherMap<BuilderToExtensionMessage, []> = {
        ready: () => this.send(),
        refresh: () => this.send(),
        build: () => this.run('speckit.companion.buildPipeline'),
        preview: () => this.run('speckit.companion.previewPipelineBuild'),
        openConfig: async () => {
            const file = path.join(this.workspaceRoot, COMPANION_CONFIG_REL);
            if (!fs.existsSync(file)) {
                void vscode.window.showInformationMessage(
                    'This project has no companion.yml yet — the pipeline runs the shipped default.',
                );
                return;
            }
            await vscode.window.showTextDocument(vscode.Uri.file(file));
        },
        openNode: async message => {
            // A node's instructions live in the extension's sources, which a
            // consuming project does not have. Opening the built command is the
            // honest fallback: it is what the assistant actually reads.
            const built = path.join(
                this.workspaceRoot, '.specify', 'extensions', 'companion', 'commands',
                `speckit.companion.${message.command}.md`,
            );
            if (!fs.existsSync(built)) {
                void vscode.window.showInformationMessage(
                    `Build the pipeline to read ${message.nodeId}'s instructions as the assistant sees them.`,
                );
                return;
            }
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(built));
            const editor = await vscode.window.showTextDocument(doc);
            const marker = doc.getText().indexOf(`speckit-companion:node ${message.nodeId}`);
            if (marker >= 0) {
                const at = doc.positionAt(marker);
                editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.AtTop);
                editor.selection = new vscode.Selection(at, at);
            }
        },
    };

    private readonly route = createDispatcher(this.handlers, {
        onUnhandled: message => this.outputChannel.appendLine(
            `[PipelineBuilder] ignored message: ${(message as { type: string }).type}`),
    });

    private async run(command: string): Promise<void> {
        await this.post({ type: 'busy', busy: true });
        try {
            await vscode.commands.executeCommand(command);
        } finally {
            await this.post({ type: 'busy', busy: false });
            await this.send();
        }
    }

    private async send(): Promise<void> {
        const script = resolveGraphScript(this.workspaceRoot, this.context.extensionPath);
        const graph: PipelineGraphResult = script
            ? await readPipelineGraph(script, this.workspaceRoot)
            : { error: 'The pipeline builder needs the companion spec-kit extension.' };
        await this.post({
            type: 'graph',
            graph,
            buildState: readPipelineBuildState(this.workspaceRoot).kind,
        });
    }

    private post(message: ExtensionToBuilderMessage): Thenable<boolean> {
        return this.panel.webview.postMessage(message);
    }

    private html(): string {
        const webview = this.panel.webview;
        const dist = vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview'));
        const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'pipeline-builder.js'));
        const styles = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'pipeline-builder.css'));
        const tokens = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'tokens.css'));
        const id = nonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${id}'; font-src ${webview.cspSource};">
<link href="${tokens}" rel="stylesheet">
<link href="${styles}" rel="stylesheet">
<title>Pipeline Builder</title>
</head>
<body>
<div id="app-root"></div>
<script nonce="${id}" src="${script}"></script>
</body>
</html>`;
    }

    private dispose(): void {
        PipelineBuilderPanel.current = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }
}

export function registerPipelineBuilderCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.companion.openPipelineBuilder',
            () => PipelineBuilderPanel.show(context, outputChannel)),
    );
}
