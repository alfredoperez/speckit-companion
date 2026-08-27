/**
 * The pipeline builder webview.
 *
 * Draws the run left to right — the pipeline is a sequence and the layout says
 * so — with `auto` out of the row because it runs the others rather than taking
 * a turn among them. One hue marks everything the project owns. A node opens
 * here rather than in the editor, since the file starts with frontmatter and
 * fences nobody opened it to read.
 */

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
    ExtensionToBuilderMessage,
    PipelineBuildKind,
    PipelineGraph,
    PipelineGraphResult,
    PipelineNode,
    isGraphError,
} from '../../../src/protocol/pipeline';
import { Canvas } from './Canvas';
import { Header } from './Header';
import { Inspector } from './Inspector';

declare const acquireVsCodeApi: () => { postMessage: (message: unknown) => void };
const vscode = acquireVsCodeApi();

interface Selection { command: string; nodeId: string }

/** Find the selected node in the graph, so the inspector follows a rebuild. */
function findNode(graph: PipelineGraph, at: Selection): PipelineNode | null {
    const step = graph.steps.find(s => s.name === at.command);
    for (const phase of step?.phases ?? []) {
        const node = phase.nodes.find(n => n.id === at.nodeId);
        if (node) { return node; }
    }
    return null;
}

function App() {
    const [graph, setGraph] = useState<PipelineGraphResult | null>(null);
    const [buildState, setBuildState] = useState<PipelineBuildKind>('unconfigured');
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<Selection | null>(null);
    const [body, setBody] = useState<{ key: string; body: string; parts: string[] } | null>(null);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const message = event.data as ExtensionToBuilderMessage;
            if (message.type === 'graph') {
                setGraph(message.graph);
                setBuildState(message.buildState);
            } else if (message.type === 'busy') {
                setBusy(message.busy);
            } else if (message.type === 'nodeBody') {
                setBody({
                    key: `${message.command}/${message.nodeId}`,
                    body: message.body,
                    parts: message.parts,
                });
            }
        };
        window.addEventListener('message', onMessage);
        vscode.postMessage({ type: 'ready' });
        return () => window.removeEventListener('message', onMessage);
    }, []);

    if (!graph) {
        return <div class="builder-empty">Reading the pipeline…</div>;
    }

    if (isGraphError(graph)) {
        return (
            <div class="builder-error">
                <h2>The pipeline could not be read</h2>
                <p class="builder-error-detail">{graph.error}</p>
                <p>
                    Nothing has been changed. Fix the configuration and this will refresh
                    on save.
                </p>
                <button class="builder-action" onClick={() => vscode.postMessage({ type: 'openConfig' })}>
                    Open companion.yml
                </button>
            </div>
        );
    }

    const openNode = (command: string, nodeId: string) => {
        setSelected({ command, nodeId });
        setBody(null);
        vscode.postMessage({ type: 'readNode', command, nodeId });
    };

    const node = selected ? findNode(graph, selected) : null;
    const key = selected ? `${selected.command}/${selected.nodeId}` : '';

    return (
        <div class={`builder ${node ? 'builder--inspecting' : ''}`}>
            <Header
                graph={graph}
                buildState={buildState}
                busy={busy}
                onBuild={() => vscode.postMessage({ type: 'build' })}
                onPreview={() => vscode.postMessage({ type: 'preview' })}
                onOpenConfig={() => vscode.postMessage({ type: 'openConfig' })}
                onSelectWorkflow={name => vscode.postMessage({ type: 'selectWorkflow', name })}
                onNewWorkflow={() =>
                    vscode.postMessage({ type: 'newWorkflow', from: graph.workflows.active })}
            />
            <div class="builder-body">
                <Canvas
                    graph={graph}
                    selected={selected}
                    onOpenNode={openNode}
                    onReplaceNode={(command, nodeId) =>
                        vscode.postMessage({ type: 'replaceNode', command, nodeId })}
                    onRestoreNode={(command, nodeId) =>
                        vscode.postMessage({ type: 'restoreNode', command, nodeId })}
                    onReorder={(command, order) =>
                        vscode.postMessage({ type: 'reorderNodes', command, order })}
                    onAddHook={(command, anchor, when) =>
                        vscode.postMessage({ type: 'addHook', command, anchor, when })}
                />
                {node && selected && (
                    <Inspector
                        node={node}
                        step={selected.command}
                        body={body?.key === key ? body.body : null}
                        parts={body?.key === key ? body.parts : []}
                        onClose={() => { setSelected(null); setBody(null); }}
                        onOpenFile={() => vscode.postMessage({
                            type: 'openNode', command: selected.command, nodeId: selected.nodeId,
                        })}
                        onReplace={() => vscode.postMessage({
                            type: 'replaceNode', command: selected.command, nodeId: selected.nodeId,
                        })}
                        onRestore={() => vscode.postMessage({
                            type: 'restoreNode', command: selected.command, nodeId: selected.nodeId,
                        })}
                        onAttach={() => vscode.postMessage({
                            type: 'addHook', command: selected.command,
                            anchor: selected.nodeId, when: 'before',
                        })}
                    />
                )}
            </div>
        </div>
    );
}

const root = document.getElementById('app-root');
if (root) {
    render(<App />, root);
}
