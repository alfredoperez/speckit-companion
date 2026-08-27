/**
 * The canvas: the run, left to right.
 *
 * The pipeline is a sequence — specify, then plan, then tasks, then implement —
 * and the first version drew it as one tall column, which said nothing about
 * that and cost a long scroll to read. Steps are columns now, in run order,
 * and `auto` sits out of the row because it runs the others rather than taking
 * a turn among them.
 *
 * Two rules carry most of the meaning:
 *
 *   Anything the project owns is marked with one hue and nothing else uses it,
 *   so "what did we change here" is answerable without reading.
 *
 *   A hook is drawn on the side it runs, with a connector into the block it
 *   attaches to. Before sits above with the arrow pointing down into the node;
 *   after sits below with the arrow coming up out of it.
 */

import {
    PipelineDecision,
    PipelineGraph,
    PipelineHook,
    PipelineNode,
    PipelinePhase,
    PipelineStep,
    StockHook,
} from '../../../src/protocol/pipeline';

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
    /** The node whose instructions are open in the inspector, if any. */
    selected?: { command: string; nodeId: string } | null;
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
function clip(text: string, limit = 52): string {
    if (text.length <= limit) { return text; }
    const cut = text.slice(0, limit);
    const space = cut.lastIndexOf(' ');
    return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Drawn, not typed: a glyph borrowed from a font is at the mercy of whatever
// the editor has installed, and reads as a different weight from everything
// around it.

/** A node free to be dragged says so with a handle. */
function GripIcon() {
    return (
        <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" focusable="false">
            <g fill="currentColor">
                <circle cx="2.5" cy="2.5" r="1.1" /><circle cx="7.5" cy="2.5" r="1.1" />
                <circle cx="2.5" cy="7" r="1.1" /><circle cx="7.5" cy="7" r="1.1" />
                <circle cx="2.5" cy="11.5" r="1.1" /><circle cx="7.5" cy="11.5" r="1.1" />
            </g>
        </svg>
    );
}

/** A node something else depends on cannot move, and shows why on hover. */
function PinnedIcon() {
    return (
        <svg width="12" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.4" aria-hidden="true" focusable="false">
            <path d="M5 7V5.2a3 3 0 0 1 6 0V7" />
            <rect x="3.6" y="7" width="8.8" height="6" rx="1" />
        </svg>
    );
}

/** What a hook does, in a word. The type is jargon; this is the verb. */
const HOOK_VERB: Record<string, string> = {
    skill: 'run the skill',
    prompt: 'tell the assistant',
    command: 'run',
    node: 'include',
};

// ── Nodes ───────────────────────────────────────────────

type NodeActions = Pick<Props, 'onOpenNode' | 'onReplaceNode' | 'onRestoreNode'> & {
    onDrop: (moved: string, target: string) => void;
    selected?: Props['selected'];
    step: string;
};

function Hooks({ hooks, side }: { hooks: PipelineHook[]; side: 'before' | 'after' }) {
    if (hooks.length === 0) { return null; }
    return (
        <div class={`pb-hooks pb-hooks--${side}`}>
            <div class="pb-hooks-arm" aria-hidden="true" />
            <ul class="pb-hooks-list">
                {hooks.map((hook, i) => (
                    <li key={i} class="pb-hook" title={hook.summary}>
                        <span class="pb-hook-verb">
                            {HOOK_VERB[hook.type] ?? hook.type}
                        </span>
                        <span class={hook.type === 'prompt' ? 'pb-hook-text' : 'pb-hook-ref'}>
                            {clip(hook.summary)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Node({ node, actions }: { node: PipelineNode; actions: NodeActions }) {
    const before = node.hooks.filter(hook => hook.when === 'before');
    const after = node.hooks.filter(hook => hook.when === 'after');
    const movable = !node.pinned;
    const open = actions.selected?.command === actions.step
        && actions.selected?.nodeId === node.id;

    return (
        <div class="pb-node-group">
            <Hooks hooks={before} side="before" />
            <div
                class={[
                    'pb-node',
                    node.replaced ? 'pb-node--yours' : '',
                    movable ? 'pb-node--movable' : 'pb-node--pinned',
                    open ? 'pb-node--open' : '',
                ].filter(Boolean).join(' ')}
                draggable={movable}
                onDragStart={event => {
                    if (!movable) { event.preventDefault(); return; }
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

                <span class={`pb-grip ${movable ? '' : 'pb-grip--pinned'}`}
                    title={movable
                        ? 'Drag to reorder within this phase'
                        : `Cannot be reordered — ${node.pinned}. You can still rewrite it, `
                          + 'attach work to it, or drop it from companion.yml.'}>
                    {movable ? <GripIcon /> : <PinnedIcon />}
                </span>

                <button class="pb-node-main"
                    onClick={() => actions.onOpenNode(actions.step, node.id)}
                    title={node.replaced
                        ? "Read this project's instructions for this node"
                        : 'Read the instructions this node contributes'}>
                    <span class="pb-node-name">{node.name}</span>
                    {(node.replaced || node.writes.length > 0) && (
                        <span class="pb-node-meta">
                            {node.replaced && <span class="pb-yours">yours</span>}
                            {node.writes.map(file => (
                                <span key={file} class="pb-writes"
                                    title="this node produces it">{file}</span>
                            ))}
                        </span>
                    )}
                </button>

                {node.replaced ? (
                    <button class="pb-node-action"
                        title="Delete your copy and go back to the shipped node"
                        onClick={() => actions.onRestoreNode(actions.step, node.id)}>Undo</button>
                ) : (
                    <button class="pb-node-action"
                        title="Copy this node into your project so you can rewrite it"
                        onClick={() => actions.onReplaceNode(actions.step, node.id)}>Make mine</button>
                )}
            </div>
            <Hooks hooks={after} side="after" />
        </div>
    );
}

// ── Phases ──────────────────────────────────────────────

function Phase({ phase, actions, onAdd }: {
    phase: PipelinePhase;
    actions: NodeActions;
    onAdd: (anchor: string) => void;
}) {
    const before = phase.hooks.filter(hook => hook.when === 'before');
    const after = phase.hooks.filter(hook => hook.when === 'after');
    return (
        <section class="pb-phase">
            <header class="pb-phase-head">
                <h3 class="pb-phase-name">{phase.name}</h3>
                <button class="pb-attach" onClick={() => onAdd(phase.name)}
                    title={`Attach a skill, an instruction or a command in ${phase.name}`}>
                    Attach
                </button>
            </header>
            <Hooks hooks={before} side="before" />
            <div class="pb-phase-nodes">
                {phase.nodes.map(node => (
                    <Node key={node.id} node={node} actions={actions} />
                ))}
            </div>
            <Hooks hooks={after} side="after" />
        </section>
    );
}

/**
 * Hooks the project's spec-kit extensions attach to this step.
 *
 * A second, independent hook system — `.specify/extensions.yml` is spec-kit's
 * own, keyed by lifecycle step. A Companion run fires both, so a panel that
 * drew only ours said nine when the answer was twenty-one. These are not ours
 * to edit, and read as a quieter list because of it.
 */
function StockHooks({ hooks }: { hooks: StockHook[] }) {
    if (hooks.length === 0) { return null; }
    return (
        <div class="pb-stock">
            <span class="pb-stock-label">also fires here, from your spec-kit extensions</span>
            <ul class="pb-stock-list">
                {hooks.map((hook, i) => (
                    <li key={i} class="pb-stock-hook"
                        title={hook.description || `${hook.extension} extension`}>
                        <span class="pb-stock-when">{hook.when}</span>
                        <span class="pb-stock-command">{hook.command}</span>
                        <span class="pb-stock-from">{hook.extension}</span>
                        {hook.optional && <span class="pb-stock-note">asks first</span>}
                        {hook.conditional && <span class="pb-stock-note">only sometimes</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── The decision ────────────────────────────────────────

function Decisions({ decisions }: { decisions: PipelineDecision[] }) {
    if (decisions.length === 0) { return null; }
    return (
        <div class="pb-decisions">
            {decisions.map(decision => (
                <div key={decision.node} class="pb-decision">
                    <span class="pb-decision-node">{decision.node} decides:</span>
                    <ul class="pb-verdicts">
                        {decision.verdicts.map(verdict => (
                            <li key={verdict.name}>
                                <span class="pb-verdict">{verdict.name}</span>
                                <span class="pb-verdict-arrow" aria-hidden="true">→</span>
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

// ── Steps ───────────────────────────────────────────────

function changed(step: PipelineStep): boolean {
    const c = step.changes;
    return Boolean(c.added.length || c.removed.length || c.reordered || c.hooks
        || c.decisions.length || c.replaced.length || step.template?.sections.length);
}

function Step({ step, index, actions, onReorder, onAddHook }: {
    step: PipelineStep;
    index: number;
    actions: Omit<NodeActions, 'onDrop' | 'step'>;
    onReorder: Props['onReorder'];
    onAddHook: Props['onAddHook'];
}) {
    const bound: NodeActions = {
        ...actions,
        step: step.name,
        onDrop: (moved, target) =>
            onReorder(step.name, reordered(flatOrder(step), moved, target)),
    };
    const nodes = step.phases.reduce((n, phase) => n + phase.nodes.length, 0);

    return (
        <section class={`pb-step ${changed(step) ? 'pb-step--changed' : ''}`}>
            <header class="pb-step-head">
                {step.inSequence && <span class="pb-step-index">{index + 1}</span>}
                <h2 class="pb-step-name">{step.name}</h2>
                <span class="pb-step-counts">{nodes} nodes</span>
            </header>

            {step.template && (
                <div class={`pb-template ${step.template.sections.length ? 'pb-template--yours' : ''}`}>
                    <span class="pb-template-file">{step.template.file}</span>
                    {step.template.sections.length > 0 && (
                        <span class="pb-yours"
                            title={`replaced: ${step.template.sections.join(', ')}`}>
                            {step.template.sections.length} section
                            {step.template.sections.length === 1 ? '' : 's'} yours
                        </span>
                    )}
                </div>
            )}

            <div class="pb-step-body">
                {step.phases.map(phase => (
                    <Phase key={phase.name} phase={phase} actions={bound}
                        onAdd={anchor => onAddHook(step.name, anchor, 'before')} />
                ))}
                <Decisions decisions={step.decisions} />
                <StockHooks hooks={step.stockHooks} />
            </div>

            {step.artifacts.length > 0 && (
                <footer class="pb-artifacts">produces {step.artifacts.join(', ')}</footer>
            )}
        </section>
    );
}

// ── The canvas ──────────────────────────────────────────

export function Canvas(
    { graph, onOpenNode, onReplaceNode, onRestoreNode, onReorder, onAddHook, selected }: Props,
) {
    const actions = { onOpenNode, onReplaceNode, onRestoreNode, selected };
    const sequence = graph.steps.filter(step => step.inSequence);
    const aside = graph.steps.filter(step => !step.inSequence);

    return (
        <main class="pb-canvas">
            {aside.map(step => (
                <div key={step.name} class="pb-aside">
                    <span class="pb-aside-name">{step.name}</span>
                    <span class="pb-aside-note">
                        runs the {sequence.length} steps below, hands-off — not a step of its own
                    </span>
                    <span class="pb-aside-counts">
                        {step.phases.reduce((n, p) => n + p.nodes.length, 0)} nodes of its own
                    </span>
                </div>
            ))}

            <div class="pb-run" style={`--pb-steps: ${sequence.length}`}>
                {sequence.map((step, index) => (
                    <Step key={step.name} step={step} index={index} actions={actions}
                        onReorder={onReorder} onAddHook={onAddHook} />
                ))}
            </div>
        </main>
    );
}
