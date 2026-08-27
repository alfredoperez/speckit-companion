/**
 * The pipeline builder webview.
 *
 * Draws the containment the design settled on — a step is an outlined container,
 * a phase a band inside it, a node a box inside that — because the three levels
 * only mean something if you can see one inside the other. The decision states
 * where its verdicts route in words rather than as crossing wires, which is what
 * the design round concluded after trying it both ways.
 */

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
    ExtensionToBuilderMessage,
    PipelineBuildKind,
    PipelineGraphResult,
    isGraphError,
} from '../../../src/protocol/pipeline';
import { Canvas } from './Canvas';
import { Header } from './Header';

declare const acquireVsCodeApi: () => { postMessage: (message: unknown) => void };
const vscode = acquireVsCodeApi();

function App() {
    const [graph, setGraph] = useState<PipelineGraphResult | null>(null);
    const [buildState, setBuildState] = useState<PipelineBuildKind>('unconfigured');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const message = event.data as ExtensionToBuilderMessage;
            if (message.type === 'graph') {
                setGraph(message.graph);
                setBuildState(message.buildState);
            } else if (message.type === 'busy') {
                setBusy(message.busy);
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

    return (
        <div class="builder">
            <Header
                graph={graph}
                buildState={buildState}
                busy={busy}
                onBuild={() => vscode.postMessage({ type: 'build' })}
                onPreview={() => vscode.postMessage({ type: 'preview' })}
                onOpenConfig={() => vscode.postMessage({ type: 'openConfig' })}
            />
            <Canvas
                graph={graph}
                onOpenNode={(command, nodeId) =>
                    vscode.postMessage({ type: 'openNode', command, nodeId })}
                onReplaceNode={(command, nodeId) =>
                    vscode.postMessage({ type: 'replaceNode', command, nodeId })}
                onRestoreNode={(command, nodeId) =>
                    vscode.postMessage({ type: 'restoreNode', command, nodeId })}
                onReorder={(command, order) =>
                    vscode.postMessage({ type: 'reorderNodes', command, order })}
            />
        </div>
    );
}

const root = document.getElementById('app-root');
if (root) {
    render(<App />, root);
}
