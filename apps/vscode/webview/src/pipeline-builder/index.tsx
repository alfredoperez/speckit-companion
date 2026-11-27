/**
 * The Workflow Builder webview.
 *
 * Draws the run left to right — the pipeline is a sequence and the layout says
 * so — with `auto` out of the row because it runs the others rather than taking
 * a turn among them. One hue marks everything the project owns. A node opens
 * here rather than in the editor, since the file starts with frontmatter and
 * fences nobody opened it to read.
 */

import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
    ExtensionToBuilderMessage,
    PipelineBuildKind,
    BuildReport,
    HookRunsAnswer,
    PipelineGraph,
    PipelineGraphResult,
    PipelineHook,
    HookWhen,
    PipelineNode,
    PipelineStatus,
    SpecPreset,
    StockWorkflowView,
    isGraphError,
    needsBuild,
} from '../../../src/protocol/pipeline';
import { BuildBar } from './BuildBar';
import { StockBoard } from './StockBoard';
import { PresetsPanel } from './PresetsPanel';
import { SidePanel } from './SidePanel';
import { BrokenPipeline } from './BrokenPipeline';
import {
    Canvas, RemovedRow, hookHome, hooksAt, stockAt, withoutNode as withoutNodeOf,
} from './Canvas';
import { NodeAction, NodePopover } from './NodePopover';
import { Header } from './Header';
import { StatusLine } from './StatusLine';
import { Inspector } from './Inspector';
import { movePlaces, moveTargets, movedToPhase, movedWithin } from './moves';
import { Attachment, boundaryOf } from './AttachForm';
import { AddMode, FRESH_PHASE, HookModal } from './HookModal';
import { DocumentModal } from './DocumentModal';
import { NewWorkflowModal } from './NewWorkflowModal';
import { documentFile, documentNodeId, sectionsOf } from './documentNode';
import { DecisionForm } from './DecisionForm';
import { workflowLabel } from './WorkflowMenu';

declare const acquireVsCodeApi: () => { postMessage: (message: unknown) => void };
const vscode = acquireVsCodeApi();

interface Selection { command: string; nodeId: string }

/** The builder's width at which lanes stack, and a node's details become a sheet. */
const NARROW = 640;
interface Attaching {
    command: string;
    anchor: string;
    /** Which side of the anchor the button that opened this sat on. */
    when?: HookWhen;
    hook?: PipelineHook;
    /** Bumped each time the form opens, so a move inside it keeps it mounted. */
    opened: number;
    /** Which choice opens, and which the first row offers; a hook alone when absent. */
    mode?: AddMode;
    modes?: AddMode[];
    /** The step a new one runs behind, when the opener said. */
    after?: string;
    /** Set when the opener was not a lane, so the title does not name one. */
    title?: string;
}

const ALL_MODES: AddMode[] = ['hook', 'node', 'step'];

/** Only one thing occupies the side column at a time. */
type Side =
    | { kind: 'node'; at: Selection }
    | { kind: 'attach'; at: Attaching }
    | { kind: 'new-workflow' }
    /** The document a step writes, opened from the node that writes it. */
    | { kind: 'document'; command: string; nodeName: string }
    | { kind: 'presets' }
    /** Where one node's verdicts route. `node` is the node that decides. */
    | { kind: 'decision'; command: string; node: string }
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
    return step ? movedWithin(step, at.nodeId, direction) : null;
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
    // A stock project is a different board, not a graph with things missing.
    const [stock, setStock] = useState<StockWorkflowView | null>(null);
    const [specPresets, setSpecPresets] = useState<SpecPreset[]>([]);
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
    // A move is announced once its write answers, never when it is only asked for.
    const [announced, setAnnounced] = useState('');
    // A status answers only a write that went through; a refusal comes as a notice.
    const [wrote, setWrote] = useState(false);
    // The last run's outcome per hook, asked for with every graph.
    const [runs, setRuns] = useState<HookRunsAnswer | null>(null);
    // The node whose details hang beside its card. Not the side column: the two can both be open.
    const [pop, setPop] = useState<Selection | null>(null);
    const [narrow, setNarrow] = useState(() => window.innerWidth <= NARROW);
    // Where the last removed node sat; drawn while the status still offers its undo.
    const [removed, setRemoved] = useState<RemovedRow | null>(null);
    const moving = useRef(false);
    // The form as it was before a keyboard move, put back if the write refuses it.
    const unmoved = useRef<Attaching | null>(null);
    const opens = useRef(0);
    // The workflow switched to from this panel, until a build makes it current.
    const [switchedTo, setSwitchedTo] = useState<string | null>(null);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const message = event.data as ExtensionToBuilderMessage;
            if (message.type === 'graph') {
                setGraph(message.graph);
                setStock(null);
                setBuildState(message.buildState);
                if (message.buildState === 'current') { setSwitchedTo(null); }
                vscode.postMessage({ type: 'readHookRuns' });
            } else if (message.type === 'hookRuns') {
                setRuns(message.answer);
            } else if (message.type === 'stock') {
                setStock(message.view);
                setGraph(null);
            } else if (message.type === 'specPresets') {
                setSpecPresets(message.presets);
            } else if (message.type === 'busy') {
                setBusy(message.busy);
            } else if (message.type === 'notice') {
                setNotice(message.text);
                if (!moving.current) { return; }
                moving.current = false;
                setAnnounced(message.text);
                const before = unmoved.current;
                if (before) {
                    unmoved.current = null;
                    setSide(side => side?.kind === 'attach' && side.at.opened === before.opened
                        ? { kind: 'attach', at: before } : side);
                }
            } else if (message.type === 'status') {
                setStatus(message.status);
                setWrote(true);
                if (moving.current && message.status) {
                    moving.current = false;
                    unmoved.current = null;
                    setAnnounced(message.status.text);
                }
            } else if (message.type === 'buildReport') {
                setReport(message.report);
                // A build that wrote the files answers "Build to apply" for good.
                if (message.report?.ok && !message.report.dryRun) { setStatus(null); }
            } else if (message.type === 'nodeBody') {
                setBody({
                    key: `${message.command}/${message.nodeId}`,
                    body: message.body,
                    parts: message.parts,
                    editable: message.editable,
                });
            }
        };
        const onResize = () => setNarrow(window.innerWidth <= NARROW);
        // Nothing watches the run records, so a run that finished elsewhere is read on return.
        const onReturn = () => {
            if (document.visibilityState !== 'hidden') { vscode.postMessage({ type: 'readHookRuns' }); }
        };
        window.addEventListener('message', onMessage);
        window.addEventListener('resize', onResize);
        window.addEventListener('focus', onReturn);
        document.addEventListener('visibilitychange', onReturn);
        vscode.postMessage({ type: 'ready' });
        return () => {
            window.removeEventListener('message', onMessage);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('focus', onReturn);
            document.removeEventListener('visibilitychange', onReturn);
        };
    }, []);

    // A rebuild that took the node away takes its details with it.
    useEffect(() => {
        if (pop && graph && !isGraphError(graph) && !findNode(graph, pop)) { setPop(null); }
    }, [graph, pop]);

    // And a rebuild that took the document away closes it.
    useEffect(() => {
        if (side?.kind !== 'document' || !graph || isGraphError(graph)) { return; }
        if (!graph.steps.find(s => s.name === side.command)?.template) { setSide(null); }
    }, [graph, side]);

    const presetActions = {
        onPresetSearch: (query: string) => vscode.postMessage({ type: 'presetSearch', query }),
        onPresetAdd: (id: string) => vscode.postMessage({ type: 'presetAdd', id }),
        onPresetUpdate: (id: string) => vscode.postMessage({ type: 'presetUpdate', id }),
        onPresetRemove: (id: string) => vscode.postMessage({ type: 'presetRemove', id }),
    };

    if (stock) {
        return (
            <StockBoard
                view={stock}
                status={status ?? (notice ? { tone: 'warning', text: notice } : null)}
                answer={{ refusal: notice, written: wrote }}
                narrow={narrow}
                onSetHook={flip => {
                    setNotice(null);
                    vscode.postMessage({ type: 'setStockHook', ...flip });
                }}
                onAddHook={add => {
                    setNotice(null);
                    setWrote(false);
                    vscode.postMessage({ type: 'addStockHook', ...add });
                }}
                onUpdateHook={update => {
                    setNotice(null);
                    vscode.postMessage({ type: 'updateStockHook', ...update });
                }}
                onRemoveHook={address => {
                    setNotice(null);
                    vscode.postMessage({ type: 'removeStockHook', ...address });
                }}
                onInstallCompanion={() => vscode.postMessage({ type: 'installCompanion' })}
                onOpenFile={path => vscode.postMessage({ type: 'openStockFile', path })}
                onViewFile={path => vscode.postMessage({ type: 'viewStockFile', path })}
                onOverride={path => vscode.postMessage({ type: 'overrideStockTemplate', path })}
                onRemoveOverride={path => vscode.postMessage({ type: 'removeStockOverride', path })}
                onSelectWorkflow={id => {
                    setNotice(null);
                    vscode.postMessage({ type: 'selectStockWorkflow', id });
                }}
                onRunCommand={command => vscode.postMessage({ type: 'runStockCommand', command })}
                presets={specPresets}
                {...presetActions}
            />
        );
    }

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

    const readNode = (command: string, nodeId: string) => {
        setSide({ kind: 'node', at: { command, nodeId } });
        setNotice(null);
        setBody(null);
        setAnnounced('');
        vscode.postMessage({ type: 'readNode', command, nodeId });
    };
    const openNode = (command: string, nodeId: string) => {
        const closing = pop?.command === command && pop.nodeId === nodeId;
        setPop(closing ? null : { command, nodeId });
        if (!closing) { vscode.postMessage({ type: 'readHookRuns' }); }
        setNotice(null);
        setAnnounced('');
    };

    const popNode = pop ? findNode(graph, pop) : null;
    const popStep = pop ? graph.steps.find(s => s.name === pop.command) : undefined;
    const selected = side?.kind === 'node' ? side.at : null;
    const node = selected ? findNode(graph, selected) : null;
    const selectedStep = selected
        ? graph.steps.find(s => s.name === selected.command) : undefined;
    const key = selected ? `${selected.command}/${selected.nodeId}` : '';
    const attaching = side?.kind === 'attach' ? side.at : null;
    const attachStep = attaching
        ? graph.steps.find(s => s.name === attaching.command) ?? null
        : null;

    const send = (message: unknown) => { setNotice(null); setWrote(false); vscode.postMessage(message); };
    const sendMove = (message: unknown) => {
        moving.current = true;
        setAnnounced('');
        send(message);
    };
    const openAttach = (at: Omit<Attaching, 'opened'>) => {
        setNotice(null);
        setAnnounced('');
        unmoved.current = null;
        opens.current += 1;
        setSide({ kind: 'attach', at: { ...at, opened: opens.current } });
    };
    const editingHook = attaching?.hook;
    const hookBoundary = attachStep && editingHook
        ? boundaryOf(attachStep, editingHook.anchor) : 'node';
    const hookCount = attachStep && editingHook
        ? hooksAt(attachStep, editingHook.anchor, hookBoundary)
            .filter(h => h.when === editingHook.when).length
        : 0;

    // One strip at the foot, whatever it has to say. A refusal is a status with
    // nothing to take back, so it reads in the same place as everything else
    // rather than in a band of its own above the board.
    const line: PipelineStatus | null = status
        ?? (notice ? { tone: 'warning', text: notice } : null);

    /** Every node action, from the popover or the instructions pane, sent one way. */
    const act = (at: Selection, action: NodeAction) => {
        const step = graph.steps.find(s => s.name === at.command);
        if (action === 'open-file') {
            vscode.postMessage({ type: 'openNode', command: at.command, nodeId: at.nodeId });
        } else if (action === 'shipped') {
            vscode.postMessage({ type: 'restoreNode', command: at.command, nodeId: at.nodeId });
        } else if (action === 'up' || action === 'down') {
            const shape = movedNode(graph, at, action);
            if (shape) {
                sendMove({ type: 'moveNode', command: at.command, nodeId: at.nodeId, ...shape });
            }
        } else if (action === 'remove') {
            const shape = withoutNode(graph, at);
            if (!shape) { return; }
            const phase = step?.phases.find(p => p.nodes.some(n => n.id === at.nodeId));
            const index = phase?.nodes.findIndex(n => n.id === at.nodeId) ?? -1;
            setRemoved(phase ? {
                command: at.command, phase: phase.name, index,
                name: phase.nodes[index].name, token: `remove:${at.command}:${at.nodeId}`,
            } : null);
            setPop(null);
            setSide(null);
            send({ type: 'removeNode', command: at.command, nodeId: at.nodeId, ...shape });
        } else if (action.startsWith('phase:')) {
            const phase = action.slice('phase:'.length);
            const shape = step ? movedToPhase(step, at.nodeId, phase) : null;
            if (shape) {
                sendMove({
                    type: 'moveNode', command: at.command, nodeId: at.nodeId, phase, ...shape,
                });
            }
        } else if (action.startsWith('variant:')) {
            const variant = action.slice('variant:'.length);
            const swapped = swapNode(graph, at, variant);
            if (!swapped) { return; }
            const next = { command: at.command, nodeId: variant };
            if (pop) { setPop(next); }
            if (side?.kind === 'node') { setSide({ kind: 'node', at: next }); setBody(null); }
            send({
                type: 'useVariant', command: at.command, replaces: at.nodeId, variant, ...swapped,
            });
        }
    };

    // A modal, a side pane or a bottom sheet covers the foot, so the bar steps aside for it.
    const modalOpen = side?.kind === 'document' || side?.kind === 'new-workflow';
    const paneOpen = Boolean(side && side.kind !== 'attach');
    const sheetOpen = Boolean(attachStep && attaching) || paneOpen || (narrow && Boolean(pop));
    // The bar carries the last write while it is up; the foot line otherwise.
    const barUp = !sheetOpen && needsBuild(buildState);
    const undo = (token: string) => {
        vscode.postMessage({ type: 'undo', token });
        setStatus(null);
    };
    // Matched on the property rather than through a selector, since a step is
    // named by whoever wrote the workflow.
    const showStep = (name: string) => {
        const lane = Array.from(document.querySelectorAll<HTMLElement>('.pb-step'))
            .find(el => el.dataset.step === name);
        if (!lane) { return; }
        // Absent in jsdom, so a test of this path would throw on it.
        lane.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        // Removed and re-added around a layout read, or a second click on a
        // lane already marked plays no pulse at all.
        lane.classList.remove('pb-step--found');
        void lane.offsetWidth;
        lane.classList.add('pb-step--found');
        setTimeout(() => lane.classList.remove('pb-step--found'), 1200);
    };

    const sequence = graph.steps.filter(s => s.inSequence && !s.own).map(s => s.name);
    // The header and the tail append; a lane seam passes the step to its left.
    // One handler, so they cannot drift apart.
    const newStep = (after?: string) => {
        const host = after ?? sequence[sequence.length - 1] ?? graph.steps[0]?.name;
        if (!host) { return; }
        openAttach({
            command: host, anchor: graph.steps.find(s => s.name === host)?.phases[0]?.name ?? host,
            mode: 'step', modes: ['step'], after, title: 'Add a step',
        });
    };
    const addTo = (command: string) => {
        const step = graph.steps.find(s => s.name === command);
        openAttach({
            command, anchor: step?.phases[0]?.name ?? command, when: 'before',
            mode: 'hook', modes: ALL_MODES, after: sequence.includes(command) ? command : undefined,
        });
    };
    const shownRemoved = removed && status?.undo?.token === removed.token ? removed : null;

    return (
        <div class={`builder ${side && side.kind !== 'attach' && !modalOpen ? 'builder--inspecting' : ''}${
            barUp ? ' builder--bar' : ''}`}>
            <Header
                graph={graph}
                buildState={buildState}
                busy={busy}
                onPreview={() => vscode.postMessage({ type: 'preview' })}
                onBuild={() => vscode.postMessage({ type: 'build' })}
                onOpenConfig={() => vscode.postMessage({ type: 'openConfig' })}
                onSelectWorkflow={name => {
                    setSwitchedTo(name);
                    send({ type: 'selectWorkflow', name });
                }}
                onNewWorkflow={() => { setNotice(null); setSide({ kind: 'new-workflow' }); }}
                selectedNotBuilt={switchedTo !== null && switchedTo === graph.workflows.active
                    && needsBuild(buildState)}
                onNewStep={newStep}
                onOpenPresets={() => { setNotice(null); setSide({ kind: 'presets' }); }}
                onDismissFirstRun={() => vscode.postMessage({ type: 'dismissFirstRun' })}
            />
            {!sheetOpen && (
                <BuildBar
                    graph={graph}
                    buildState={buildState}
                    busy={busy}
                    report={report}
                    status={barUp ? status : null}
                    onBuild={() => vscode.postMessage({ type: 'build' })}
                    onPreview={() => vscode.postMessage({ type: 'preview' })}
                    onUndo={undo}
                    onDismissStatus={() => setStatus(null)}
                    onEditHook={(command, hook) => openAttach({ command, anchor: hook.anchor, hook })}
                    onRemoveHook={(command, hook) => send({
                        type: 'removeHook', command,
                        anchor: hook.anchor, when: hook.when, index: hook.index,
                    })}
                    onShowStep={showStep}
                />
            )}
            {line && !(barUp && !notice) && (
                <StatusLine status={barUp ? { tone: 'warning', text: notice! } : line}
                    onUndo={undo}
                    onDismiss={() => { setStatus(null); setNotice(null); }} />
            )}
            <div class="builder-body">
                <Canvas
                    graph={graph}
                    selected={pop ?? selected}
                    runs={runs}
                    onOpenNode={openNode}
                    onReorder={(command, order) =>
                        vscode.postMessage({ type: 'reorderNodes', command, order })}
                    onSetPhases={(command, phases, renamed) =>
                        send({ type: 'setPhases', command, phases, renamed })}
                    onAddNode={(command, nodeId, phase, order, phases) =>
                        send({ type: 'addNode', command, nodeId, phase, order, phases })}
                    onNewStep={newStep}
                    onOpenFrame={command => {
                        setSide({ kind: 'node', at: { command, nodeId: '_frame' } });
                        setNotice(null);
                        setBody(null);
                        vscode.postMessage({ type: 'readFrame', command });
                    }}
                    onEditHook={(command, hook) => openAttach({ command, anchor: hook.anchor, hook })}
                    onAddHook={(command, anchor, when) => openAttach({ command, anchor, when })}
                    onMoveHook={(command, from, to) => {
                        if (moving.current) {
                            setStatus(null);
                            setNotice('The last move is still being written. Drag again once the board redraws.');
                            return;
                        }
                        // An open hook form holds an index this drag may have just changed.
                        if (attaching?.hook) { setSide(null); }
                        sendMove({
                            type: 'moveHook', command,
                            from: { when: from.when, anchor: from.anchor, index: from.index }, to,
                        });
                    }}
                    onRefuse={reason => { setStatus(null); setNotice(reason); }}
                    onAddTo={addTo}
                    adding={attaching && attaching.modes && attaching.modes.length > 1
                        ? attaching.command : null}
                    removed={shownRemoved}
                    onUndo={undo}
                    onOpenDecision={(command, node) => {
                        setNotice(null);
                        setSide({ kind: 'decision', command, node });
                    }}
                />

                {attachStep && attaching && (
                    <HookModal
                        // Per opening: another hook remounts it, a keyboard move keeps focus.
                        key={`${attaching.command}/${attaching.opened}`}
                        step={attachStep}
                        anchor={attaching.anchor}
                        when={attaching.when}
                        choices={graph.choices}
                        editing={attaching.hook ?? null}
                        onCancel={() => setSide(null)}
                        onAttach={(a: Attachment, keepOpen: boolean) => {
                            if (!keepOpen) { setSide(null); }
                            // A new place is one move carrying the edit, never a removal and an addition.
                            if (a.movedFrom) {
                                const old = attaching.hook;
                                // Unedited, the entry travels as written rather than re-rendered as one line.
                                const edited = !old || old.type !== a.hookType
                                    || old.summary !== a.value || old.note !== a.note;
                                sendMove({
                                    type: 'moveHook', command: attaching.command,
                                    from: a.movedFrom,
                                    to: { when: a.when, anchor: a.anchor, boundary: a.boundary },
                                    hook: edited
                                        ? { hookType: a.hookType, value: a.value, note: a.note }
                                        : undefined,
                                });
                                return;
                            }
                            send({
                                type: 'addHook', command: attaching.command, anchor: a.anchor,
                                when: a.when, hookType: a.hookType, value: a.value, note: a.note,
                                editIndex: a.editIndex,
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
                        count={hookCount}
                        announce={announced}
                        answer={{ refusal: notice, written: wrote }}
                        mode={attaching.mode}
                        modes={attaching.modes}
                        title={attaching.title}
                        onAddNode={(phase, nodeId, keepOpen) => {
                            if (!keepOpen) { setSide(null); }
                            const grouping = attachStep.phases.map(p => ({
                                name: p.name, nodes: p.nodes.map(n => n.id),
                            }));
                            const phases = grouping.some(p => p.name === phase)
                                ? grouping.map(p => (p.name === phase
                                    ? { ...p, nodes: [...p.nodes, nodeId] } : p))
                                : [...grouping, { name: phase || FRESH_PHASE, nodes: [nodeId] }];
                            send({
                                type: 'addNode', command: attaching.command, nodeId,
                                phase: phase || FRESH_PHASE,
                                order: phases.flatMap(p => p.nodes), phases,
                            });
                        }}
                        stepForm={{
                            sequence,
                            taken: graph.steps.map(s => s.name),
                            after: attaching.after,
                            autoRuns: graph.steps.some(s => s.name === 'auto') ? sequence : null,
                        }}
                        onNewStep={(step, keepOpen) => {
                            if (!keepOpen) { setSide(null); }
                            send({ type: 'newStep', ...step });
                        }}
                        onMove={editingHook ? (direction: 'up' | 'down') => {
                            const index = editingHook.index + (direction === 'up' ? -1 : 1);
                            // A press while the last move is unanswered would act on an index the file may not have.
                            if (index < 0 || index >= hookCount || moving.current) { return; }
                            unmoved.current = attaching;
                            setSide({
                                kind: 'attach',
                                at: { ...attaching, hook: { ...editingHook, index } },
                            });
                            sendMove({
                                type: 'moveHook', command: attaching.command,
                                from: {
                                    when: editingHook.when, anchor: editingHook.anchor,
                                    index: editingHook.index,
                                },
                                to: {
                                    when: editingHook.when, anchor: editingHook.anchor,
                                    index, boundary: hookBoundary,
                                },
                            });
                        } : undefined}
                    />
                )}

                {side?.kind === 'decision' && (() => {
                    const step = graph.steps.find(s => s.name === side.command);
                    const decision = step?.decisions.find(d => d.node === side.node);
                    if (!step || !decision) { return null; }
                    return (
                        <DecisionForm
                            step={step}
                            decision={decision}
                            // Every step that takes a turn in the run, minus the
                            // one that decides: a verdict cannot skip the step
                            // it was reached in.
                            skippable={graph.steps
                                .filter(s => s.inSequence && s.name !== step.name)
                                .map(s => s.name)}
                            changed={step.changes.decisions}
                            onCancel={() => setSide(null)}
                            onSave={(verdict, folds, warns) => send({
                                type: 'setDecision', command: side.command,
                                node: side.node, verdict, folds, warns,
                            })}
                            onRestore={verdict => send({
                                type: 'restoreDecision', command: side.command,
                                node: side.node, verdict,
                            })}
                        />
                    );
                })()}

                {side?.kind === 'document' && (() => {
                    const step = graph.steps.find(s => s.name === side.command);
                    return step?.template ? (
                        <DocumentModal
                            key={step.name}
                            step={step}
                            nodeName={side.nodeName}
                            fragments={graph.choices.fragments}
                            savesTo={workflowLabel(graph.workflows.active)}
                            narrow={narrow}
                            onCancel={() => setSide(null)}
                            onSave={picks => {
                                setSide(null);
                                picks.forEach(({ heading, fragment }) => send({
                                    type: 'setTemplateSection',
                                    command: side.command, heading, fragment,
                                }));
                            }}
                        />
                    ) : null;
                })()}

                {side?.kind === 'presets' && (
                    <SidePanel label="Spec Kit presets" title="Spec Kit presets"
                        where="Installed under .specify/presets, and what each one replaces."
                        onClose={() => setSide(null)}>
                        <PresetsPanel presets={specPresets}
                            onSearch={presetActions.onPresetSearch}
                            onAdd={presetActions.onPresetAdd}
                            onUpdate={presetActions.onPresetUpdate}
                            onRemove={presetActions.onPresetRemove} />
                    </SidePanel>
                )}

                {side?.kind === 'new-workflow' && (
                    <NewWorkflowModal
                        taken={graph.workflows.available}
                        hasProject={graph.configured}
                        active={graph.workflows.active}
                        presets={graph.choices.presets}
                        onCancel={() => setSide(null)}
                        onCreate={(name, from) => {
                            setSide(null);
                            setSwitchedTo(name);
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
                        onOpenFile={() => act(selected, 'open-file')}
                        onSave={(text: string) => vscode.postMessage({
                            type: 'saveNode', command: selected.command,
                            nodeId: selected.nodeId, body: text,
                        })}
                        onRestore={() => act(selected, 'shipped')}
                        // The step header no longer carries this, so the pane is
                        // the only route to it.
                        onReplaceStep={() => send({
                            type: 'replaceStep', command: selected.command,
                        })}
                        onRemove={() => act(selected, 'remove')}
                        onMove={(direction: 'up' | 'down') => act(selected, direction)}
                        announce={announced}
                        moveTargets={selectedStep && !node.pinned
                            ? moveTargets(selectedStep, selected.nodeId) : []}
                        onMoveToPhase={(phase: string) => act(selected, `phase:${phase}`)}
                        // Opens the form, the way every other route to a hook
                        // does. Posting the message straight from here sent one
                        // with no kind and no value, and the write refused it
                        // with "unknown hook type 'undefined'".
                        onAttach={() => openAttach({
                            command: selected.command, anchor: selected.nodeId,
                        })}
                        onUseVariant={(variantId: string) => act(selected, `variant:${variantId}`)}
                    />
                )}
            </div>
            {pop && popNode && popStep && (
                <NodePopover
                    key={`${pop.command}/${pop.nodeId}`}
                    node={popNode}
                    step={pop.command}
                    runs={runs}
                    hooksIn={hookHome(graph.workflows.active).name}
                    stock={stockAt(popStep, pop.nodeId)}
                    anchorKey={`${pop.command}/${pop.nodeId}`}
                    narrow={narrow}
                    moves={movePlaces(popStep, pop.nodeId)}
                    removeBlocked={withoutNode(graph, pop) ? ''
                        : `The last node ${pop.command} has: a step needs at least one.`}
                    announce={announced}
                    onClose={() => setPop(null)}
                    onEditNode={() => { setPop(null); readNode(pop.command, pop.nodeId); }}
                    onAddHook={() => {
                        setPop(null);
                        openAttach({ command: pop.command, anchor: pop.nodeId });
                    }}
                    onEditHook={hook => {
                        setPop(null);
                        openAttach({ command: pop.command, anchor: hook.anchor, hook });
                    }}
                    onRemoveHook={hook => send({
                        type: 'removeHook', command: pop.command,
                        anchor: hook.anchor, when: hook.when, index: hook.index,
                    })}
                    onAction={action => act(pop, action)}
                    document={popStep.template && documentNodeId(popStep) === pop.nodeId ? {
                        file: documentFile(popStep.template.file),
                        sections: sectionsOf(popStep).length,
                        yours: popStep.template.sections.length,
                    } : null}
                    onOpenDocument={() => {
                        setPop(null);
                        setNotice(null);
                        setSide({ kind: 'document', command: pop.command, nodeName: popNode.name });
                    }}
                />
            )}
        </div>
    );
}

const root = document.getElementById('app-root');
if (root) {
    render(<App />, root);
}
