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
    HookWhen,
    PipelineGraphResult,
    PipelineStatus,
} from '../../protocol/pipeline';
import { createDispatcher, DispatcherMap } from '../../core/utils/dispatcher';
import { nodeFile, readableNode } from './readableNode';
import { readPipelineBuildState, COMPANION_CONFIG_REL } from '../specs/pipelineBuild';
import {
    readPipelineGraph,
    HookDraft,
    createStep,
    createWorkflow,
    resolveConfigWriteScript,
    resolveConfigRepairScript,
    applyRepair,
    resolveGraphScript,
    writeHook,
    removeHook,
    writeNodeOrder,
    writePhases,
    writeTemplateSection,
    writeWorkflow,
} from '../specs/pipelineGraph';

const VIEW_TYPE = 'speckit.pipelineBuilder';
const BUILD_COMMAND = 'speckit.companion.buildPipeline';

/** Mirrors `PROJECT_NODES_REL` in `_command_parts.py` — a project's own nodes. */
const PROJECT_NODES_REL = path.join('.specify', 'companion', 'nodes');

/** Mirrors `WORKFLOWS_REL` / `SHIPPED_WORKFLOW` in build-pipeline.py. */
const WORKFLOWS_REL = path.join('.specify', 'companion', 'workflows');
const SHIPPED_WORKFLOW = 'shipped';

/** Whether this workspace has already read the line explaining what the board is. */
const FIRST_RUN_SEEN = 'speckit.pipelineBuilder.firstRunSeen';

function nonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 32; i++) { out += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return out;
}

export class PipelineBuilderPanel {
    private static current: PipelineBuilderPanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];

    /** The way back from the last write, while the status line still offers it. */
    private pendingUndo: { token: string; run: () => Promise<void> } | null = null;

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly workspaceRoot: string,
    ) {
        this.panel.webview.html = this.html();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // A handler that throws — a command that failed, a file that would not
        // open — must not become an unhandled rejection. It is one action that
        // did not work, and the panel stays usable for the next one.
        this.panel.webview.onDidReceiveMessage(
            message => this.route(message as BuilderToExtensionMessage).catch(
                (err: unknown) => this.outputChannel.appendLine(
                    `[PipelineBuilder] ${(message as { type: string }).type} failed: ${err}`)),
            null,
            this.disposables,
        );

        // Rebuilding elsewhere, or editing the configuration, should be visible
        // here without anyone remembering to refresh.
        for (const pattern of ['.specify/companion.yml', '.specify/companion/nodes/**/*.md']) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceRoot, pattern),
            );
            watcher.onDidChange(() => void this.send(), null, this.disposables);
            watcher.onDidCreate(() => void this.send(), null, this.disposables);
            watcher.onDidDelete(() => void this.send(), null, this.disposables);
            this.disposables.push(watcher);
        }
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
        build: () => this.run(BUILD_COMMAND),
        preview: () => this.run('speckit.companion.previewPipelineBuild'),

        openConfig: async () => {
            const file = path.join(this.workspaceRoot, COMPANION_CONFIG_REL);
            if (!fs.existsSync(file)) {
                this.say('This project has no companion.yml yet — the pipeline runs the shipped default.');
                return;
            }
            await vscode.window.showTextDocument(vscode.Uri.file(file));
        },

        openNode: async message => {
            const node = this.nodeSource(message.command, message.nodeId);
            if (node) {
                await vscode.window.showTextDocument(vscode.Uri.file(node));
                return;
            }
            await this.openInBuiltCommand(message.command, message.nodeId);
        },

        readNode: async message => {
            await this.sendBody(message.command, message.nodeId);
        },

        readFrame: async message => {
            await this.sendBody(message.command, '_frame');
        },

        /**
         * Save edited instructions, which is what makes the node yours.
         *
         * There is no separate "make it mine" step any more. Editing a shipped
         * node writes the project's own copy of it; the act and the consequence
         * are the same thing, rather than a button you had to press first and a
         * file you then had to find. The shipped sources are never touched.
         */
        saveNode: async message => {
            const source = this.nodeSource(message.command, message.nodeId);
            if (!source) {
                this.say(`Cannot find ${message.nodeId} to save over.`);
                return;
            }
            // The metadata is the build's — id, kind, reads, writes — so it is
            // carried across rather than left to the edit to reproduce.
            const { meta } = readableNode(fs.readFileSync(source, 'utf8'));
            const own = this.projectNodePath(message.command, message.nodeId);
            fs.mkdirSync(path.dirname(own), { recursive: true });
            fs.writeFileSync(own, nodeFile(meta, message.body), 'utf8');
            await this.send();
            await this.sendBody(message.command, message.nodeId);
        },

        // One write, not two. The order says when a node runs and the phase says
        // where it sits, and each is validated against the other as it currently
        // stands — so whichever went first was refused for disagreeing with the
        // half that had not moved yet, and the whole gesture failed with the file
        // untouched. Sending both lets the writer check the pair it is given.
        addNode: async message => {
            await this.write(
                script => writePhases(
                    script, this.workspaceRoot, message.command, message.phases,
                    undefined, message.order),
                'Adding a node');
        },

        useVariant: async message => {
            await this.write(
                script => writePhases(
                    script, this.workspaceRoot, message.command, message.phases,
                    // A node id is a hook anchor. Swapping the node renames it,
                    // and a hook left on the old id is warned about and skipped
                    // — so work attached to the block you replaced would quietly
                    // stop running. The carry a phase rename already does.
                    { from: message.replaces, to: message.variant },
                    message.order),
                'Replacing the block');
        },

        setTemplateSection: async message => {
            await this.write(
                script => writeTemplateSection(
                    script, this.workspaceRoot, message.command,
                    message.heading, message.fragment),
                'Changing the template');
        },

        replaceStep: async message => {
            const step = `${message.command}-ours`;
            const own = this.projectNodePath(message.command, step);
            if (!fs.existsSync(own)) {
                // Seeded from what the step says today, because "use theirs
                // instead" almost always means "adapt from ours".
                const seed = this.stepInstructions(message.command);
                fs.mkdirSync(path.dirname(own), { recursive: true });
                fs.writeFileSync(own, seed, 'utf8');
            }
            const written = await this.write(
                script => writePhases(script, this.workspaceRoot, message.command,
                    [{ name: `our ${message.command}`, nodes: [step] }],
                    undefined, [step]),
                'Replacing the step');
            if (!written) { return; }
            await vscode.window.showTextDocument(vscode.Uri.file(own));
        },

        /**
         * Give a node back to the shipped one.
         *
         * Only meaningful when there IS a shipped one. Every node the project
         * wrote is marked `replaced`, which included the single document a step
         * was handed to — so the panel offered "use the shipped node" on a node
         * that exists nowhere else, deleted the only copy, and left the
         * configuration ordering a file that was gone. The pipeline then read as
         * broken, with no way back from inside the panel.
         *
         * Reverting a whole step is a different action: it puts the order and
         * the grouping back as well, which is what `restoreStep` does.
         */
        restoreNode: async message => {
            const own = this.projectNodePath(message.command, message.nodeId);
            if (!fs.existsSync(own)) { return; }
            if (!this.shippedNodePath(message.command, message.nodeId)) {
                this.say(`${message.nodeId} is not a node Companion ships, so there is `
                    + 'nothing to give it back to. To stop running it, remove it from '
                    + `${message.command}.`);
                return;
            }
            fs.unlinkSync(own);
            await this.send();
        },

        reorderNodes: async message => {
            await this.write(
                script => writeNodeOrder(
                    script, this.workspaceRoot, message.command, message.order),
                'Reordering');
        },

        removeHook: async message => {
            await this.write(
                script => removeHook(script, this.workspaceRoot, message.command,
                    message.when, message.anchor, message.index),
                'Removing a hook');
        },

        setPhases: async message => {
            await this.write(
                script => writePhases(
                    script, this.workspaceRoot, message.command, message.phases,
                    message.renamed),
                'Regrouping the phases');
        },

        addHook: async message => {
            await this.write(script => {
                const draft: HookDraft = {
                    type: message.hookType, when: message.when, anchor: message.anchor,
                    editIndex: message.editIndex,
                };
                if (message.hookType === 'skill' || message.hookType === 'node') {
                    draft.ref = message.value;
                    if (message.note) { draft.text = message.note; }
                } else if (message.hookType === 'command') {
                    draft.run = message.value;
                } else {
                    draft.text = message.value;
                }
                return writeHook(script, this.workspaceRoot, message.command, draft);
            }, 'Attaching work');
        },

        selectWorkflow: async message => {
            await this.write(
                script => writeWorkflow(script, this.workspaceRoot, message.name),
                'Switching workflows');
        },

        repair: async message => {
            // Not routed through `write`: that resolves the writer, and a repair
            // runs its own script. The shape it reports back is the same.
            const script = resolveConfigRepairScript(
                this.workspaceRoot, this.context.extensionPath);
            if (!script) {
                this.say('Repairing needs the companion spec-kit extension.');
                return;
            }
            const refused = await applyRepair(script, this.workspaceRoot, message.repairId);
            await this.send();
            if (refused) { this.say(refused); }
        },

        newStep: async message => {
            const made = await this.write(
                script => createStep(script, this.workspaceRoot, message.name,
                    message.label, message.after, message.writes),
                'Adding a step');
            if (!made) { return; }
            // Its one authoring node is the thing to edit, and it is seeded with
            // a placeholder — opening it is what makes the new step real rather
            // than a column saying nothing.
            await vscode.window.showTextDocument(vscode.Uri.file(path.join(
                this.workspaceRoot, PROJECT_NODES_REL, message.name,
                `${message.name}-work.md`)));
        },

        /**
         * Stop running a node, keeping the file.
         *
         * The order and the grouping move together, the way adding one does —
         * a node in the order with no phase is a pipeline that contradicts
         * itself. Nothing is deleted, so it stays on offer under "Add node".
         */
        removeNode: async message => {
            const before = await this.stepShape(message.command);
            const ok = await this.write(
                script => writePhases(
                    script, this.workspaceRoot, message.command, message.phases,
                    undefined, message.order),
                'Removing a node',
                {
                    tone: 'done',
                    text: `${message.nodeId} no longer runs in ${message.command}`,
                    detail: 'Build to apply',
                    undo: { token: `remove:${message.command}:${message.nodeId}` },
                });
            if (ok && before) {
                this.offerUndo(`remove:${message.command}:${message.nodeId}`, async () => {
                    await this.write(
                        script => writePhases(
                            script, this.workspaceRoot, message.command, before.phases,
                            undefined, before.order),
                        'Putting the node back');
                });
            }
        },

        /** Move a node without dragging it — the only route there was a mouse. */
        moveNode: async message => {
            await this.write(
                script => writePhases(
                    script, this.workspaceRoot, message.command, message.phases,
                    undefined, message.order),
                'Moving a node',
                {
                    tone: 'done',
                    text: `${message.nodeId} moved in ${message.command}`,
                    detail: 'Build to apply',
                });
        },

        /** Read once. The panel does not say it again in this workspace. */
        dismissFirstRun: async () => {
            await this.context.workspaceState.update(FIRST_RUN_SEEN, true);
            await this.send();
        },

        undo: async message => {
            const held = this.pendingUndo;
            if (!held || held.token !== message.token) {
                this.say('That change can no longer be taken back.');
                return;
            }
            this.pendingUndo = null;
            await held.run();
            await this.send();
            this.sayStatus(null);
        },

        newWorkflow: async message => {
            const made = await this.write(
                script => createWorkflow(script, this.workspaceRoot, message.name, message.from),
                'Creating a workflow');
            if (!made) { return; }
            await vscode.window.showTextDocument(vscode.Uri.file(path.join(
                this.workspaceRoot, WORKFLOWS_REL, `${message.name}.yml`)));
        },
    };

    /**
     * Run one configuration write and redraw.
     *
     * Everything the panel changes goes through here so a refusal comes back to
     * the panel as a notice rather than a toast the panel cannot see — this view
     * is meant to run outside VS Code, where there is nothing to show a toast on.
     */
    private async write(
        run: (script: string) => Promise<string | null>,
        what: string,
        status?: PipelineStatus,
    ): Promise<boolean> {
        const script = resolveConfigWriteScript(this.workspaceRoot, this.context.extensionPath);
        if (!script) {
            this.say(`${what} needs the companion spec-kit extension.`);
            return false;
        }
        const refused = await run(script);
        // The file is untouched on a refusal, so redrawing puts the panel back
        // to what is on disk — the drag or the form undoes itself.
        await this.send();
        if (refused) { this.say(refused); return false; }
        if (status) { this.sayStatus(status); }
        return true;
    }

    /**
     * What the last write did, said in the panel.
     *
     * A write that can be taken back registers how, and the status carries the
     * token that finds it. One at a time: the next write replaces it, because an
     * undo of something two changes ago is not an undo any more.
     */
    private sayStatus(status: PipelineStatus | null): void {
        if (!status?.undo) { this.pendingUndo = null; }
        void this.post({ type: 'status', status });
    }

    /** Hold the way back from the last write, until the next one. */
    private offerUndo(token: string, run: () => Promise<void>): void {
        this.pendingUndo = { token, run };
    }

    /**
     * A step's order and grouping as they stand — what an undo puts back.
     *
     * Read before the write rather than reconstructed after it, because the
     * write is the only thing that knows what it changed.
     */
    private async stepShape(command: string): Promise<
        { order: string[]; phases: Array<{ name: string; nodes: string[] }> } | null
    > {
        const script = resolveGraphScript(this.workspaceRoot, this.context.extensionPath);
        if (!script) { return null; }
        const graph = await readPipelineGraph(script, this.workspaceRoot);
        if ('error' in graph) { return null; }
        const step = graph.steps.find(s => s.name === command);
        if (!step) { return null; }
        return {
            order: step.phases.flatMap(p => p.nodes.map(n => n.id)),
            phases: step.phases.map(p => ({ name: p.name, nodes: p.nodes.map(n => n.id) })),
        };
    }

    /** Send one node's instructions — what it says, and what an edit starts from. */
    private async sendBody(command: string, nodeId: string): Promise<void> {
        const file = this.nodeSource(command, nodeId);
        if (!file) { return; }
        const { body, parts, editable } = readableNode(fs.readFileSync(file, 'utf8'));
        await this.post({ type: 'nodeBody', command, nodeId, body, parts, editable });
    }

    /** Tell the panel, not the editor. */
    private say(text: string): void {
        void this.post({ type: 'notice', text });
    }


    /**
     * Everything a step currently tells the assistant, as one document.
     *
     * The frame plus every node's instructions, with the frontmatter and the
     * shared-part fences taken out — what someone replacing the step would
     * otherwise have to assemble by hand from a dozen files.
     */
    private stepInstructions(command: string): string {
        const parts: string[] = [];
        const frame = this.nodeSource(command, '_frame');
        if (frame) {
            const { body } = readableNode(fs.readFileSync(frame, 'utf8'));
            if (body) { parts.push(body); }
        }

        const dir = path.dirname(this.projectNodePath(command, 'x'));
        const shipped = path.join(
            this.context.extensionPath, 'speckit-extension', 'nodes', command);
        const source = fs.existsSync(shipped) ? shipped : dir;
        if (fs.existsSync(source)) {
            for (const file of fs.readdirSync(source).sort()) {
                if (!file.endsWith('.md') || file.startsWith('_')) { continue; }
                const found = this.nodeSource(command, file.slice(0, -3));
                if (!found) { continue; }
                const { body } = readableNode(fs.readFileSync(found, 'utf8'));
                if (body) { parts.push(body); }
            }
        }

        return [
            '---',
            `id: ${command}-ours`,
            `name: ${command} — ours`,
            'kind: author',
            '---',
            '',
            `<!-- This is the whole ${command} step, yours to adapt or replace.`,
            '     What follows is what it says today. -->',
            '',
            parts.join('\n\n'),
            '',
        ].join('\n');
    }

    /** Where this project's own copy of a node lives, whether or not it exists. */
    private projectNodePath(command: string, nodeId: string): string {
        return path.join(this.workspaceRoot, PROJECT_NODES_REL, command, `${nodeId}.md`);
    }

    /**
     * The node file to open: the project's copy, then the installed extension's,
     * then the one bundled in this extension. All three are real places a node
     * can live, and only the first is editable without being overwritten.
     */
    private nodeSource(command: string, nodeId: string): string | undefined {
        const candidates = [
            this.projectNodePath(command, nodeId),
            path.join(this.workspaceRoot, '.specify', 'extensions', 'companion',
                'nodes', command, `${nodeId}.md`),
            path.join(this.context.extensionPath, 'speckit-extension',
                'nodes', command, `${nodeId}.md`),
        ];
        return candidates.find(file => fs.existsSync(file));
    }

    /**
     * Where Companion's own copy of a node lives, if it ships one at all.
     *
     * The project's copy is deliberately not a candidate: this answers "is there
     * something to give this node back TO", and a node the project invented — a
     * step handed to one document, a node someone wrote — has no answer.
     */
    private shippedNodePath(command: string, nodeId: string): string | undefined {
        return [
            path.join(this.workspaceRoot, '.specify', 'extensions', 'companion',
                'nodes', command, `${nodeId}.md`),
            path.join(this.context.extensionPath, 'speckit-extension',
                'nodes', command, `${nodeId}.md`),
        ].find(file => fs.existsSync(file));
    }

    /** Last resort: show the node's region of the body the assistant reads. */
    private async openInBuiltCommand(command: string, nodeId: string): Promise<void> {
        const built = path.join(
            this.workspaceRoot, '.specify', 'extensions', 'companion', 'commands',
            `speckit.companion.${command}.md`,
        );
        if (!fs.existsSync(built)) {
            void vscode.window.showInformationMessage(
                `Build the pipeline to read ${nodeId}'s instructions as the assistant sees them.`,
            );
            return;
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(built));
        const editor = await vscode.window.showTextDocument(doc);
        const marker = doc.getText().indexOf(`speckit-companion:node ${nodeId}`);
        if (marker >= 0) {
            const at = doc.positionAt(marker);
            editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.AtTop);
            editor.selection = new vscode.Selection(at, at);
        }
    }

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
