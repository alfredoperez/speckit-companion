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
    /** Attach work at a boundary — the panel asks what kind. */
    onAddHook: (command: string, anchor: string, when: 'before' | 'after') => void;
    /** Open a hook that is already there, so it can be changed or taken out. */
    onEditHook: (command: string, hook: PipelineHook) => void;
    /** Save a step's whole phase grouping after a rename or a move. */
    onSetPhases: (command: string, phases: Array<{ name: string; nodes: string[] }>) => void;
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

/**
 * A shell line by the part that identifies it.
 *
 * `python3 .specify/extensions/companion/scripts/doctor.py --chat` wrapped over
 * three lines and the only distinguishing part was at the end. The script name
 * and its arguments say which command this is; the path says where it lives,
 * which the title still carries.
 */
function shellName(line: string): string {
    const parts = line.trim().split(/\s+/);
    const script = parts.findIndex(p => p.includes('/') || p.endsWith('.py') || p.endsWith('.sh'));
    if (script < 0) { return line; }
    const base = parts[script].split('/').pop() ?? parts[script];
    return [base, ...parts.slice(script + 1)].join(' ');
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
    onAdd: (anchor: string) => void;
    onEditHook: (hook: PipelineHook) => void;
    selected?: Props['selected'];
    step: string;
};

function HookIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M10 2v6a3 3 0 0 1-6 0" />
            <path d="M4 11.5v2" />
        </svg>
    );
}

/**
 * One side's hooks, headed by what they run against.
 *
 * "before draft-spec" said once, then the actions beneath it — rather than
 * repeating the side and the anchor on every chip.
 */
function Hooks({ hooks, side, anchor, onAdd, onEdit }: {
    hooks: PipelineHook[];
    side: 'before' | 'after';
    anchor: string;
    onAdd?: () => void;
    onEdit?: (hook: PipelineHook) => void;
}) {
    if (hooks.length === 0) { return null; }
    return (
        <div class={`pb-hooks pb-hooks--${side}`}>
            <div class="pb-hooks-arm" aria-hidden="true" />
            <div class="pb-hooks-body">
                <p class="pb-hooks-head">
                    <span class="pb-hooks-icon"><HookIcon /></span>
                    {side} <span class="pb-hooks-anchor">{anchor}</span>
                    {onAdd && (
                        <button class="pb-hooks-add" onClick={onAdd}
                            title={`Attach something else ${side} ${anchor}`}>add</button>
                    )}
                </p>
                <ul class="pb-hooks-list">
                    {hooks.map((hook, i) => (
                        <li key={i}>
                            <button class="pb-hook" title={`${hook.summary}\n\nClick to edit`}
                                onClick={() => onEdit?.(hook)}>
                                <span class="pb-hook-verb">
                                    {HOOK_VERB[hook.type] ?? hook.type}
                                </span>
                                <span class={hook.type === 'prompt' ? 'pb-hook-text' : 'pb-hook-ref'}>
                                    {clip(hook.type === 'command'
                                        ? shellName(hook.summary) : hook.summary)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
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
            <Hooks hooks={before} side="before" anchor={node.id}
                onAdd={() => actions.onAdd(node.id)} onEdit={actions.onEditHook} />
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
            <Hooks hooks={after} side="after" anchor={node.id}
                onAdd={() => actions.onAdd(node.id)} onEdit={actions.onEditHook} />
        </div>
    );
}

// ── Phases ──────────────────────────────────────────────

function Phase({ phase, actions, onRename }: {
    phase: PipelinePhase;
    actions: NodeActions;
    onRename: (from: string, to: string) => void;
}) {
    const before = phase.hooks.filter(hook => hook.when === 'before');
    const after = phase.hooks.filter(hook => hook.when === 'after');

    const rename = (event: Event) => {
        const el = event.currentTarget as HTMLElement;
        const next = (el.textContent ?? '').trim();
        if (next && next !== phase.name) { onRename(phase.name, next); }
        else { el.textContent = phase.name; }
    };

    return (
        <section class="pb-phase">
            <header class="pb-phase-head">
                {/* A phase name is the project's to choose — it is also a hook
                    anchor, so renaming it is a real edit, not a label. */}
                <h3 class="pb-phase-name" contentEditable spellcheck={false}
                    title="Rename this phase"
                    onBlur={rename}
                    onKeyDown={event => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            (event.currentTarget as HTMLElement).blur();
                        }
                        if (event.key === 'Escape') {
                            (event.currentTarget as HTMLElement).textContent = phase.name;
                            (event.currentTarget as HTMLElement).blur();
                        }
                    }}>{phase.name}</h3>
                <button class="pb-attach" onClick={() => actions.onAdd(phase.name)}
                    title={`Add a hook in ${phase.name} — a skill, an instruction or a command`}>
                    <HookIcon />
                    Add hook
                </button>
            </header>
            <Hooks hooks={before} side="before" anchor={phase.name}
                onAdd={() => actions.onAdd(phase.name)} onEdit={actions.onEditHook} />
            <div class="pb-phase-nodes">
                {phase.nodes.map(node => (
                    <Node key={node.id} node={node} actions={actions} />
                ))}
            </div>
            <Hooks hooks={after} side="after" anchor={phase.name}
                onAdd={() => actions.onAdd(phase.name)} onEdit={actions.onEditHook} />
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

/** What this project changed about a step, for the mark that says it did. */
function changeSummary(step: PipelineStep): string {
    const c = step.changes;
    const bits: string[] = [];
    if (c.removed.length) { bits.push(`dropped ${c.removed.join(', ')}`); }
    if (c.added.length) { bits.push(`added ${c.added.join(', ')}`); }
    if (c.reordered) { bits.push('reordered'); }
    if (c.hooks) { bits.push(`${c.hooks} hook${c.hooks === 1 ? '' : 's'}`); }
    if (c.replaced.length) { bits.push(`rewrote ${c.replaced.join(', ')}`); }
    if (c.phases.length) { bits.push(`phases named ${c.phases.join(', ')}`); }
    if (step.template?.sections.length) {
        bits.push(`template § ${step.template.sections.join(', ')}`);
    }
    return `You changed this step: ${bits.join(' · ')}`;
}

function changed(step: PipelineStep): boolean {
    const c = step.changes;
    return Boolean(c.added.length || c.removed.length || c.reordered || c.hooks
        || c.decisions.length || c.replaced.length || c.phases.length
        || step.template?.sections.length);
}

function FilesIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.3" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M3.5 2h5l3 3v9h-8z" />
            <path d="M8.5 2v3h3" />
        </svg>
    );
}

function Step({ step, index, actions, onReorder, onAddHook, onEditHook, onSetPhases }: {
    step: PipelineStep;
    index: number;
    actions: Omit<NodeActions, 'onDrop' | 'step' | 'onAdd' | 'onEditHook'>;
    onReorder: Props['onReorder'];
    onAddHook: Props['onAddHook'];
    onEditHook: Props['onEditHook'];
    onSetPhases: Props['onSetPhases'];
}) {
    const grouping = () => step.phases.map(p => ({
        name: p.name, nodes: p.nodes.map(n => n.id),
    }));

    const bound: NodeActions = {
        ...actions,
        step: step.name,
        onDrop: (moved, target) => {
            // Dropping onto a node in another phase moves it between phases, so
            // the grouping and the order change together — writing one without
            // the other would leave a node in a phase the order contradicts.
            const from = step.phases.find(p => p.nodes.some(n => n.id === moved));
            const to = step.phases.find(p => p.nodes.some(n => n.id === target));
            if (from && to && from.name !== to.name) {
                onSetPhases(step.name, grouping().map(phase => {
                    if (phase.name === from.name) {
                        return { ...phase, nodes: phase.nodes.filter(id => id !== moved) };
                    }
                    if (phase.name === to.name) {
                        const at = phase.nodes.indexOf(target);
                        return {
                            ...phase,
                            nodes: [
                                ...phase.nodes.slice(0, at), moved, ...phase.nodes.slice(at),
                            ],
                        };
                    }
                    return phase;
                }));
                return;
            }
            onReorder(step.name, reordered(flatOrder(step), moved, target));
        },
        onAdd: anchor => onAddHook(step.name, anchor, 'before'),
        onEditHook: hook => onEditHook(step.name, hook),
    };
    const nodes = step.phases.reduce((n, phase) => n + phase.nodes.length, 0);

    return (
        <section class={`pb-step ${changed(step) ? 'pb-step--changed' : ''}`}>
            {/* What the step leaves behind sits on its own line, not as a row
                of its own and not at the bottom of a lane you must scroll to. */}
            <header class="pb-step-head">
                {step.inSequence && <span class="pb-step-index">{index + 1}</span>}
                <h2 class="pb-step-name">{step.name}</h2>
                {changed(step) && (
                    <span class="pb-changed-dot" title={changeSummary(step)} aria-label="changed" />
                )}
                <div class="pb-step-produces">
                    {step.artifacts.length > 0 && (
                        <span class="pb-produces"
                            title={`produces ${step.artifacts.join(', ')}`}>
                            <FilesIcon />
                            {step.artifacts.length}
                        </span>
                    )}
                    {/* The template is only news when the project reshaped it.
                        A second file glyph beside the produced-files count read
                        as two of the same thing. */}
                    {step.template && step.template.sections.length > 0 && (
                        <span class="pb-template pb-template--yours"
                            title={`${step.template.file} — you replaced: ${step.template.sections.join(', ')}`}>
                            <span class="pb-yours">{step.template.sections.length} §</span>
                        </span>
                    )}
                </div>
                <span class="pb-step-counts">{nodes} nodes</span>
            </header>

            <div class="pb-step-body">
                {step.phases.map(phase => (
                    <Phase key={phase.name} phase={phase} actions={bound}
                        onRename={(from, to) => onSetPhases(step.name, grouping().map(
                            p => p.name === from ? { ...p, name: to } : p))} />
                ))}
                <Decisions decisions={step.decisions} />
                <StockHooks hooks={step.stockHooks} />
            </div>
        </section>
    );
}

// ── The canvas ──────────────────────────────────────────

export function Canvas(
    { graph, onOpenNode, onReplaceNode, onRestoreNode, onReorder, onAddHook,
        onEditHook, onSetPhases, selected }: Props,
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
                        onReorder={onReorder} onAddHook={onAddHook}
                        onEditHook={onEditHook} onSetPhases={onSetPhases} />
                ))}
            </div>
        </main>
    );
}
