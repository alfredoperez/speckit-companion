/**
 * The canvas: step ⊃ phase ⊃ node, drawn as containment.
 *
 * The three levels only mean anything if you can see one inside the other, so a
 * step is an outlined container, a phase a tinted band within it, and a node a
 * box within that. Steps are linked edge to edge.
 *
 * A decision states where its verdicts route in words. The design round tried
 * drawn wires and they crossed the canvas without saying more than a sentence
 * does.
 */

import { PipelineGraph, PipelineNode, PipelinePhase, PipelineStep } from '../../../src/protocol/pipeline';

const KIND_LABEL: Record<string, string> = {
    investigate: 'INVST',
    author: 'AUTHR',
    gate: 'GATE',
    control: 'CTRL',
};

type NodeAction = (command: string, nodeId: string) => void;

interface Props {
    graph: PipelineGraph;
    onOpenNode: NodeAction;
    /** Take a shipped node over: copy it into the project and open the copy. */
    onReplaceNode: NodeAction;
    /** Drop the project's copy and go back to the shipped node. */
    onRestoreNode: NodeAction;
    /** Save a step's whole node order after a drag. */
    onReorder: (command: string, order: string[]) => void;
    /** Attach work at a boundary — the extension asks what kind. */
    onAddHook: (command: string, anchor: string, when: 'before' | 'after') => void;
}

/**
 * A step's nodes as one flat list, which is what the configuration stores.
 *
 * Phases are drawn as containers but written as nothing: `companion.yml` holds a
 * single ordered list per step, and the phase grouping is the extension's.
 */
function flatOrder(step: PipelineStep): string[] {
    return step.phases.flatMap(phase => phase.nodes.map(n => n.id));
}

/** That list with `moved` taken out and put back before `target`. */
function reordered(order: string[], moved: string, target: string): string[] {
    const without = order.filter(id => id !== moved);
    const at = without.indexOf(target);
    if (at < 0) { return order; }
    return [...without.slice(0, at), moved, ...without.slice(at)];
}

/** Cut at a word boundary, so a chip never ends mid-token. */
function clip(text: string, limit = 48): string {
    if (text.length <= limit) { return text; }
    const cut = text.slice(0, limit);
    const space = cut.lastIndexOf(' ');
    return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function HookChips({ hooks, side }: {
    hooks: PipelineNode['hooks'];
    /** Which edge these attach to, when they are drawn apart from their anchor. */
    side?: 'before' | 'after';
}) {
    if (hooks.length === 0) { return null; }
    return (
        <div class={`pb-hooks ${side ? `pb-hooks--${side}` : ''}`}>
            {hooks.map((hook, i) => (
                <span key={i} class={`pb-hook pb-hook--${hook.type}`} title={hook.summary}>
                    {hook.when} · {hook.type}
                    {hook.summary ? `: ${clip(hook.summary)}` : ''}
                </span>
            ))}
        </div>
    );
}

type NodeActions = Pick<Props, 'onOpenNode' | 'onReplaceNode' | 'onRestoreNode'> & {
    /** Called when a node is dropped onto another within the same phase. */
    onDrop: (moved: string, target: string) => void;
    /** Called for the `+` on a block, with what it attaches to. */
    onAdd: (anchor: string, when: 'before' | 'after') => void;
};

/** The `+` that attaches work at one boundary. */
function AddHere({ anchor, when, onAdd }: {
    anchor: string; when: 'before' | 'after'; onAdd: NodeActions['onAdd'];
}) {
    return (
        <button class="pb-add" title={`Attach a skill, instruction or command ${when} ${anchor}`}
            onClick={() => onAdd(anchor, when)}>
            + {when}
        </button>
    );
}

function Node({ node, step, actions }: {
    node: PipelineNode; step: string; actions: NodeActions;
}) {
    // A before-hook runs before this node, so it is drawn above it. Both used to
    // render in one list underneath, which put "before" after the thing it
    // precedes — the reason a hook was impossible to read off the canvas.
    const before = node.hooks.filter(hook => hook.when === 'before');
    return (
        <div class={`pb-node ${node.replaced ? 'pb-node--replaced' : ''}`}
            draggable
            onDragStart={event => {
                event.dataTransfer?.setData('text/plain', node.id);
                if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; }
                (event.currentTarget as HTMLElement).classList.add('pb-node--dragging');
            }}
            onDragEnd={event =>
                (event.currentTarget as HTMLElement).classList.remove('pb-node--dragging')}
            onDragOver={event => {
                event.preventDefault();
                if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
                (event.currentTarget as HTMLElement).classList.add('pb-node--over');
            }}
            onDragLeave={event =>
                (event.currentTarget as HTMLElement).classList.remove('pb-node--over')}
            onDrop={event => {
                event.preventDefault();
                (event.currentTarget as HTMLElement).classList.remove('pb-node--over');
                const moved = event.dataTransfer?.getData('text/plain');
                if (moved && moved !== node.id) { actions.onDrop(moved, node.id); }
            }}>
            <HookChips hooks={before} side="before" />
            <button class="pb-node-main" onClick={() => actions.onOpenNode(step, node.id)}
                title={node.replaced
                    ? "Open this project's instructions for this node"
                    : 'Open the instructions this node contributes'}>
                <span class="pb-node-name">{node.name}</span>
                <span class="pb-node-meta">
                    <span class="pb-node-id">{node.id}</span>
                    <span class={`pb-kind pb-kind--${node.kind}`}>
                        {KIND_LABEL[node.kind] ?? node.kind}
                    </span>
                    {node.replaced && <span class="pb-own">YOURS</span>}
                    {node.writes.map(file => (
                        <span key={file} class="pb-writes" title="produced by this node">{file}</span>
                    ))}
                </span>
            </button>
            <span class="pb-node-actions">
                <AddHere anchor={node.id} when="before" onAdd={actions.onAdd} />
                {node.replaced ? (
                    <button class="pb-node-action" title="Delete your copy and use the shipped node"
                        onClick={() => actions.onRestoreNode(step, node.id)}>Use shipped</button>
                ) : (
                    <button class="pb-node-action" title="Copy this node into your project and edit it"
                        onClick={() => actions.onReplaceNode(step, node.id)}>Replace</button>
                )}
                <AddHere anchor={node.id} when="after" onAdd={actions.onAdd} />
            </span>
            <HookChips hooks={node.hooks.filter(h => h.when === 'after')} />
        </div>
    );
}

function Phase({ phase, step, actions }: {
    phase: PipelinePhase; step: string; actions: NodeActions;
}) {
    return (
        <div class="pb-phase">
            <div class="pb-phase-head">
                <span class="pb-phase-name">PHASE · {phase.name}</span>
                <HookChips hooks={phase.hooks} />
                <span class="pb-phase-add">
                    <AddHere anchor={phase.name} when="before" onAdd={actions.onAdd} />
                    <AddHere anchor={phase.name} when="after" onAdd={actions.onAdd} />
                </span>
            </div>
            <div class="pb-phase-nodes">
                {phase.nodes.map(node => (
                    <Node key={node.id} node={node} step={step} actions={actions} />
                ))}
            </div>
        </div>
    );
}

function Decisions({ step }: { step: PipelineStep }) {
    if (step.decisions.length === 0) { return null; }
    return (
        <div class="pb-decisions">
            {step.decisions.map(decision => (
                <div key={decision.node} class="pb-decision">
                    <span class="pb-decision-node">{decision.node} decides:</span>
                    <ul class="pb-verdicts">
                        {decision.verdicts.map(verdict => (
                            <li key={verdict.name}>
                                <span class="pb-verdict">{verdict.name}</span>
                                {' → '}
                                {verdict.folds.length
                                    ? `skips ${verdict.folds.join(', ')}`
                                    : verdict.warns
                                        ? 'warns, then runs everything'
                                        : 'runs everything'}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function Step({ step, actions, onReorder, onAddHook }: {
    step: PipelineStep;
    actions: Omit<NodeActions, 'onDrop' | 'onAdd'>;
    onReorder: Props['onReorder'];
    onAddHook: Props['onAddHook'];
}) {
    const bound: NodeActions = {
        ...actions,
        onDrop: (moved, target) =>
            onReorder(step.name, reordered(flatOrder(step), moved, target)),
        onAdd: (anchor, when) => onAddHook(step.name, anchor, when),
    };
    return <StepBody step={step} actions={bound} />;
}

function StepBody({ step, actions }: { step: PipelineStep; actions: NodeActions }) {
    const changed = step.changes.added.length || step.changes.removed.length
        || step.changes.reordered || step.changes.hooks || step.changes.decisions.length
        || step.changes.replaced.length || step.template;
    return (
        <section class={`pb-step ${changed ? 'pb-step--changed' : ''} ${step.inSequence ? '' : 'pb-step--aside'}`}>
            <header class="pb-step-head">
                <h2 class="pb-step-name">{step.name}</h2>
                {!step.inSequence && (
                    <span class="pb-step-aside-note">runs the steps above, hands-off</span>
                )}
                {step.template && (
                    <span class="pb-template" title={
                        step.template.sections.length
                            ? `replaced: ${step.template.sections.join(', ')}`
                            : 'used as it ships'
                    }>
                        {step.template.file}
                        {step.template.sections.length ? ` · § ${step.template.sections.length}` : ''}
                    </span>
                )}
                <span class="pb-step-counts">
                    {step.phases.length} phases ·{' '}
                    {step.phases.reduce((n, phase) => n + phase.nodes.length, 0)} nodes
                </span>
            </header>

            {step.phases.map(phase => (
                <Phase key={phase.name} phase={phase} step={step.name} actions={actions} />
            ))}

            <Decisions step={step} />

            {step.artifacts.length > 0 && (
                <footer class="pb-artifacts">
                    produces {step.artifacts.join(', ')}
                </footer>
            )}
        </section>
    );
}

export function Canvas(
    { graph, onOpenNode, onReplaceNode, onRestoreNode, onReorder, onAddHook }: Props,
) {
    const actions = { onOpenNode, onReplaceNode, onRestoreNode };
    return (
        <main class="pb-canvas">
            {graph.steps.map((step, index) => {
                // The link means "then this runs". It belongs between two steps
                // of the sequence and nowhere else — a line into `auto` would
                // claim a run order that does not exist.
                const next = graph.steps[index + 1];
                return (
                    <div key={step.name} class="pb-chain-item">
                        <Step step={step} actions={actions}
                            onReorder={onReorder} onAddHook={onAddHook} />
                        {step.inSequence && next?.inSequence && (
                            <div class="pb-link" aria-hidden="true" />
                        )}
                    </div>
                );
            })}
        </main>
    );
}
