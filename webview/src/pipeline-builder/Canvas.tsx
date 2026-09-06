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
import { changeSummary, changed } from './changes';
import { KIND_LABELS } from './hookKinds';
import {
    HookWhen,
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
    /** Open the panel for this step's document shape. */
    onOpenTemplate: (command: string) => void;
    /** Add a step of the project's own to the run. */
    /** `after` names the step a new one runs behind, when the click said where. */
    onNewStep: (after?: string) => void;
    /**
     * Stop running a node. The file stays, so it is still on offer to add back.
     *
     * Order and grouping go together, as they do for adding one.
     */
    onRemoveNode: (
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

/**
 * A step's order and grouping with one node taken out, or null when it cannot be.
 *
 * A phase emptied by the removal goes with it, since an empty phase cannot be
 * written — and a step whose every phase empties cannot be written at all, so
 * that removal is refused here rather than sent and refused by the writer. The
 * board and the side column both take a node out; deriving this twice is how
 * they came to disagree, and the disagreement was a button that fired, was
 * refused, and redrew the panel unchanged.
 */
export function withoutNode(step: PipelineStep, nodeId: string):
{ order: string[]; phases: Array<{ name: string; nodes: string[] }> } | null {
    const phases = step.phases
        .map(p => ({ name: p.name, nodes: p.nodes.map(n => n.id).filter(id => id !== nodeId) }))
        .filter(p => p.nodes.length > 0);
    if (phases.length === 0) { return null; }
    return { order: phases.flatMap(p => p.nodes), phases };
}

/** Mirrors `WORKFLOWS_REL` / `SHIPPED_WORKFLOW` in build-pipeline.py. */
const WORKFLOWS_REL = '.specify/companion/workflows';
const SHIPPED_WORKFLOW = 'shipped';

/** What build-pipeline.py writes in place of an entry that names no extension. */
const UNNAMED_EXTENSION = 'an extension';

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

/** A last segment that is a file extension rather than the name of a command. */
const SCRIPT_TAIL = /^(sh|bash|zsh|fish|py|js|mjs|cjs|ts|rb|pl|lua|ps1|bat|cmd|exe)$/;

/**
 * A registered command by the part that is not on every one of them.
 *
 * `speckit.git.feature` cut to a lane read `spe…`, which is the prefix every
 * one of them shares; the mark above the row already says which extension. Only
 * a namespaced id is cut at a dot: the tail of a script is its extension, and
 * `sh` names nothing. A path gives itself away, but `build.deploy.sh` does not
 * — it is the tail that has to be judged, not the separators.
 */
function commandTail(command: string): string {
    const id = command.trim();
    if (!/^[\w-]+(\.[\w-]+){2,}$/.test(id)) { return shellName(command); }
    const tail = id.slice(id.lastIndexOf('.') + 1);
    return SCRIPT_TAIL.test(tail) ? shellName(command) : tail;
}

/**
 * What a registered hook is called on its row.
 *
 * `command` and `description` are both optional in `extensions.yml` — the
 * reader coerces a missing one to `""` — and the row has nothing else on it
 * since the kind badge went, so an entry with neither used to render blank.
 * Blank, not just absent: `command` reaches here unstripped, and a row of
 * spaces is as empty to read as no row at all.
 */
function stockName(hook: StockHook): string {
    if (hook.command.trim()) { return commandTail(hook.command); }
    return hook.description.trim() || 'no command';
}

/** A count and its noun, agreeing. */
function count(n: number): string {
    return `${n}${n === 1 ? ' node' : ' nodes'}`;
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

/**
 * SpecKit Companion's mark — the mascot with everything that dies at row size
 * thrown away. The eyes are holes, so the row's own ground shows through them.
 */
function MossIcon() {
    return (
        <svg class="pb-mark pb-mark--moss" width="14" height="14" viewBox="0 0 24 24"
            fill="currentColor" aria-hidden="true" focusable="false">
            <path fill-rule="evenodd" d="M12 21.95Q9.67 23.23 8.4 20.89Q5.75 20.71 5.95 18.06Q3.82 16.48 5.42 14.35Q4.48 11.87 6.97 10.95Q7.53 8.35 10.13 8.92Q12 7.04 13.87 8.92Q16.47 8.35 17.03 10.95Q19.52 11.87 18.58 14.35Q20.18 16.48 18.05 18.06Q18.25 20.71 15.6 20.89Q14.33 23.23 12 21.95ZM7.5 15a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0ZM13.1 15a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0Z" />
            <path d="M12 7.7V4.9" stroke="currentColor" stroke-width="1.9"
                stroke-linecap="round" />
            <path d="M12 5.2C11.2 2.3 8.8 0.8 5.7 1.4C5.3 4.5 8.2 6.1 12 5.2Z" />
            <path d="M12 5.2C12.8 2.3 15.2 0.8 18.3 1.4C18.7 4.5 15.8 6.1 12 5.2Z" />
        </svg>
    );
}

/**
 * Somebody else's extension.
 *
 * The universal mark for a thing that plugs in, and deliberately nobody's
 * logo: a third-party extension is not published by GitHub and putting their
 * mark on it says it is.
 */
function ExtensionIcon() {
    return (
        <svg class="pb-mark pb-mark--extension" width="13" height="13" viewBox="0 0 16 16"
            fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M5.5 3.5a2.5 2.5 0 0 1 5 0V4h2a.5.5 0 0 1 .5.5v2h-.5a2.5 2.5 0 0 0 0 5h.5v2a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h2v-.5z" />
        </svg>
    );
}

/** The mark for spec-kit's own extension, which is GitHub's. */
function GithubIcon() {
    return (
        <svg class="pb-mark pb-mark--github" width="13" height="13" viewBox="0 0 16 16"
            fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38c0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15c0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2c0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
    );
}

// ── Nodes ───────────────────────────────────────────────

type NodeActions = Pick<Props, 'onOpenNode'> & {
    onDrop: (moved: string, target: string) => void;
    onAdd: (anchor: string, when: HookWhen) => void;
    onEditHook: (hook: PipelineHook) => void;
    /** Stop running one node, with the order and the grouping a drag would send. */
    onRemove: (nodeId: string) => void;
    /** Whether taking it out would leave a step that can still be written. */
    canRemove: (nodeId: string) => boolean;
    selected?: Props['selected'];
    step: string;
    /** The file this project's own hooks are written in, as the group is headed. */
    yours: HookHome;
};

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
 * dotted slot that adds one. Hooks an installed extension registered appear in
 * the same place and the same shape as your own, under the mark of whoever
 * registered them, and are still not edited here.
 */

/** Whose a group's hooks are, which is what picks its mark. */
type SourceMark = 'companion' | 'github' | 'extension';

/** Where the hooks at one boundary came from, and which of them it carries. */
type HookSource = {
    /** The file or the extension, as the heading reads it. */
    name: string;
    mark: SourceMark;
    title: string;
    ours: PipelineHook[];
    theirs: StockHook[];
};

/**
 * Whose an extension is.
 *
 * `git` is spec-kit's own — its manifest names `github/spec-kit` — so it is the
 * only one that earns GitHub's mark. Anyone else's extension is not published
 * by GitHub, and carrying their logo would say it is.
 */
function markFor(extension: string): SourceMark {
    if (extension === 'companion') { return 'companion'; }
    return extension === 'git' ? 'github' : 'extension';
}

function sourceMark(mark: SourceMark) {
    if (mark === 'companion') { return <MossIcon />; }
    return mark === 'github' ? <GithubIcon /> : <ExtensionIcon />;
}

/** What heads this project's own hooks: the file holding them, and where it is. */
type HookHome = { name: string; title: string };

/**
 * Which file a project's hooks are in, which is not always `companion.yml`.
 *
 * A project on a named workflow keeps every hook, phase and reorder in that
 * workflow's file; `companion.yml` only says which workflow is active. Heading
 * them `companion.yml` named a file with none of them in it. `shipped` is
 * Companion unchanged and has no file at all.
 */
function hookHome(workflow: string): HookHome {
    if (workflow === SHIPPED_WORKFLOW) {
        return {
            name: 'companion.yml · parked',
            title: 'This project runs the pipeline as it ships, so nothing in '
                + '.specify/companion.yml is running. It is still there — switch back to '
                + 'This project in the header to run it again.',
        };
    }
    const name = workflow ? `${workflow}.yml` : 'companion.yml';
    const where = workflow ? `${WORKFLOWS_REL}/${name}` : '.specify/companion.yml';
    return {
        name,
        title: `Yours, from ${where}. Click a line to change it or remove it.`,
    };
}

/**
 * The hooks at one boundary, split by whoever registered them, in run order.
 *
 * Which half goes on top is the side's to decide, and it is not the same on
 * both: a step runs its extensions' before-hooks *now, before any of the work
 * below* — every node in the step, and so every hook of yours hanging off one —
 * and their after-hooks once its own work is reported. Yours-first everywhere
 * drew `npm test` above `git commit` on a boundary that runs the commit first.
 */
function bySource(
    ours: PipelineHook[], theirs: StockHook[], yours: HookHome, side: HookWhen,
): HookSource[] {
    const groups: HookSource[] = [];
    for (const hook of theirs) {
        const last = groups[groups.length - 1];
        // Only a RUN of one extension becomes a group. Collecting every hook of
        // an extension into one would draw an anchor that interleaves them —
        // git, companion, git — in an order it does not run in, and running top
        // to bottom in the order declared is the whole of the contract.
        if (last && last.theirs[0].extension === hook.extension) {
            last.theirs.push(hook);
            continue;
        }
        const name = hook.extension || UNNAMED_EXTENSION;
        // `the ${name} extension` is right for one that has a name and reads
        // "the an extension extension" for one that has not.
        const by = name === UNNAMED_EXTENSION ? name : `the ${name} extension`;
        groups.push({
            // `via git` rather than `git`: Companion registers a spec-kit
            // extension of its own, so the mark alone put two identical marks
            // side by side on one anchor — one of them editable here and one
            // not. A name is a file you can open; `via` is a thing that runs.
            name: `via ${name}`,
            mark: markFor(hook.extension),
            ours: [], theirs: [hook],
            title: `Registered by ${by} in .specify/extensions.yml. `
                + 'It runs here, and is not edited in this panel.',
        });
    }
    if (ours.length === 0) { return groups; }
    const mine: HookSource = {
        name: yours.name, mark: 'companion', ours, theirs: [], title: yours.title,
    };
    return side === 'before' ? [...groups, mine] : [mine, ...groups];
}

/** One hook of this project's, as a line: which of the four it is, then its value. */
function HookLine({ hook }: { hook: PipelineHook }) {
    return (
        <>
            <span class="pb-hook-kind">{KIND_LABELS[hook.type]}</span>
            <span class={hook.type === 'prompt'
                ? 'pb-hook-name' : 'pb-hook-name pb-hook-name--ref'}>
                {clip(hook.type === 'command' ? shellName(hook.summary) : hook.summary)}
            </span>
        </>
    );
}

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
 * about five times the height of the card it hangs from.
 *
 * Under each side the hooks are grouped by whoever registered them, headed by
 * that source's mark and its name. Whose a hook was used to be a word at the
 * tail of the row, so identity was the last thing read on a line whose first
 * word was `Command` — the mechanism — and whose only other text was
 * `speckit.c…`, the prefix every one of them shares. The mark leads, the source
 * is named once for the group, and the row is left to say the work.
 */
function Attached({ before, after, stockBefore = [], stockAfter = [], anchor, yours, onEdit }: {
    before: PipelineHook[];
    after: PipelineHook[];
    stockBefore?: StockHook[];
    stockAfter?: StockHook[];
    anchor: string;
    /** The file this project's own hooks are in, which heads their group. */
    yours: HookHome;
    onEdit?: (hook: PipelineHook) => void;
}) {
    const sides: Array<[HookWhen, PipelineHook[], StockHook[]]> = [
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
                        {bySource(ours, theirs, yours, side).map((source, at) => (
                            <div key={`${at}-${source.name}`} class="pb-hook-group">
                                <span class="pb-hook-source" title={source.title}>
                                    {sourceMark(source.mark)}
                                    <span class="pb-hook-source-name">{source.name}</span>
                                </span>
                                <ul class="pb-attached-list">
                                    {source.ours.map((hook, i) => (
                                        <li key={`ours-${i}`}>
                                            {hook.parked ? (
                                                // Focusable, because the name clips and the rest of it lives in the tooltip.
                                                <span class="pb-hook pb-hook--parked"
                                                    tabIndex={0}
                                                    title={`${hook.summary}\n\nParked — this `
                                                        + 'project runs the pipeline as it '
                                                        + 'ships, so this does not run.'}
                                                    aria-label={`${hook.summary} — parked, `
                                                        + 'not running while the pipeline is '
                                                        + 'the shipped one'}>
                                                    <HookLine hook={hook} />
                                                    <span class="pb-hook-parked">parked</span>
                                                </span>
                                            ) : (
                                                <button class="pb-hook"
                                                    title={`${hook.summary}\n\nClick to edit`}
                                                    onClick={() => onEdit?.(hook)}>
                                                    <HookLine hook={hook} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                    {source.theirs.map((hook, i) => (
                                        <li key={`theirs-${i}`}>
                                            {/* No kind badge: every one of these is a command. */}
                                            <span class="pb-hook pb-hook--stock"
                                                title={(hook.description.trim()
                                                    ? `${hook.description.trim()}\n\n` : '')
                                                    + (hook.command.trim()
                                                        || 'This entry names no command to run.')
                                                    + (hook.optional
                                                        ? '\nIt asks before it runs.' : '')
                                                    + (hook.conditional
                                                        ? '\nIt does not run every time.' : '')}>
                                                <span class="pb-hook-name pb-hook-name--ref">
                                                    {clip(stockName(hook))}
                                                </span>
                                                {/* The one fact here with a consequence. */}
                                                {hook.optional && (
                                                    <span class="pb-hook-asks">asks first</span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
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
                    onAdd={() => actions.onAdd(node.id, 'before')} />
            )}
            {/* Above the card, because BEFORE is an ordering claim and one
                block under the card made it twice: a phase heading, the card,
                and then a second BEFORE belonging to the card above it. */}
            <Attached before={before} after={[]} stockBefore={stock?.before}
                anchor={node.id} yours={actions.yours} onEdit={actions.onEditHook} />
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

                {/* A padlock read "read-only", and the truth is only "cannot be
                    reordered" — so the grip stays a grip, quieter, and the
                    word in the meta row carries the reason. */}
                <span class={`pb-grip ${movable ? '' : 'pb-grip--pinned'}`}
                    title={movable ? 'Drag to reorder within this phase' : undefined}>
                    <GripIcon />
                </span>

                <button class="pb-node-main"
                    onClick={() => actions.onOpenNode(actions.step, node.id)}
                    title={node.replaced
                        ? "Read this project's instructions for this node"
                        : 'Read the instructions this node contributes'}>
                    <span class="pb-node-name">{node.name}</span>
                    {(node.replaced || node.pinned || node.kind === 'gate'
                        || node.writes.length > 0 || node.mayWrite.length > 0) && (
                        <span class="pb-node-meta">
                            {/* In a word, not a hue: every colour this panel
                                has left already means something else. */}
                            {node.kind === 'gate' && (
                                <span class="pb-node-gate"
                                    title="This node can stop the run">gate</span>
                            )}
                            {!movable && (
                                <span class="pb-held"
                                    title={`Cannot be reordered — ${node.pinned}. `
                                        + 'You can still rewrite it, attach work to it, '
                                        + 'or drop it from companion.yml.'}>held</span>
                            )}
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
                            {node.replaced && <span class="pb-yours">yours</span>}
                        </span>
                    )}
                </button>

                {/* Nothing on the card says "make this mine" any more. Clicking
                    it opens the panel where its instructions can be edited, and
                    saving that edit is what makes it yours — so a separate step
                    stood between someone and the thing they came to do. Going
                    back to the shipped node lives in that same panel. */}
                {/* Absent, not inert, on the last node a step has: taking it out
                    would leave a step with no phases, which cannot be written.
                    A step added through "Add step" ships with exactly one. */}
                {actions.canRemove(node.id) && (
                    <button class="pb-node-drop"
                        title={`Stop running ${node.name}. The file stays, so it is `
                            + 'still on offer under Add node.'}
                        aria-label={`Stop running ${node.name}`}
                        onClick={() => actions.onRemove(node.id)}><TrashIcon /></button>
                )}
            </div>
            <Attached before={[]} after={after} stockAfter={stock?.after}
                anchor={node.id} yours={actions.yours} onEdit={actions.onEditHook} />
            {(seams?.after ?? true) && (
                <Seam side="after" anchor={node.id} onAdd={() => actions.onAdd(node.id, 'after')} />
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
    /** The first phase has nothing above it, so its nodes merge downward. */
    first: boolean;
}

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
        if (!next || next === phase.name) { el.textContent = phase.name; return; }
        onRename(phase.name, next);
        // Put the old name back and let the redraw carry the new one, rather
        // than leaving the typed text standing. A refused write redraws the
        // graph unchanged, and Preact then sees the same vdom text it rendered
        // last time and touches nothing — so the board went on showing a phase
        // name that is not in the configuration, which is the one thing every
        // other refusal in this panel is careful not to do.
        el.textContent = phase.name;
    };

    /** Put the caret in the name on the board rather than in a second field. */
    const startRename = () => {
        const el = name.current;
        if (!el) { return; }
        // After the menu has finished closing, not during it. A menu hands the
        // keyboard back to its trigger on the way out, which is right for every
        // other entry and would take the caret straight back off this one.
        setTimeout(() => {
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        }, 0);
    };

    /**
     * Everything a phase can do, said in the same five words every time.
     *
     * Every one of these used to be a separate button that was `opacity: 0`
     * until the pointer arrived, so the board showed nothing that could change
     * anything and touch reached none of it. One `+` on the rule, always there.
     *
     * A row that cannot run here is shown inert rather than dropped, because
     * the note is what teaches the capability: "one node here, so there is
     * nothing to split off" says a phase can be split at the same moment it
     * says why this one cannot. A dropped row teaches nothing, and a person
     * who never sees Split never learns to look for it.
     */
    const offered = [
        { id: 'hook', label: 'Add hook', note: 'a skill, an instruction or a command' },
        controls.dropped.length
            ? { id: 'node', label: 'Add node', note: `${controls.dropped.length} on offer` }
            : {
                id: 'node', label: 'Add node', disabled: true,
                note: `every node ${controls.step} has is already in a phase — drag one in `
                    + `from another, or write your own at .specify/companion/nodes/${controls.step}/`,
            },
        { id: 'rename', label: 'Rename phase', note: 'its hooks follow the new name' },
        controls.canSplit
            ? {
                id: 'split', label: 'Split phase',
                note: 'its last node starts a new phase after it',
            }
            : {
                id: 'split', label: 'Split phase', disabled: true,
                note: 'one node here, so there is nothing to split off',
            },
        // The first phase has nothing above it, so its nodes go down into the
        // second. The label used to say "above" in both directions.
        controls.only
            ? {
                id: 'merge', label: 'Merge into the phase above', disabled: true,
                note: 'a step needs at least one phase',
            }
            : controls.first
                ? {
                    id: 'merge', label: 'Merge into the phase below',
                    note: 'nothing sits above this one, so its nodes go down',
                }
                : {
                    id: 'merge', label: 'Merge into the phase above',
                    note: 'its nodes go with it',
                },
    ];

    // No guards here: `Menu` will not call this for a row it drew inert.
    const act = (id: string) => {
        if (id === 'hook') { actions.onAdd(phase.name, 'before'); }
        if (id === 'node') { setPicking(true); }
        if (id === 'rename') { startRename(); }
        if (id === 'split') { controls.onAddPhaseAfter(phase.name); }
        if (id === 'merge') { controls.onRemove(phase.name); }
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
                        options={offered}
                        onPick={act}
                    />
                )}
            </header>
            {/* Split the same way a node's are: a phase's `after` hooks run
                after its nodes, so drawing them above the nodes made the
                heading contradict the layout. Neither block is indented, which
                is what separates a phase's from the card-hung ones below. */}
            <Attached before={before} after={[]} anchor={phase.name}
                yours={actions.yours} onEdit={actions.onEditHook} />
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
            <Attached before={[]} after={after} anchor={phase.name}
                yours={actions.yours} onEdit={actions.onEditHook} />
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

/** What a phase this panel invents is called, wherever it invents one. */
const FRESH_PHASE = 'new phase';

/**
 * The way into a step that declares no phase at all.
 *
 * Every control that adds something hangs off a phase header, so a step without
 * one drew its name, `0 nodes`, and no way to change that — a lane you can read
 * and nothing else. A phase is written with the node it holds, since the writer
 * refuses an empty one, so the first phase and the first node are made in one
 * move and the name is editable in place from the moment it exists.
 */
function FirstPhase({ step, onAddNode }: {
    step: PipelineStep;
    onAddNode: Props['onAddNode'];
}) {
    const offered = step.dropped.length
        ? step.dropped.map(id => ({
            id, label: step.offers[id]?.name || id, note: step.offers[id]?.summary,
        }))
        : [{
            id: 'none', label: 'Nothing to put in it yet', disabled: true,
            note: `${step.name} runs no node — write one at `
                + `.specify/companion/nodes/${step.name}/ and it is offered here`,
        }];

    return (
        <Menu
            class="pb-first-phase-add"
            caret={false}
            trigger={<>
                <PlusIcon />
                <span class="pb-add-step-label">Add the first phase</span>
            </>}
            title={`Add the first phase to ${step.name}`}
            options={offered}
            onPick={id => onAddNode(step.name, id, FRESH_PHASE, [id],
                [{ name: FRESH_PHASE, nodes: [id] }])} />
    );
}

function Step({ step, index, actions, onReorder, onAddHook, onEditHook, onSetPhases,
    onAddNode, onOpenFrame, onRemoveNode, onOpenTemplate }: {
    step: PipelineStep;
    index: number;
    actions: Omit<NodeActions,
        'onDrop' | 'step' | 'onAdd' | 'onEditHook' | 'onRemove' | 'canRemove'>;
    onReorder: Props['onReorder'];
    onAddHook: Props['onAddHook'];
    onEditHook: Props['onEditHook'];
    onSetPhases: Props['onSetPhases'];
    onAddNode: Props['onAddNode'];
    onOpenFrame: Props['onOpenFrame'];
    onRemoveNode: Props['onRemoveNode'];
    onOpenTemplate: Props['onOpenTemplate'];
}) {
    const [showChanges, setShowChanges] = useState(false);
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
        onAdd: (anchor, when) => onAddHook(step.name, anchor, when),
        onEditHook: hook => onEditHook(step.name, hook),
        onRemove: nodeId => {
            const shape = withoutNode(step, nodeId);
            if (!shape) { return; }
            onRemoveNode(step.name, nodeId, shape.order, shape.phases);
        },
        canRemove: nodeId => withoutNode(step, nodeId) !== null,
    };
    const nodes = step.phases.reduce((n, phase) => n + phase.nodes.length, 0);

    return (
        <section class={`pb-step ${changed(step) ? 'pb-step--changed' : ''}`}
            data-step={step.name}>
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
                </div>
                <div class="pb-step-facts">
                    <span class="pb-step-counts">{count(nodes)}</span>
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
                        it — and the only door to the whole template feature, so
                        it is a chip rather than a grey word set exactly like the
                        node count beside it. The count carries the review ink
                        once a section has been replaced; the chip itself is an
                        offer, not a change. */}
                    {step.template && (step.template.sectionsAvailable.length > 0
                        || step.template.sections.length > 0) && (
                        <button class="pb-template"
                            title={step.template.sections.length
                                ? `${step.template.file} — you replaced: ${step.template.sections.join(', ')}`
                                : `Change the shape of ${step.template.file}`}
                            onClick={() => onOpenTemplate(step.name)}>
                            <span class="pb-template-name">Document shape</span>
                            {step.template.sections.length > 0 && (
                                <>
                                    <span class="pb-fact-dot" aria-hidden="true">·</span>
                                    <span class="pb-template-count">
                                        {step.template.sections.length}
                                    </span>
                                </>
                            )}
                            <span class="pb-template-caret" aria-hidden="true">▸</span>
                        </button>
                    )}
                </div>
                {/* What changed, on the step it changed. It was a word with the
                    facts in a `title`, which is a fact nobody reads and nothing
                    a touch screen can reach. */}
                {changed(step) && (
                    <button class="pb-changed" aria-expanded={showChanges}
                        aria-controls={`pb-changed-${step.name}`}
                        onClick={() => setShowChanges(!showChanges)}>
                        changed
                        <span class="pb-changed-caret" aria-hidden="true">
                            {showChanges ? '▴' : '▾'}
                        </span>
                    </button>
                )}
                {showChanges && (
                    <p class="pb-changed-line" id={`pb-changed-${step.name}`}>
                        {changeSummary(step).join(' · ')}
                    </p>
                )}
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
                            first: at === 0,
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
                {step.phases.length === 0 && (
                    <FirstPhase step={step} onAddNode={onAddNode} />
                )}
                <Decisions decisions={step.decisions} />
            </div>
        </section>
    );
}

// ── The canvas ──────────────────────────────────────────

/**
 * The join between two lanes, and the only place a step can be added mid-run.
 *
 * `Add step` appended, and appending is not what someone wants when the step
 * they are adding is a review that has to run before implement. The seam says
 * where: clicking the one after `tasks` opens the form with "Runs after" already
 * reading `tasks`.
 */
function LaneSeam({ after, onNewStep }: { after: string; onNewStep: Props['onNewStep'] }) {
    return (
        <button class="pb-lane-seam" onClick={() => onNewStep(after)}
            title={`Add a step after ${after}`}>
            <span class="pb-lane-seam-label">Add a step after {after}</span>
        </button>
    );
}

export function Canvas(
    { graph, onOpenNode, onReorder, onAddHook,
        onEditHook, onSetPhases, onAddNode, onOpenFrame, onRemoveNode,
        onOpenTemplate, onNewStep, selected }: Props,
) {
    const actions = { onOpenNode, selected, yours: hookHome(graph.workflows.active) };
    const sequence = graph.steps.filter(step => step.inSequence);
    const aside = graph.steps.filter(step => !step.inSequence);

    return (
        <main class="pb-canvas">
            <div class={`pb-run${sequence.length > 1 ? ' pb-run--seamed' : ''}`}
                style={`--pb-steps: ${sequence.length}; `
                    + `--pb-seams: ${Math.max(sequence.length - 1, 0)}`}>
                {/* Flattened rather than wrapped: a fragment around each pair
                    would be a DOM-less element, and these have to be grid
                    children of the run itself. */}
                {sequence.flatMap((step, index) => [
                    index > 0 && (
                        <LaneSeam key={`seam-${step.name}`}
                            after={sequence[index - 1].name} onNewStep={onNewStep} />
                    ),
                    <Step key={step.name} step={step} index={index} actions={actions}
                        onReorder={onReorder} onAddHook={onAddHook}
                        onEditHook={onEditHook} onSetPhases={onSetPhases}
                        onAddNode={onAddNode} onOpenFrame={onOpenFrame}
                        onRemoveNode={onRemoveNode}
                        onOpenTemplate={onOpenTemplate} />,
                ])}
                {/* The tail of the row: everything that does not take a turn in
                    the run, and the invitation to add something that does. This
                    used to sit as a band ACROSS THE TOP of the board, above the
                    first step — the most prominent place on screen, for the one
                    thing that is not part of the sequence. */}
                <div class="pb-outside">
                    {/* The set of steps was the one thing the board could show
                        and not change. A review or a verification pass had to
                        hide inside implement, or not exist. */}
                    {/* The tail appends. Passing the handler straight to
                        `onClick` would hand it a MouseEvent as the step to run
                        behind. */}
                    <button class="pb-add-step" onClick={() => onNewStep()}
                        title="Add a step of your own to the end of the run">
                        <PlusIcon />
                        <span class="pb-add-step-label">Add step</span>
                    </button>
                    {/* The heading names what follows it and nothing else. It
                        used to sit above `+ Add step`, so the one control that
                        adds a step TO the run was filed under "outside" it. */}
                    {aside.length > 0 && <p class="pb-outside-head">Outside the run</p>}
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
                                {count(step.phases.reduce((n, p) => n + p.nodes.length, 0))}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
