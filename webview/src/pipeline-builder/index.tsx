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
    BuildReport,
    PipelineGraph,
    PipelineGraphResult,
    PipelineHook,
    HookWhen,
    PipelineNode,
    PipelineStatus,
    isGraphError,
} from '../../../src/protocol/pipeline';
import { BrokenPipeline } from './BrokenPipeline';
import { Canvas, withoutNode as withoutNodeOf } from './Canvas';
import { Header } from './Header';
import { StatusLine } from './StatusLine';
import { Inspector } from './Inspector';
import { AttachForm, NewStepForm, NewWorkflowForm, Attachment } from './AttachForm';
import { TemplateForm } from './TemplateForm';

declare const acquireVsCodeApi: () => { postMessage: (message: unknown) => void };
const vscode = acquireVsCodeApi();

interface Selection { command: string; nodeId: string }
interface Attaching {
    command: string;
    anchor: string;
    /** Which side of the anchor the button that opened this sat on. */
    when?: HookWhen;
    hook?: PipelineHook;
}

/** Only one thing occupies the side column at a time. */
type Side =
    | { kind: 'node'; at: Selection }
    | { kind: 'attach'; at: Attaching }
    | { kind: 'new-workflow' }
    | { kind: 'new-step'; after?: string }
    | { kind: 'template'; command: string }
    | null;

/**
 * The step's order and grouping with one node's id swapped for another's.
 *
 * A variant takes the place of the node it replaces — same phase, same position
 * — so the whole swap is these two lists with one entry changed. Computed here
 * because the panel does not hold the graph; the same shape `addNode` sends.
 */
function swapNode(graph: PipelineGraph, at: Selection, variantId: string) {
    const step = graph.steps.find(s => s.name === at.command);
    if (!step) { return null; }
    const swap = (id: string) => (id === at.nodeId ? variantId : id);
    return {
        order: step.phases.flatMap(p => p.nodes.map(n => swap(n.id))),
        phases: step.phases.map(p => ({
            name: p.name,
            nodes: p.nodes.map(n => swap(n.id)),
        })),
    };
}

/** The step's order and grouping with one node taken out, found by selection. */
function withoutNode(graph: PipelineGraph, at: Selection) {
    const step = graph.steps.find(s => s.name === at.command);
    return step ? withoutNodeOf(step, at.nodeId) : null;
}

/** That shape again, with one node a place earlier or later inside its phase. */
function movedNode(graph: PipelineGraph, at: Selection, direction: 'up' | 'down') {
    const step = graph.steps.find(s => s.name === at.command);
    if (!step) { return null; }
    const phases = step.phases.map(p => ({ name: p.name, nodes: p.nodes.map(n => n.id) }));
    const phase = phases.find(p => p.nodes.includes(at.nodeId));
    if (!phase) { return null; }
    const from = phase.nodes.indexOf(at.nodeId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= phase.nodes.length) { return null; }
    [phase.nodes[from], phase.nodes[to]] = [phase.nodes[to], phase.nodes[from]];
    return { order: phases.flatMap(p => p.nodes), phases };
}

/** Find the selected node in the graph, so the inspector follows a rebuild. */
function findNode(graph: PipelineGraph, at: Selection): PipelineNode | null {
    const step = graph.steps.find(s => s.name === at.command);
    if (!step) { return null; }

    // The frame is the step's own preamble rather than a node in any phase, and
    // it reads in the same panel — so it is described as the node it behaves like.
    if (at.nodeId === '_frame') {
        return {
            id: '_frame',
            name: `${step.name} — the step's own instructions`,
            kind: 'control',
            reads: [], writes: [], mayWrite: [], hooks: [], variants: [],
            pinned: 'the frame always comes first — it is what every node sits under',
            source: step.frame.source,
            replaced: step.frame.replaced,
            // Every step Companion ships has a frame, so a project's copy of one
            // always has something to go back to.
            shipped: !step.own,
        };
    }
    for (const phase of step.phases) {
        const node = phase.nodes.find(n => n.id === at.nodeId);
        if (node) { return node; }
    }
    return null;
}

function App() {
    const [graph, setGraph] = useState<PipelineGraphResult | null>(null);
    const [buildState, setBuildState] = useState<PipelineBuildKind>('unconfigured');
    const [busy, setBusy] = useState(false);
    const [side, setSide] = useState<Side>(null);
    const [notice, setNotice] = useState<string | null>(null);
    // What the last write did, and what a build or preview reported. Both are
    // said in the panel that asked, rather than in a channel somewhere else.
    const [status, setStatus] = useState<PipelineStatus | null>(null);
    const [report, setReport] = useState<BuildReport | null>(null);
    const [body, setBody] = useState<
        { key: string; body: string; parts: string[]; editable: string } | null>(null);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const message = event.data as ExtensionToBuilderMessage;
            if (message.type === 'graph') {
                setGraph(message.graph);
                setBuildState(message.buildState);
            } else if (message.type === 'busy') {
                setBusy(message.busy);
            } else if (message.type === 'notice') {
                setNotice(message.text);
            } else if (message.type === 'status') {
                setStatus(message.status);
            } else if (message.type === 'buildReport') {
                setReport(message.report);
            } else if (message.type === 'nodeBody') {
                setBody({
                    key: `${message.command}/${message.nodeId}`,
                    body: message.body,
                    parts: message.parts,
                    editable: message.editable,
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
            <BrokenPipeline
                error={graph.error}
                repairs={graph.repairs ?? []}
                notice={notice}
                busy={busy}
                onRepair={repairId => vscode.postMessage({ type: 'repair', repairId })}
                onOpenConfig={() => vscode.postMessage({ type: 'openConfig' })}
            />
        );
    }

    const openNode = (command: string, nodeId: string) => {
        setSide({ kind: 'node', at: { command, nodeId } });
        setNotice(null);
        setBody(null);
        vscode.postMessage({ type: 'readNode', command, nodeId });
    };

    const selected = side?.kind === 'node' ? side.at : null;
    const node = selected ? findNode(graph, selected) : null;
    const key = selected ? `${selected.command}/${selected.nodeId}` : '';
    const attaching = side?.kind === 'attach' ? side.at : null;
    const attachStep = attaching
        ? graph.steps.find(s => s.name === attaching.command) ?? null
        : null;

    const send = (message: unknown) => { setNotice(null); vscode.postMessage(message); };

    // One strip at the foot, whatever it has to say. A refusal is a status with
    // nothing to take back, so it reads in the same place as everything else
    // rather than in a band of its own above the board.
    const line: PipelineStatus | null = status
        ?? (notice ? { tone: 'warning', text: notice } : null);

    // The header appends and passes nothing; a lane seam places and passes the
    // step to its left. One handler, so the two cannot drift apart.
    const newStep = (after?: string) => {
        setNotice(null);
        setSide({ kind: 'new-step', after });
    };

    return (
        <div class={`builder ${side ? 'builder--inspecting' : ''}`}>
            <Header
                graph={graph}
                buildState={buildState}
                busy={busy}
                report={report}
                onBuild={() => vscode.postMessage({ type: 'build' })}
                onPreview={() => vscode.postMessage({ type: 'preview' })}
                onOpenConfig={() => vscode.postMessage({ type: 'openConfig' })}
                onSelectWorkflow={name => send({ type: 'selectWorkflow', name })}
                onNewWorkflow={() => { setNotice(null); setSide({ kind: 'new-workflow' }); }}
                onNewStep={newStep}
                // Matched on the property rather than through a selector, since
                // a step is named by whoever wrote the workflow.
                onShowChanged={name => {
                    const lane = Array.from(document.querySelectorAll<HTMLElement>('.pb-step'))
                        .find(el => el.dataset.step === name);
                    if (!lane) { return; }
                    // Absent in jsdom, so a test of this path would throw on it.
                    lane.scrollIntoView?.({
                        behavior: 'smooth', block: 'nearest', inline: 'center',
                    });
                    // Removed and re-added around a layout read, or a second
                    // click on a lane already marked plays no pulse at all.
                    lane.classList.remove('pb-step--found');
                    void lane.offsetWidth;
                    lane.classList.add('pb-step--found');
                    setTimeout(() => lane.classList.remove('pb-step--found'), 1200);
                }}
                onDismissFirstRun={() => vscode.postMessage({ type: 'dismissFirstRun' })}
            />
            {line && (
                <StatusLine status={line}
                    onUndo={token => {
                        vscode.postMessage({ type: 'undo', token });
                        setStatus(null);
                    }}
                    onDismiss={() => { setStatus(null); setNotice(null); }} />
            )}
            <div class="builder-body">
                <Canvas
                    graph={graph}
                    selected={selected}
                    onOpenNode={openNode}
                    onReorder={(command, order) =>
                        vscode.postMessage({ type: 'reorderNodes', command, order })}
                    onSetPhases={(command, phases, renamed) =>
                        send({ type: 'setPhases', command, phases, renamed })}
                    onAddNode={(command, nodeId, phase, order, phases) =>
                        send({ type: 'addNode', command, nodeId, phase, order, phases })}
                    onNewStep={newStep}
                    onRemoveNode={(command, nodeId, order, phases) =>
                        send({ type: 'removeNode', command, nodeId, order, phases })}
                    onOpenFrame={command => {
                        setSide({ kind: 'node', at: { command, nodeId: '_frame' } });
                        setNotice(null);
                        setBody(null);
                        vscode.postMessage({ type: 'readFrame', command });
                    }}
                    onOpenTemplate={command => {
                        setSide({ kind: 'template', command });
                        setNotice(null);
                    }}
                    onEditHook={(command, hook) => {
                        setNotice(null);
                        setSide({ kind: 'attach', at: { command, anchor: hook.anchor, hook } });
                    }}
                    onAddHook={(command, anchor, when) => {
                        setNotice(null);
                        setSide({ kind: 'attach', at: { command, anchor, when } });
                    }}
                />

                {attachStep && attaching && (
                    <AttachForm
                        // Keyed by the hook it is editing so picking a second one
                        // remounts the form. The fields seed from `editing` at
                        // mount, so without this a click on another hook left the
                        // first one's values on screen — while the index it would
                        // save to had already moved to the second. Saving then
                        // wrote one hook's content over another.
                        key={attaching.hook
                            ? `${attaching.command}/${attaching.hook.when}/`
                              + `${attaching.hook.anchor}/${attaching.hook.index}`
                            : `${attaching.command}/new/${attaching.anchor}`}
                        step={attachStep}
                        anchor={attaching.anchor}
                        when={attaching.when}
                        choices={graph.choices}
                        editing={attaching.hook ?? null}
                        onCancel={() => setSide(null)}
                        onAttach={(a: Attachment) => {
                            setSide(null);
                            // A hook moved to another boundary travels as one
                            // message: its index means nothing at the new anchor,
                            // and the two halves sent separately rewrote the same
                            // file at the same time.
                            send({
                                type: 'addHook', command: attaching.command, anchor: a.anchor,
                                when: a.when, hookType: a.hookType, value: a.value, note: a.note,
                                editIndex: a.editIndex, movedFrom: a.movedFrom,
                            });
                        }}
                        onRemove={attaching.hook ? () => {
                            const hook = attaching.hook!;
                            setSide(null);
                            send({
                                type: 'removeHook', command: attaching.command,
                                anchor: hook.anchor, when: hook.when, index: hook.index,
                            });
                        } : undefined}
                    />
                )}

                {side?.kind === 'template' && (() => {
                    const step = graph.steps.find(s => s.name === side.command);
                    return step ? (
                        <TemplateForm
                            step={step}
                            fragments={graph.choices.fragments}
                            onCancel={() => setSide(null)}
                            onPick={(heading, fragment) => send({
                                type: 'setTemplateSection',
                                command: side.command, heading, fragment,
                            })}
                        />
                    ) : null;
                })()}

                {side?.kind === 'new-step' && (
                    <NewStepForm
                        sequence={graph.steps.filter(s => s.inSequence && !s.own)
                            .map(s => s.name)}
                        taken={graph.steps.map(s => s.name)}
                        initialAfter={side.after}
                        onCancel={() => setSide(null)}
                        onCreate={step => {
                            setSide(null);
                            send({ type: 'newStep', ...step });
                        }}
                    />
                )}

                {side?.kind === 'new-workflow' && (
                    <NewWorkflowForm
                        from={graph.workflows.active}
                        taken={graph.workflows.available}
                        presets={graph.choices.presets}
                        onCancel={() => setSide(null)}
                        onCreate={(name, from) => {
                            setSide(null);
                            send({ type: 'newWorkflow', from, name });
                        }}
                    />
                )}
                {node && selected && (
                    <Inspector
                        // Keyed by the node so picking a second one starts a
                        // fresh pane rather than carrying the first one's
                        // half-written edit across to it.
                        key={key}
                        node={node}
                        step={selected.command}
                        body={body?.key === key ? body.body : null}
                        editable={body?.key === key ? body.editable : ''}
                        parts={body?.key === key ? body.parts : []}
                        onClose={() => { setSide(null); setBody(null); }}
                        onOpenFile={() => vscode.postMessage({
                            type: 'openNode', command: selected.command, nodeId: selected.nodeId,
                        })}
                        onSave={(text: string) => vscode.postMessage({
                            type: 'saveNode', command: selected.command,
                            nodeId: selected.nodeId, body: text,
                        })}
                        onRestore={() => vscode.postMessage({
                            type: 'restoreNode', command: selected.command, nodeId: selected.nodeId,
                        })}
                        // The step header no longer carries this, so the pane is
                        // the only route to it.
                        onReplaceStep={() => send({
                            type: 'replaceStep', command: selected.command,
                        })}
                        onRemove={() => {
                            const shape = withoutNode(graph, selected);
                            if (!shape) { return; }
                            setSide(null);
                            send({
                                type: 'removeNode', command: selected.command,
                                nodeId: selected.nodeId, ...shape,
                            });
                        }}
                        onMove={(direction: 'up' | 'down') => {
                            const shape = movedNode(graph, selected, direction);
                            if (!shape) { return; }
                            send({
                                type: 'moveNode', command: selected.command,
                                nodeId: selected.nodeId, ...shape,
                            });
                        }}
                        // Opens the form, the way every other route to a hook
                        // does. Posting the message straight from here sent one
                        // with no kind and no value, and the write refused it
                        // with "unknown hook type 'undefined'".
                        onAttach={() => {
                            setNotice(null);
                            setSide({
                                kind: 'attach',
                                at: { command: selected.command, anchor: selected.nodeId },
                            });
                        }}
                        onUseVariant={(variantId: string) => {
                            const swapped = swapNode(graph, selected, variantId);
                            if (!swapped) { return; }
                            setSide({ kind: 'node', at: { command: selected.command, nodeId: variantId } });
                            setBody(null);
                            send({
                                type: 'useVariant', command: selected.command,
                                replaces: selected.nodeId, variant: variantId,
                                ...swapped,
                            });
                        }}
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
