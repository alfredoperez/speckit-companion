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
 *   A hook is drawn under the node it attaches to, one line each, under the
 *   word for the side it runs on. Position was carrying that meaning before,
 *   through connector arms nobody could read.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { Menu } from './Menu';
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
    /** Drop the project's copy and go back to the shipped node. */
    onRestoreNode: NodeAction;
    /** Save a step's whole node order after a drag. */
    onReorder: (command: string, order: string[]) => void;
    /** Attach work at a boundary — the panel asks what kind. */
    onAddHook: (command: string, anchor: string, when: 'before' | 'after') => void;
    /** Open a hook that is already there, so it can be changed or taken out. */
    onEditHook: (command: string, hook: PipelineHook) => void;
    /** Put a node the recipe dropped back into one phase. */
    onAddNode: (
        command: string, nodeId: string, phase: string,
        order: string[], phases: Array<{ name: string; nodes: string[] }>,
    ) => void;
    /** Read a step's own preamble — the text every node in it sits under. */
    onOpenFrame: (command: string) => void;
    /** Hand the whole step to one document of your own. Offered in the side column. */
    onReplaceStep: (command: string) => void;
    /** Open the panel for this step's document shape. */
    onOpenTemplate: (command: string) => void;
    /** Add a step of the project's own to the run. */
    onNewStep: () => void;
    /**
     * Stop running a node. The file stays, so it is still on offer to add back.
     *
     * Order and grouping go together, as they do for adding one.
     */
    onRemoveNode: (
        command: string, nodeId: string,
        order: string[], phases: Array<{ name: string; nodes: string[] }>,
    ) => void;
    /** Move a node without dragging it. */
    onMoveNode: (
        command: string, nodeId: string,
        order: string[], phases: Array<{ name: string; nodes: string[] }>,
    ) => void;
    /** Save a step's whole phase grouping after a rename or a move. */
    onSetPhases: (
        command: string,
        phases: Array<{ name: string; nodes: string[] }>,
        renamed?: { from: string; to: string },
    ) => void;
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

function PlusIcon() {
    return (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false">
            <path d="M8 3.5v9M3.5 8h9" />
        </svg>
    );
}

/** Stop running a node. The file stays, so it is still on offer to add back. */
function TrashIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M3 4h10M6 4V2.5h4V4M5 4l.6 9h4.8L11 4" />
        </svg>
    );
}

/** The mark that opens a hook row, so the kind that follows reads as a label. */
function HookMark() {
    return (
        <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor"
            aria-hidden="true" focusable="false">
            <path d="M4 2.5v11l8-5.5z" />
        </svg>
    );
}

// ── Nodes ───────────────────────────────────────────────

type NodeActions = Pick<Props, 'onOpenNode' | 'onRestoreNode'> & {
    onDrop: (moved: string, target: string) => void;
    onAdd: (anchor: string) => void;
    onEditHook: (hook: PipelineHook) => void;
    /** Stop running one node, with the order and the grouping a drag would send. */
    onRemove: (nodeId: string) => void;
    selected?: Props['selected'];
    step: string;
};

/**
 * One side's hooks, headed by what they run against.
 *
 * "before draft-spec" said once, then the actions beneath it — rather than
 * repeating the side and the anchor on every chip.
 */
/**
 * Every place a hook can attach, whether or not one does.
 *
 * An empty anchor used to render nothing, so the only way to learn that work
 * could be attached somewhere was to hover it. The board showed what a project
 * had done and hid what it could do — and the hooks other spec-kit extensions
 * contribute sat apart from all of it, in a labelled block at the foot of the
 * lane, which read as an unexplained list rather than as part of the run.
 *
 * So every anchor is drawn. A filled one carries its hooks; an empty one is a
 * dotted slot that adds one. Hooks from an installed extension appear as chips
 * in the same place and the same shape as your own, marked as somebody else's
 * and not editable here.
 */
/**
 * Everything attached to one anchor, in one block.
 *
 * Before this, each side got its own block with its own connector arm and its
 * own "before draft-spec" heading, so a node with work on both sides was
 * sandwiched between two boxes and four repetitions of its own name. Position
 * was carrying the before/after meaning and it did not carry it: the arrows
 * were the thing people could not read.
 *
 * So one block, under the anchor it belongs to, with the two sides named in
 * words, and one line per hook — the block under "Mark the spec complete" was
 * about five times the height of the card it hangs from. A row is a mark, the
 * kind, and the hook's own text, cut to the lane; the whole of it is read by
 * opening the hook in the side column.
 */
function Attached({ before, after, stockBefore = [], stockAfter = [], anchor, onEdit }: {
    before: PipelineHook[];
    after: PipelineHook[];
    stockBefore?: StockHook[];
    stockAfter?: StockHook[];
    anchor: string;
    onEdit?: (hook: PipelineHook) => void;
}) {
    const sides: Array<[string, PipelineHook[], StockHook[]]> = [
        ['before', before, stockBefore],
        ['after', after, stockAfter],
    ];
    if (!sides.some(([, ours, theirs]) => ours.length + theirs.length > 0)) { return null; }

    return (
        <div class="pb-attached">
            {sides.map(([side, ours, theirs]) => (
                (ours.length + theirs.length) > 0 && (
                    <div key={side} class="pb-attached-side">
                        <span class="pb-attached-when">{side}</span>
                        <ul class="pb-attached-list">
                            {ours.map((hook, i) => (
                                <li key={`ours-${i}`}>
                                    <button class="pb-hook" title={`${hook.summary}\n\nClick to edit`}
                                        onClick={() => onEdit?.(hook)}>
                                        <HookMark />
                                        <span class="pb-hook-kind">{hook.type}</span>
                                        <span class="pb-hook-dot" aria-hidden="true">·</span>
                                        <span class={hook.type === 'prompt'
                                            ? 'pb-hook-text' : 'pb-hook-ref'}>
                                            {clip(hook.type === 'command'
                                                ? shellName(hook.summary) : hook.summary)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                            {theirs.map((hook, i) => (
                                <li key={`theirs-${i}`}>
                                    {/* Another extension's. Not editable here, but
                                        readable — refusing the click told you
                                        nothing about what it does. */}
                                    <span class="pb-hook pb-hook--stock"
                                        title={`${hook.description || hook.command}\n\n`
                                            + `Registered by the ${hook.extension} extension. `
                                            + 'It runs here, and is not edited in this panel.'
                                            + (hook.conditional ? '\nIt does not run every time.' : '')}>
                                        <HookMark />
                                        <span class="pb-hook-ref">{clip(hook.command)}</span>
                                        {hook.optional && (
                                            <span class="pb-hook-note">asks first</span>
                                        )}
                                        {/* Whose it is, in a word rather than a
                                            hue alone. Only the minority carry
                                            it: a badge on every row is the noise
                                            the one-line row is removing. */}
                                        <span class="pb-hook-ext">ext</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            ))}
        </div>
    );
}

/** The quiet affordance for attaching work where nothing is attached yet. */
function Seam({ side, anchor, onAdd }: {
    side: 'before' | 'after';
    anchor: string;
    onAdd?: () => void;
}) {
    if (!onAdd) { return null; }
    return (
        <button class={`pb-slot pb-slot--${side}`} onClick={onAdd}
            title={`Attach a skill, an instruction or a command ${side} ${anchor}`}>
            <span class="pb-slot-label">{side} {anchor}</span>
        </button>
    );
}

function Node({ node, actions, stock, seams }: {
    node: PipelineNode;
    actions: NodeActions;
    /** Extension hooks that fire at this node's boundary, by side. */
    stock?: { before: StockHook[]; after: StockHook[] };
    /**
     * Which empty seams this node draws.
     *
     * `after <this node>` and `before <the next one>` are two anchors for one
     * gap, and a hook at either lands in the same place — so drawing both put a
     * pair of dashed lines at every join and made the lane look broken. One gap,
     * one seam: a node draws only the seam above it, and only when something
     * precedes it. The phase's own seams cover its two edges.
     */
    seams?: { before: boolean; after: boolean };
}) {
    const before = node.hooks.filter(hook => hook.when === 'before');
    const after = node.hooks.filter(hook => hook.when === 'after');
    const movable = !node.pinned;
    const open = actions.selected?.command === actions.step
        && actions.selected?.nodeId === node.id;

    return (
        <div class="pb-node-group">
            {(seams?.before ?? true) && (
                <Seam side="before" anchor={node.id}
                    onAdd={() => actions.onAdd(node.id)} />
            )}
            <div
                class={[
                    'pb-node',
                    // The tick down the left says what the node does — writes a
                    // file, can stop the run, or neither — so the kind is on the
                    // board rather than only in the pane you have to open.
                    `pb-node--${node.kind}`,
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
                    {(node.replaced || node.writes.length > 0
                        || node.mayWrite.length > 0) && (
                        <span class="pb-node-meta">
                            {node.replaced && <span class="pb-yours">yours</span>}
                            {node.writes.map(file => (
                                <span key={file} class="pb-writes"
                                    title="this node produces it">{file}</span>
                            ))}
                            {/* Produced only sometimes — the size budget can fold
                                these away. Without them the step counted four
                                artifacts while the node writing three of them
                                showed none. */}
                            {node.mayWrite.map(file => (
                                <span key={file} class="pb-writes pb-writes--sometimes"
                                    title="this node produces it at some sizes, and folds it away at others">
                                    {file}
                                </span>
                            ))}
                        </span>
                    )}
                </button>

                {/* Nothing on the card says "make this mine" any more. Clicking
                    it opens the panel where its instructions can be edited, and
                    saving that edit is what makes it yours — so a separate step
                    stood between someone and the thing they came to do. Going
                    back to the shipped node lives in that same panel. */}
                <button class="pb-node-drop"
                    title={`Stop running ${node.name}. The file stays, so it is `
                        + 'still on offer under Add node.'}
                    aria-label={`Stop running ${node.name}`}
                    onClick={() => actions.onRemove(node.id)}><TrashIcon /></button>
            </div>
            <Attached before={before} after={after}
                stockBefore={stock?.before} stockAfter={stock?.after}
                anchor={node.id} onEdit={actions.onEditHook} />
            {(seams?.after ?? true) && (
                <Seam side="after" anchor={node.id} onAdd={() => actions.onAdd(node.id)} />
            )}
        </div>
    );
}

// ── Phases ──────────────────────────────────────────────

/**
 * What can actually be done to a phase.
 *
 * Reordering is deliberately absent. A phase is a contiguous run of the step, so
 * moving one moves its nodes — and across every step this pipeline ships, not one
 * such move survives the `reads:` dependencies: 0 of 18. The up and down arrows
 * that used to sit here could never succeed. They fired, the write was refused,
 * and the panel redrew unchanged, which reads as a dead button.
 *
 * What does work is changing where the boundaries fall — rename, split, merge —
 * and dragging a node from one phase into another.
 */
interface PhaseControls {
    onRename: (from: string, to: string) => void;
    onRemove: (name: string) => void;
    onAddPhaseAfter: (name: string) => void;
    onAddNode: (phase: string, nodeId: string) => void;
    /** Nodes this step could run and is not — the only ones that can be added. */
    dropped: string[];
    /** Which of those are shipped add-ons rather than nodes the recipe took out. */
    addOns: string[];
    /** What each offerable node is, so the picker names it rather than its id. */
    offers: PipelineStep['offers'];
    /** The step this phase belongs to, named when explaining where nodes come from. */
    step: string;
    /**
     * Extension hooks that fire at the step's edges, given to the phase that
     * holds those edges — empty for every phase in between.
     */
    stockBefore?: StockHook[];
    stockAfter?: StockHook[];
    /** A phase needs two nodes to split, since neither half may be empty. */
    canSplit: boolean;
    /** A step needs at least one phase, so the last one cannot be removed. */
    only: boolean;
}

/**
 * What a phase's one resting control offers, in the order it offers it.
 *
 * Every one of these used to be a separate button that was `opacity: 0` until
 * the pointer arrived, so the board showed nothing that could change anything
 * and touch reached none of it. One `+` on the rule, always there, and the
 * five things it can do said in words.
 */
const PHASE_ACTIONS = ['hook', 'node', 'rename', 'split', 'merge'] as const;

const PHASE_LABELS: Record<(typeof PHASE_ACTIONS)[number], string> = {
    hook: 'Add hook',
    node: 'Add node',
    rename: 'Rename phase',
    split: 'Split phase',
    merge: 'Merge into the phase above',
};

function Phase({ phase, actions, controls }: {
    phase: PipelinePhase;
    actions: NodeActions;
    controls: PhaseControls;
}) {
    const { onRename } = controls;
    const before = phase.hooks.filter(hook => hook.when === 'before');
    const after = phase.hooks.filter(hook => hook.when === 'after');
    const name = useRef<HTMLHeadingElement>(null);
    const [picking, setPicking] = useState(false);

    // The node picker is the phase menu's second step, so a click that dismisses
    // the list has to put the trigger back to the menu it opened from.
    useEffect(() => {
        if (!picking) { return undefined; }
        const done = () => setPicking(false);
        document.addEventListener('click', done);
        return () => document.removeEventListener('click', done);
    }, [picking]);

    const rename = (event: Event) => {
        const el = event.currentTarget as HTMLElement;
        const next = (el.textContent ?? '').trim();
        if (next && next !== phase.name) { onRename(phase.name, next); }
        else { el.textContent = phase.name; }
    };

    /** Put the caret in the name on the board rather than in a second field. */
    const startRename = () => {
        const el = name.current;
        if (!el) { return; }
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

    const note: Record<(typeof PHASE_ACTIONS)[number], string> = {
        hook: 'a skill, an instruction or a command',
        node: controls.dropped.length
            ? `${controls.dropped.length} on offer`
            : `every node ${controls.step} has is already in a phase — drag one in `
              + `from another, or write your own at .specify/companion/nodes/${controls.step}/`,
        rename: 'its hooks follow the new name',
        split: controls.canSplit
            ? 'its last node starts a new phase after it'
            : 'one node here, so there is nothing to split off',
        merge: controls.only
            ? 'a step needs at least one phase'
            : 'its nodes go with it',
    };

    const act = (id: string) => {
        if (id === 'hook') { actions.onAdd(phase.name); }
        if (id === 'node' && controls.dropped.length) { setPicking(true); }
        if (id === 'rename') { startRename(); }
        if (id === 'split' && controls.canSplit) { controls.onAddPhaseAfter(phase.name); }
        if (id === 'merge' && !controls.only) { controls.onRemove(phase.name); }
    };

    return (
        <section class="pb-phase">
            <header class="pb-phase-head">
                {/* A phase name is the project's to choose — it is also a hook
                    anchor, so renaming it is a real edit, not a label. */}
                <h3 class="pb-phase-name" contentEditable spellcheck={false}
                    ref={name} role="textbox" aria-label="Phase name"
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
                <span class="pb-phase-rule" aria-hidden="true" />
                {picking ? (
                    <Menu
                        // Keyed apart from the menu it replaces: without it
                        // Preact reuses the instance, and the picker inherits
                        // the closed state the pick that opened it left behind.
                        key="pick"
                        class="pb-phase-add"
                        trigger={<PlusIcon />}
                        caret={false}
                        align="right"
                        defaultOpen
                        label={`Put a node in ${phase.name}`}
                        title={`Put a node in ${phase.name}`}
                        options={controls.dropped.map(id => ({
                            id,
                            // What the node IS, and what it does. The list used
                            // to be bare ids under one sentence about the
                            // category they were in — the same words on every
                            // row, and never what picking one gets you.
                            label: controls.offers[id]?.name || id,
                            note: [
                                controls.offers[id]?.summary,
                                controls.addOns.includes(id)
                                    ? `${controls.step} ships this and does not run it`
                                    : 'removed from this run',
                            ].filter(Boolean).join(' · '),
                        }))}
                        onPick={id => { setPicking(false); controls.onAddNode(phase.name, id); }}
                    />
                ) : (
                    <Menu
                        key="menu"
                        class="pb-phase-add"
                        trigger={<PlusIcon />}
                        caret={false}
                        align="right"
                        label={`Add or change ${phase.name}`}
                        title={`Add or change ${phase.name}`}
                        options={PHASE_ACTIONS.map(id => ({
                            id, label: PHASE_LABELS[id], note: note[id],
                        }))}
                        onPick={act}
                    />
                )}
            </header>
            <Attached before={before} after={after} anchor={phase.name}
                onEdit={actions.onEditHook} />
            <div class="pb-phase-nodes">
                {phase.nodes.map((node, at) => (
                    // An installed extension registers against the step, not a
                    // node — so its hooks land on the step's real edges: the
                    // first node's `before` and the last node's `after`.
                    <Node key={node.id} node={node} actions={actions} stock={{
                        before: controls.stockBefore && at === 0 ? controls.stockBefore : [],
                        after: controls.stockAfter && at === phase.nodes.length - 1
                            ? controls.stockAfter : [],
                    }} seams={{
                        // One seam per gap. The phase's own seams own its edges,
                        // and each node owns the gap above it, so the first
                        // node draws nothing and no node draws below itself.
                        before: at > 0,
                        after: false,
                    }} />
                ))}
            </div>
        </section>
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
        bits.push(`template sections ${step.template.sections.join(', ')}`);
    }
    return `You changed this step: ${bits.join(' · ')}`;
}

function changed(step: PipelineStep): boolean {
    const c = step.changes;
    return Boolean(c.added.length || c.removed.length || c.reordered || c.hooks
        || c.decisions.length || c.replaced.length || c.phases.length
        || step.template?.sections.length);
}

function Step({ step, index, actions, onReorder, onAddHook, onEditHook, onSetPhases,
    onAddNode, onOpenFrame, onRemoveNode, onOpenTemplate }: {
    step: PipelineStep;
    index: number;
    actions: Omit<NodeActions, 'onDrop' | 'step' | 'onAdd' | 'onEditHook' | 'onRemove'>;
    onReorder: Props['onReorder'];
    onAddHook: Props['onAddHook'];
    onEditHook: Props['onEditHook'];
    onSetPhases: Props['onSetPhases'];
    onAddNode: Props['onAddNode'];
    onOpenFrame: Props['onOpenFrame'];
    onRemoveNode: Props['onRemoveNode'];
    onOpenTemplate: Props['onOpenTemplate'];
}) {
    const grouping = () => step.phases.map(p => ({
        name: p.name, nodes: p.nodes.map(n => n.id),
    }));

    /**
     * The grouping as it should be written.
     *
     * Moving the last node out of a phase leaves that phase with nothing in it,
     * and a phase with no nodes renders nothing and cannot be written — so an
     * emptied phase is a removed phase. Writing it empty produced a
     * configuration the panel could not read back.
     */
    const settled = (phases: Array<{ name: string; nodes: string[] }>) =>
        phases.filter(phase => phase.nodes.length > 0);

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
                onSetPhases(step.name, settled(grouping().map(phase => {
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
                })));
                return;
            }
            onReorder(step.name, reordered(flatOrder(step), moved, target));
        },
        onAdd: anchor => onAddHook(step.name, anchor, 'before'),
        onEditHook: hook => onEditHook(step.name, hook),
        // Order and grouping go together here for the same reason they do on a
        // drag: a node in one and not the other is a step contradicting itself.
        onRemove: nodeId => {
            const phases = settled(grouping().map(phase => ({
                ...phase, nodes: phase.nodes.filter(id => id !== nodeId),
            })));
            onRemoveNode(step.name, nodeId, phases.flatMap(p => p.nodes), phases);
        },
    };
    const nodes = step.phases.reduce((n, phase) => n + phase.nodes.length, 0);

    return (
        <section class={`pb-step ${changed(step) ? 'pb-step--changed' : ''}`}>
            {/* What the step leaves behind sits on its own line, not as a row
                of its own and not at the bottom of a lane you must scroll to. */}
            {/* Two rows, because seven things did not fit in one. A lane holds
                300px and the header was cramming an index, a name, a changed
                mark, an artifact count, a template chip and a node count into
                it, so "9 nodes" broke across lines. The step's NAME is what a
                reader scans a board for, so it gets the row to itself and
                everything that describes it drops to a quiet line below — one
                register, one separator, and no glyph a reader has to guess. */}
            <header class="pb-step-head">
                <div class="pb-step-identity">
                    {step.inSequence && <span class="pb-step-index">{index + 1}</span>}
                    <h2 class="pb-step-name">
                        <button class="pb-step-open" onClick={() => onOpenFrame(step.name)}
                            title="Read this step's own instructions — the text every node sits under">
                            {step.name}
                        </button>
                    </h2>
                    {changed(step) && (
                        <span class="pb-changed" title={changeSummary(step)}>changed</span>
                    )}
                </div>
                <div class="pb-step-facts">
                    <span class="pb-step-counts">{nodes} nodes</span>
                    {step.artifacts.length > 0 && (
                        <>
                            <span class="pb-fact-dot" aria-hidden="true">·</span>
                            <span class="pb-produces"
                                title={`produces ${step.artifacts.join(', ')}`}>
                                {step.artifacts.length}
                                {step.artifacts.length === 1 ? ' file' : ' files'}
                            </span>
                        </>
                    )}
                    {/* The document's shape, opened from the step that writes
                        it. Carries the "yours" hue only once a section has been
                        replaced — otherwise it is an offer, not a change. */}
                    {step.template && (step.template.sectionsAvailable.length > 0
                        || step.template.sections.length > 0) && (
                        <>
                            <span class="pb-fact-dot" aria-hidden="true">·</span>
                            <button
                                class={`pb-template${
                                    step.template.sections.length ? ' pb-template--yours' : ''}`}
                                title={step.template.sections.length
                                    ? `${step.template.file} — you replaced: ${step.template.sections.join(', ')}`
                                    : `Change the shape of ${step.template.file}`}
                                onClick={() => onOpenTemplate(step.name)}>
                                {step.template.sections.length ? (
                                    <span class="pb-yours">
                                        template · {step.template.sections.length}
                                    </span>
                                ) : <span>template</span>}
                            </button>
                        </>
                    )}
                </div>
            </header>

            <div class="pb-step-body">
                {step.phases.map((phase, at) => (
                    <Phase key={phase.name} phase={phase} actions={bound}
                        controls={{
                            dropped: step.dropped,
                            addOns: step.addOns,
                            offers: step.offers,
                            step: step.name,
                            stockBefore: at === 0
                                ? step.stockHooks.filter(h => h.when === 'before') : [],
                            stockAfter: at === step.phases.length - 1
                                ? step.stockHooks.filter(h => h.when === 'after') : [],
                            canSplit: phase.nodes.length > 1,
                            only: step.phases.length === 1,
                            // The name is a hook anchor, so the hooks come with it.
                            onRename: (from, to) => onSetPhases(step.name, settled(
                                grouping().map(p => p.name === from ? { ...p, name: to } : p)),
                                { from, to }),
                            // A phase's nodes have to land somewhere: they join
                            // the phase above, or the one below when it is first.
                            onRemove: name => {
                                const phases = grouping();
                                const i = phases.findIndex(p => p.name === name);
                                if (i < 0 || phases.length < 2) { return; }
                                const into = i === 0 ? 1 : i - 1;
                                const next = phases.map((p, k) => k === into
                                    ? {
                                        ...p,
                                        nodes: i === 0
                                            ? [...phases[i].nodes, ...p.nodes]
                                            : [...p.nodes, ...phases[i].nodes],
                                    }
                                    : p);
                                onSetPhases(step.name, next.filter((_, k) => k !== i));
                            },
                            onAddPhaseAfter: name => {
                                const phases = grouping();
                                const i = phases.findIndex(p => p.name === name);
                                const taken = new Set(phases.map(p => p.name));
                                let fresh = 'new phase';
                                for (let n = 2; taken.has(fresh); n += 1) { fresh = `new phase ${n}`; }
                                // Born empty and unwritable, so it takes the
                                // last node of the phase it follows — a phase
                                // with nothing in it cannot be saved.
                                const donor = phases[i];
                                if (donor.nodes.length < 2) { return; }
                                const moved = donor.nodes[donor.nodes.length - 1];
                                const next = phases.map(p => p.name === name
                                    ? { ...p, nodes: p.nodes.slice(0, -1) } : p);
                                next.splice(i + 1, 0, { name: fresh, nodes: [moved] });
                                onSetPhases(step.name, next);
                            },
                            onAddNode: (phaseName, nodeId) => {
                                const phases = grouping().map(p => p.name === phaseName
                                    ? { ...p, nodes: [...p.nodes, nodeId] } : p);
                                onAddNode(step.name, nodeId, phaseName,
                                    phases.flatMap(p => p.nodes), phases);
                            },
                        }} />
                ))}
                <Decisions decisions={step.decisions} />
            </div>
        </section>
    );
}

// ── The canvas ──────────────────────────────────────────

export function Canvas(
    { graph, onOpenNode, onRestoreNode, onReorder, onAddHook,
        onEditHook, onSetPhases, onAddNode, onOpenFrame, onRemoveNode,
        onOpenTemplate, onNewStep, selected }: Props,
) {
    const actions = { onOpenNode, onRestoreNode, selected };
    const sequence = graph.steps.filter(step => step.inSequence);
    const aside = graph.steps.filter(step => !step.inSequence);

    return (
        <main class="pb-canvas">
            <div class="pb-run" style={`--pb-steps: ${sequence.length}`}>
                {sequence.map((step, index) => (
                    <Step key={step.name} step={step} index={index} actions={actions}
                        onReorder={onReorder} onAddHook={onAddHook}
                        onEditHook={onEditHook} onSetPhases={onSetPhases}
                        onAddNode={onAddNode} onOpenFrame={onOpenFrame}
                        onRemoveNode={onRemoveNode}
                        onOpenTemplate={onOpenTemplate} />
                ))}
                {/* The tail of the row: everything that does not take a turn in
                    the run, and the invitation to add something that does. This
                    used to sit as a band ACROSS THE TOP of the board, above the
                    first step — the most prominent place on screen, for the one
                    thing that is not part of the sequence. */}
                <div class="pb-outside">
                    <p class="pb-outside-head">Outside the run</p>
                    {aside.map(step => (
                        <div key={step.name} class="pb-aside">
                            <span class="pb-aside-name">{step.name}</span>
                            <span class="pb-aside-note">
                                {step.own
                                    ? 'yours — launched when you want it'
                                    : `runs the ${sequence.length} steps to its left, `
                                      + 'hands-off'}
                            </span>
                            <span class="pb-aside-counts">
                                {step.phases.reduce((n, p) => n + p.nodes.length, 0)} nodes
                            </span>
                        </div>
                    ))}
                    {/* The set of steps was the one thing the board could show
                        and not change. A review or a verification pass had to
                        hide inside implement, or not exist. */}
                    <button class="pb-add-step" onClick={onNewStep}
                        title="Add a step of your own to the run">
                        <PlusIcon />
                        <span class="pb-add-step-label">Add step</span>
                    </button>
                </div>
            </div>
        </main>
    );
}
