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

import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Menu } from './Menu';
import { changeSummary, changed } from './changes';
import { KIND_LABELS } from './hookKinds';
import { GateIcon, HookIcon } from './HookIcon';
import { HookStatus, hookStatus } from './hookStatus';
import {
    HookAddress, HookMove, HookTarget, hookMove, isHookDrag, readHookDrag, upperHalf,
    writeHookDrag,
} from './hookMoves';
import {
    HookRunsAnswer,
    HookWhen,
    PipelineDecision,
    PipelineGraph,
    PipelineHook,
    PipelineNode,
    PipelinePhase,
    PipelineStep,
    StockHook,
    routeReads,
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
    /** Add a step of the project's own to the run. */
    /** `after` names the step a new one runs behind, when the click said where. */
    onNewStep: (after?: string) => void;
    /** Save a step's whole phase grouping after a rename or a move. */
    onSetPhases: (
        command: string,
        phases: Array<{ name: string; nodes: string[] }>,
        renamed?: { from: string; to: string },
    ) => void;
    /** The node whose instructions are open in the inspector, if any. */
    selected?: { command: string; nodeId: string } | null;
    /** Move one of the project's hooks, dragged to another place on its step. */
    onMoveHook?: (command: string, from: HookAddress, to: HookMove) => void;
    /** Say why a drag was not taken, where every other refusal is said. */
    onRefuse?: (reason: string) => void;
    /** Open where a decision's verdicts route, so they can be changed. */
    onOpenDecision?: (command: string, node: string) => void;
    /** The last run's outcome per hook; absent until the host answers. */
    runs?: HookRunsAnswer | null;
    /** Open the add modal for a step, from its lane's header. */
    onAddTo?: (command: string) => void;
    /** The step whose add modal is open, so its lane button reads pressed. */
    adding?: string | null;
    /** A node just taken out whose removal can still be undone. */
    removed?: RemovedRow | null;
    onUndo?: (token: string) => void;
}

/** Where a removed node sat, drawn struck through while its undo is on offer. */
export interface RemovedRow {
    command: string;
    phase: string;
    index: number;
    name: string;
    token: string;
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
export function stockName(hook: StockHook): string {
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
    selected?: Props['selected'];
    /** The last run's outcome per hook, when the project has a run on record. */
    runs?: HookRunsAnswer | null;
    step: string;
    /** The file this project's own hooks are written in, as the group is headed. */
    yours: HookHome;
    /** Present when hooks can be dragged here. */
    drop?: HookDrop;
    /** Where a deciding node's verdicts send the run, drawn under that node. */
    routing?: {
        decisions: PipelineDecision[];
        changed: string[];
        onOpen?: Props['onOpenDecision'];
    };
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
export function hookHome(workflow: string): HookHome {
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

/** What a hook drag needs from the step it happens on. */
interface HookDrop {
    step: string;
    onHookDrop: (from: HookAddress, target: HookTarget) => void;
    onRefuse: (reason: string) => void;
}

const OVER = ['pb-drop-over', 'pb-drop-over--upper', 'pb-drop-over--lower'];

const STEP_HOOK_REASON = 'On the step itself, outside every phase. Change it in the file it is written in.';

const PARKED_REASON ='This hook is parked: the project runs the pipeline as it ships, so its own '
    + 'hooks are not moved until This project is running again.';

/** The handlers that let an element take a hook dropped on it; `at` reads the target off the pointer. */
function hookDropZone(
    drop: HookDrop | undefined,
    at: (event: DragEvent) => { target: HookTarget; upper?: boolean },
) {
    if (!drop) { return {}; }
    const clear = (event: DragEvent) =>
        (event.currentTarget as HTMLElement).classList.remove(...OVER);
    return {
        onDragOver: (event: DragEvent) => {
            if (!isHookDrag(event.dataTransfer)) { return; }
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
            const { upper } = at(event);
            const el = event.currentTarget as HTMLElement;
            el.classList.add(OVER[0]);
            el.classList.toggle(OVER[1], upper === true);
            el.classList.toggle(OVER[2], upper === false);
        },
        onDragLeave: clear,
        onDrop: (event: DragEvent) => {
            const from = readHookDrag(event.dataTransfer);
            if (!from) { return; }
            event.preventDefault();
            event.stopPropagation();
            clear(event);
            drop.onHookDrop(from, at(event).target);
        },
    };
}

/** Whether the pointer is over the upper half of the element handling the event. */
function overUpper(event: DragEvent): boolean {
    return upperHalf(event.clientY,
        (event.currentTarget as HTMLElement).getBoundingClientRect());
}

/** A row the panel cannot move: a drag out says why, and stopping dragover keeps its block from taking a drop. */
function readOnlyRow(drop: HookDrop | undefined, reason: string) {
    if (!drop) { return {}; }
    return {
        draggable: true,
        onDragStart: (event: DragEvent) => { event.preventDefault(); drop.onRefuse(reason); },
        onDragOver: (event: DragEvent) => {
            if (!isHookDrag(event.dataTransfer)) { return; }
            event.stopPropagation();
            if (event.dataTransfer) { event.dataTransfer.dropEffect = 'none'; }
        },
        onDrop: (event: DragEvent) => { event.stopPropagation(); },
    };
}

/** What a hook row is called: a command by its script, everything else by its value. */
export function hookName(hook: PipelineHook): string {
    return hook.type === 'command' ? shellName(hook.summary) : hook.summary;
}

/** One hook of this project's, as a line: its kind as a mark, then its value. */
function HookLine({ hook }: { hook: PipelineHook }) {
    return (
        <>
            <HookIcon type={hook.type} />
            <span class="pb-hook-kind sr-only">{`${KIND_LABELS[hook.type]}: `}</span>
            <span class={hook.type === 'skill' || hook.type === 'prompt'
                ? 'pb-hook-name' : 'pb-hook-name pb-hook-name--ref'}>
                {clip(hookName(hook))}
            </span>
        </>
    );
}

/** Whether it ran, from the record alone; nothing when there is nothing on record. */
export function StatusMark({ status }: { status: HookStatus | null }) {
    if (!status) { return null; }
    return (
        <span class={`pb-hook-status pb-hook-status--${status.tone}`} title={status.reason}>
            <span class="pb-status-dot" aria-hidden="true" />
            {status.word}
        </span>
    );
}

/** One of this project's hooks: opens to be changed, drags to move, unless it is parked. */
function OwnHookRow({ hook, step, runs, boundary, yours, onEdit, drop, when, readOnly }: {
    hook: PipelineHook;
    step: string;
    runs?: HookRunsAnswer | null;
    boundary: 'node' | 'phase';
    yours: HookHome;
    onEdit: (hook: PipelineHook) => void;
    drop?: HookDrop;
    /** Said on the row when its place does not say it: a phase's rows sit together at the top. */
    when?: boolean;
    /** Why the row is read and not opened here. */
    readOnly?: string;
}) {
    const side = when && <span class="pb-hook-when">{hook.when}</span>;
    if (readOnly && !hook.parked) {
        return (
            <span class="pb-hook pb-hook--fixed" title={`${hook.summary}\n\n${readOnly}`}>
                {side}
                <HookLine hook={hook} />
                <StatusMark status={hookStatus(step, hook, runs)} />
            </span>
        );
    }
    if (hook.parked) {
        return (
            // The clipped name is unreachable by pointer or by keyboard, so the whole of it is said in text a screen reader gets and the eye does not.
            <span class="pb-hook pb-hook--parked"
                title={`${hook.summary}\n\nParked — this project runs the pipeline as it `
                    + 'ships, so this does not run.'}
                {...readOnlyRow(drop, PARKED_REASON)}>
                {side}
                <HookLine hook={hook} />
                <span class="pb-hook-parked">parked</span>
                <span class="sr-only">
                    {`${hook.summary} — parked, not running while the pipeline is the shipped one`}
                </span>
            </span>
        );
    }
    return (
        <button class="pb-hook"
            title={`${hook.summary}\n\n${yours.title.replace(/ Click.*$/, '')}\nClick to edit`
                + (drop ? ', drag to move' : '')}
            onClick={() => onEdit(hook)}
            draggable={Boolean(drop)}
            onDragStart={drop && (event => {
                event.stopPropagation();
                writeHookDrag(event.dataTransfer, {
                    command: drop.step, when: hook.when,
                    anchor: hook.anchor, index: hook.index, boundary,
                });
                event.currentTarget.classList.add('pb-hook--dragging');
            })}
            onDragEnd={event => event.currentTarget.classList.remove('pb-hook--dragging')}
            {...hookDropZone(drop, event => {
                const upper = overUpper(event);
                return {
                    upper,
                    target: {
                        when: hook.when, anchor: hook.anchor, boundary,
                        place: hook.index + (upper ? 0 : 1),
                    },
                };
            })}>
            {side}
            <HookLine hook={hook} />
            <StatusMark status={hookStatus(step, hook, runs)} />
        </button>
    );
}

/** A hook another extension registered: read here, edited where it was registered. */
function StockHookRow({ hook, source, drop }: {
    hook: StockHook;
    source: HookSource;
    drop?: HookDrop;
}) {
    return (
        <span class="pb-hook pb-hook--stock"
            {...readOnlyRow(drop, source.title.replace('is not edited', 'is not moved or edited'))}
            title={(hook.description.trim() ? `${hook.description.trim()}\n\n` : '')
                + (hook.command.trim() || 'This entry names no command to run.')
                + (hook.optional ? '\nIt asks before it runs.' : '')
                + (hook.conditional ? '\nIt does not run every time.' : '')}>
            <span class="pb-hook-source" title={source.title}>
                {sourceMark(source.mark)}
                <span class="pb-hook-source-name sr-only">{`${source.name}: `}</span>
            </span>
            <span class="pb-hook-name pb-hook-name--ref">{clip(stockName(hook))}</span>
            {/* The one fact here with a consequence. */}
            {hook.optional && <span class="pb-hook-asks">asks first</span>}
        </span>
    );
}

/** The rows on one side of an anchor, in the order they run. */
function HookRows({ side, ours, theirs, step, runs, boundary, yours, onEdit, drop, when,
    readOnly }: {
    side: HookWhen;
    ours: PipelineHook[];
    theirs: StockHook[];
    step: string;
    runs?: HookRunsAnswer | null;
    boundary: 'node' | 'phase';
    yours: HookHome;
    onEdit: (hook: PipelineHook) => void;
    drop?: HookDrop;
    when?: boolean;
    readOnly?: string;
}) {
    return (
        <>
            {bySource(ours, theirs, yours, side).flatMap(source => [
                ...source.ours.map(hook => (
                    <OwnHookRow key={`ours-${hook.index}`} hook={hook} step={step} runs={runs}
                        boundary={boundary} yours={yours} onEdit={onEdit} drop={drop}
                        when={when} readOnly={readOnly} />
                )),
                ...source.theirs.map((hook, i) => (
                    <StockHookRow key={`theirs-${source.name}-${i}`} hook={hook}
                        source={source} drop={drop} />
                )),
            ])}
        </>
    );
}

/**
 * One side of a node's card: the hooks that run before it sit inside the top of
 * the card, the ones after it inside the bottom, so a node and its hooks read
 * and move as one block. Absent when nothing runs on that side.
 */
function Slot({ side, node, ours, theirs, actions }: {
    side: HookWhen;
    node: PipelineNode;
    ours: PipelineHook[];
    theirs: StockHook[];
    actions: NodeActions;
}) {
    if (ours.length + theirs.length === 0) { return null; }
    return (
        <div class={`pb-card-slot pb-card-slot--${side}`} role="group"
            aria-label={`Runs ${side} ${node.name}`}
            {...hookDropZone(actions.drop, () => ({
                target: { when: side, anchor: node.id, boundary: 'node' },
            }))}>
            <HookRows side={side} ours={ours} theirs={theirs} step={actions.step}
                runs={actions.runs} boundary="node" yours={actions.yours}
                onEdit={actions.onEditHook} drop={actions.drop} />
        </div>
    );
}

/** A phase's or a step's own hooks: slim rows at its top, each saying its side. */
function EdgeHooks({ hooks, stock = [], anchor, boundary, actions, label }: {
    hooks: PipelineHook[];
    stock?: StockHook[];
    anchor: string;
    boundary: 'phase' | null;
    actions: NodeActions;
    label: string;
}) {
    if (hooks.length + stock.length === 0) { return null; }
    const drop = boundary ? actions.drop : undefined;
    return (
        <div class="pb-edge-hooks" role="group" aria-label={label}>
            {(['before', 'after'] as HookWhen[]).map(side => {
                const ours = hooks.filter(hook => hook.when === side);
                const theirs = stock.filter(hook => hook.when === side);
                if (ours.length + theirs.length === 0) { return null; }
                return (
                    <div key={side} class={`pb-edge-side pb-edge-side--${side}`}
                        {...(boundary ? hookDropZone(drop, () => ({
                            target: { when: side, anchor, boundary },
                        })) : {})}>
                        <HookRows side={side} ours={ours} theirs={theirs} step={actions.step}
                            runs={actions.runs} boundary="phase" yours={actions.yours}
                            onEdit={actions.onEditHook} drop={drop} when
                            readOnly={boundary ? undefined : STEP_HOOK_REASON} />
                    </div>
                );
            })}
        </div>
    );
}

/** The `+` on a node's top or bottom edge, which opens the add modal for that side. */
function EdgeAdd({ side, node, onAdd }: {
    side: HookWhen;
    node: PipelineNode;
    onAdd: () => void;
}) {
    return (
        <button type="button" class={`pb-edge-add pb-edge-add--${side}`} onClick={onAdd}
            aria-label={`Add a hook ${side} ${node.name}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false">
                <path d="M5 1.5V8.5M1.5 5H8.5" />
            </svg>
            <span aria-hidden="true">{side}</span>
        </button>
    );
}

/**
 * At most two marks after a node's name: what it writes, that it can stop the
 * run, that the project changed it. Ownership and the gate outrank the file
 * when all three apply, since the file is also named in the popover.
 */
function NodeMarks({ node }: { node: PipelineNode }) {
    const file = node.writes[0] ?? node.mayWrite[0];
    const sometimes = !node.writes.length && Boolean(file);
    const marks = [
        file && (node.kind !== 'gate' || !node.replaced) && (
            <span key="file" class={`pb-writes${sometimes ? ' pb-writes--sometimes' : ''}`}
                title={sometimes
                    ? 'this node produces it at some sizes, and folds it away at others'
                    : `this node produces ${[...node.writes, ...node.mayWrite].join(', ')}`}>
                {file.split('/').pop()}
            </span>
        ),
        node.kind === 'gate' && (
            <span key="gate" class="pb-node-gate" title="This node can stop the run">
                <GateIcon /><span class="sr-only">gate</span>
            </span>
        ),
        node.replaced && (
            <span key="yours" class="pb-yours">
                <span class="pb-status-dot" aria-hidden="true" />yours
            </span>
        ),
    ].filter(Boolean);
    if (marks.length === 0) { return null; }
    return <span class="pb-node-meta">{marks}</span>;
}

function Node({ node, actions, stock }: {
    node: PipelineNode;
    actions: NodeActions;
    /** Extension hooks that fire at this node's boundary, by side. */
    stock: { before: StockHook[]; after: StockHook[] };
}) {
    const before = node.hooks.filter(hook => hook.when === 'before');
    const after = node.hooks.filter(hook => hook.when === 'after');
    const movable = !node.pinned;
    const open = actions.selected?.command === actions.step
        && actions.selected?.nodeId === node.id;
    // A hook dropped on a card runs before it from the upper half, after it from the lower.
    const hookZone = hookDropZone(actions.drop, event => {
        const upper = overUpper(event);
        return { upper, target: { when: upper ? 'before' : 'after', anchor: node.id, boundary: 'node' } };
    });
    const hooked = before.length + after.length + stock.before.length + stock.after.length > 0;
    const decision = actions.routing?.decisions.find(d => d.node === node.id);

    const hasBefore = before.length + stock.before.length > 0;
    const hasAfter = after.length + stock.after.length > 0;
    const ownHooks = before.length + after.length > 0;

    return (
        <div class={`pb-node-group${hasBefore ? ' pb-node-group--before' : ''}${
            hasAfter ? ' pb-node-group--after' : ''}`}>
            <EdgeAdd side="before" node={node} onAdd={() => actions.onAdd(node.id, 'before')} />
            <div class={`pb-card${hooked ? ' pb-card--hooked' : ''}${
                ownHooks ? ' pb-card--yours' : ''}${open ? ' pb-card--open' : ''}`}
                data-node={`${actions.step}/${node.id}`}>
            <Slot side="before" node={node} ours={before} theirs={stock.before} actions={actions} />
            <div
                class={[
                    'pb-node',
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
                    if (isHookDrag(event.dataTransfer)) { hookZone.onDragOver?.(event); return; }
                    event.preventDefault();
                    if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
                    (event.currentTarget as HTMLElement).classList.add('pb-node--over');
                }}
                onDragLeave={event => {
                    hookZone.onDragLeave?.(event);
                    (event.currentTarget as HTMLElement).classList.remove('pb-node--over');
                }}
                onDrop={event => {
                    if (isHookDrag(event.dataTransfer)) { hookZone.onDrop?.(event); return; }
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

                <button class="pb-node-main" aria-haspopup="dialog" aria-expanded={open}
                    onClick={() => actions.onOpenNode(actions.step, node.id)}
                    title={node.pinned
                        ? `${node.name}. Held in place: ${node.pinned}. Open for its details.`
                        : `${node.name}. Open for its details and everything it can do.`}>
                    <span class="pb-node-name">{node.name}</span>
                    <NodeMarks node={node} />
                </button>
            </div>
            <Slot side="after" node={node} ours={after} theirs={stock.after} actions={actions} />
            </div>
            <EdgeAdd side="after" node={node} onAdd={() => actions.onAdd(node.id, 'after')} />
            {decision && actions.routing && (
                <Routing step={actions.step} decision={decision}
                    changed={actions.routing.changed} onOpen={actions.routing.onOpen} />
            )}
        </div>
    );
}

/** A deciding node's routing: one quiet line under its card that opens to the verdicts. */
function Routing({ step, decision, changed, onOpen }: {
    step: string;
    decision: PipelineDecision;
    changed: string[];
    onOpen?: Props['onOpenDecision'];
}) {
    const [open, setOpen] = useState(false);
    const id = `pb-routing-${step}-${decision.node}`;
    return (
        <div class="pb-routing">
            <button type="button" class="pb-routing-toggle" aria-expanded={open}
                aria-controls={id} onClick={() => setOpen(!open)}>
                Routing
                <span class="pb-routing-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
                <div id={id}>
                    <Decisions step={step} decisions={[decision]} changed={changed}
                        onOpen={onOpen} />
                </div>
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
    /** Fold this phase into its neighbour; its nodes join that phase at the near edge. */
    onMerge: (name: string, into: 'above' | 'below') => void;
    onAddPhaseAfter: (name: string) => void;
    /**
     * Extension hooks that fire at the step's edges, given to the phase that
     * holds those edges — empty for every phase in between.
     */
    stockBefore: StockHook[];
    stockAfter: StockHook[];
    /** A phase needs two nodes to split, since neither half may be empty. */
    canSplit: boolean;
    /** The phases on either side, which are what a merge can join. */
    above?: string;
    below?: string;
    /** A node just removed from this phase, still on offer to be put back. */
    removed?: RemovedRow | null;
    onUndo?: (token: string) => void;
}

/** A struck row where a removed node sat, with the way back while the host still offers it. */
function RemovedNode({ row, onUndo }: { row: RemovedRow; onUndo?: (token: string) => void }) {
    return (
        <div class="pb-removed" role="group" aria-label={`${row.name} removed from the run`}>
            <span class="pb-removed-name"><s>{row.name}</s></span>
            {onUndo && (
                <button type="button" class="pb-removed-undo" onClick={() => onUndo(row.token)}
                    aria-label={`Undo removing ${row.name}`}>Undo</button>
            )}
        </div>
    );
}

function Phase({ phase, actions, controls }: {
    phase: PipelinePhase;
    actions: NodeActions;
    controls: PhaseControls;
}) {
    const [renaming, setRenaming] = useState(false);
    const field = useRef<HTMLInputElement>(null);

    // The menu hands focus back to its trigger before the pick runs, so the field can take it now.
    useLayoutEffect(() => {
        if (renaming) { field.current?.focus(); field.current?.select(); }
    }, [renaming]);

    const finish = (save: boolean) => {
        // Escape unmounts the field, and a browser may blur it on the way out.
        if (!field.current?.isConnected || field.current.dataset.done) { return; }
        field.current.dataset.done = '1';
        const next = field.current.value.trim();
        setRenaming(false);
        if (save && next && next !== phase.name) { controls.onRename(phase.name, next); }
    };

    /**
     * What a phase can do, behind its own name. A row that cannot run here is
     * shown inert with its reason, because the note is what teaches the
     * capability: "one node here, so there is nothing to split off".
     */
    const offered = [
        { id: 'rename', label: 'Rename…', note: 'Its hooks follow the new name.' },
        controls.canSplit
            ? { id: 'split', label: 'Split', note: 'Its last node starts a new phase after it.' }
            : {
                id: 'split', label: 'Split', disabled: true,
                note: 'One node here, so there is nothing to split off.',
            },
        ...(controls.above
            ? [{ id: 'merge-above', label: `Merge into ${controls.above}, above` }] : []),
        ...(controls.below
            ? [{ id: 'merge-below', label: `Merge into ${controls.below}, below` }] : []),
        ...(!controls.above && !controls.below
            ? [{
                id: 'merge', label: 'Merge', disabled: true,
                note: 'A step needs at least one phase.',
            }] : []),
    ];

    // No guards here: `Menu` will not call this for a row it drew inert.
    const act = (id: string) => {
        if (id === 'rename') { setRenaming(true); }
        if (id === 'split') { controls.onAddPhaseAfter(phase.name); }
        if (id === 'merge-above') { controls.onMerge(phase.name, 'above'); }
        if (id === 'merge-below') { controls.onMerge(phase.name, 'below'); }
    };

    const removed = controls.removed;
    const nodes = phase.nodes.map((node, at) => (
        // An installed extension registers against the step, not a node — so
        // its hooks land on the step's real edges: the first node's `before`
        // and the last node's `after`.
        <Node key={node.id} node={node} actions={actions} stock={{
            before: at === 0 ? controls.stockBefore : [],
            after: at === phase.nodes.length - 1 ? controls.stockAfter : [],
        }} />
    ));
    if (removed) {
        nodes.splice(Math.min(removed.index, nodes.length), 0,
            <RemovedNode key={`removed-${removed.token}`} row={removed} onUndo={controls.onUndo} />);
    }

    return (
        <section class="pb-phase">
            <header class="pb-phase-head" {...hookDropZone(actions.drop, () => ({
                target: { when: 'before', anchor: phase.name, boundary: 'phase' },
            }))}>
                {/* A phase name is also a hook anchor, so renaming it is a real
                    edit: the hooks on it follow the new name. */}
                {renaming ? (
                    <input ref={field} class="pb-phase-input" type="text" defaultValue={phase.name}
                        aria-label={`Rename the ${phase.name} phase`} spellcheck={false}
                        onBlur={() => finish(true)}
                        onKeyDown={event => {
                            if (event.key === 'Enter') { event.preventDefault(); finish(true); }
                            if (event.key === 'Escape') { event.preventDefault(); finish(false); }
                        }} />
                ) : (
                    <Menu
                        class="pb-phase-name"
                        trigger={<span class="pb-trigger-text">{phase.name}</span>}
                        heading={`Phase ${phase.name} · ${count(phase.nodes.length)}`}
                        label={`Phase ${phase.name}`}
                        title={`Rename, split or merge ${phase.name}`}
                        options={offered}
                        onPick={act}
                    />
                )}
            </header>
            <EdgeHooks hooks={phase.hooks} anchor={phase.name} boundary="phase"
                actions={actions} label={`Hooks on the ${phase.name} phase`} />
            <div class="pb-phase-nodes">{nodes}</div>
        </section>
    );
}

// ── The decision ────────────────────────────────────────

function Decisions({ step, decisions, changed, onOpen }: {
    step: string;
    decisions: PipelineDecision[];
    /** `node.verdict` for each verdict this project has changed. */
    changed: string[];
    onOpen?: Props['onOpenDecision'];
}) {
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
                                {routeReads(verdict.folds, verdict.warns)}
                                {changed.includes(`${decision.node}.${verdict.name}`)
                                    && <span class="pb-yours">yours</span>}
                            </li>
                        ))}
                    </ul>
                    {/* The routing was drawn and could only be read. The
                        override that changes it has shipped the whole time. */}
                    {onOpen && (
                        <button class="pb-decision-edit" type="button"
                            title={`Change where ${decision.node}'s verdicts route`}
                            onClick={() => onOpen(step, decision.node)}>
                            Change the routing
                        </button>
                    )}
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

/** The extension hooks the board draws on a node: the step's before on its first node, its after on its last. */
export function stockAt(step: PipelineStep, nodeId: string): StockHook[] {
    const nodes = step.phases.flatMap(phase => phase.nodes);
    return [
        ...(nodes[0]?.id === nodeId ? step.stockHooks.filter(h => h.when === 'before') : []),
        ...(nodes[nodes.length - 1]?.id === nodeId ? step.stockHooks.filter(h => h.when === 'after') : []),
    ];
}

/** This project's hooks at one anchor, which is what a dropped hook is counted among. */
export function hooksAt(step: PipelineStep, anchor: string, boundary: 'node' | 'phase'): PipelineHook[] {
    for (const phase of step.phases) {
        if (boundary === 'phase' && phase.name === anchor) { return phase.hooks; }
        const node = phase.nodes.find(n => n.id === anchor);
        if (boundary === 'node' && node) { return node.hooks; }
    }
    return [];
}

function Step({ step, index, actions, onReorder, onAddHook, onEditHook, onSetPhases,
    onAddNode, onOpenFrame, onMoveHook, onRefuse,
    onOpenDecision, onAddTo, adding, removed, onUndo }: {
    step: PipelineStep;
    index: number;
    onAddTo?: Props['onAddTo'];
    adding?: boolean;
    removed?: RemovedRow | null;
    onUndo?: Props['onUndo'];
    actions: Omit<NodeActions, 'onDrop' | 'step' | 'onAdd' | 'onEditHook' | 'drop'>;
    onMoveHook: Props['onMoveHook'];
    onRefuse: Props['onRefuse'];
    onReorder: Props['onReorder'];
    onAddHook: Props['onAddHook'];
    onEditHook: Props['onEditHook'];
    onSetPhases: Props['onSetPhases'];
    onAddNode: Props['onAddNode'];
    onOpenFrame: Props['onOpenFrame'];
    onOpenDecision: Props['onOpenDecision'];
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
        routing: {
            decisions: step.decisions, changed: step.changes.decisions, onOpen: onOpenDecision,
        },
        drop: onMoveHook && onRefuse && {
            step: step.name,
            onRefuse,
            onHookDrop: (from, target) => {
                if (from.command !== step.name) {
                    onRefuse(`A hook moves within its own step, so it stays in ${from.command}. `
                        + `To run it in ${step.name} too, add it there.`);
                    return;
                }
                const count = hooksAt(step, target.anchor, target.boundary)
                    .filter(hook => hook.when === target.when).length;
                const to = hookMove(from, target, count);
                if (to) { onMoveHook(step.name, from, to); }
            },
        },
    };
    const nodes = step.phases.reduce((n, phase) => n + phase.nodes.length, 0);
    const nodeIds = new Set(step.phases.flatMap(phase => phase.nodes.map(n => n.id)));

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
                    {/* What changed, on the step it changed, opened in place. */}
                    {changed(step) && (
                        <>
                            <span class="pb-fact-dot" aria-hidden="true">·</span>
                            <button class="pb-changed" aria-expanded={showChanges}
                                aria-controls={`pb-changed-${step.name}`}
                                onClick={() => setShowChanges(!showChanges)}>
                                changed
                                <span class="pb-changed-caret" aria-hidden="true">
                                    {showChanges ? '▴' : '▾'}
                                </span>
                            </button>
                        </>
                    )}
                </div>
                {showChanges && (
                    <p class="pb-changed-line" id={`pb-changed-${step.name}`}>
                        {changeSummary(step).join(' · ')}
                    </p>
                )}
                {onAddTo && (
                    <button type="button"
                        class={`pb-lane-add pb-lane-add--head${adding ? ' pb-lane-add--on' : ''}`}
                        aria-haspopup="dialog" aria-expanded={Boolean(adding)}
                        onClick={() => onAddTo(step.name)}>
                        <PlusIcon />
                        <span>Add to {step.name}</span>
                    </button>
                )}
            </header>

            <div class="pb-step-body">
                <EdgeHooks hooks={step.hooks ?? []} anchor={step.name} boundary={null}
                    actions={bound} label={`Hooks on the ${step.name} step`} />
                {step.phases.map((phase, at) => (
                    <Phase key={phase.name} phase={phase} actions={bound}
                        controls={{
                            stockBefore: at === 0
                                ? step.stockHooks.filter(h => h.when === 'before') : [],
                            stockAfter: at === step.phases.length - 1
                                ? step.stockHooks.filter(h => h.when === 'after') : [],
                            canSplit: phase.nodes.length > 1,
                            above: step.phases[at - 1]?.name,
                            below: step.phases[at + 1]?.name,
                            removed: removed?.command === step.name && removed.phase === phase.name
                                ? removed : null,
                            onUndo,
                            // The name is a hook anchor, so the hooks come with it.
                            onRename: (from, to) => onSetPhases(step.name, settled(
                                grouping().map(p => p.name === from ? { ...p, name: to } : p)),
                                { from, to }),
                            // Its nodes join the neighbour at the edge they meet it.
                            onMerge: (name, direction) => {
                                const phases = grouping();
                                const i = phases.findIndex(p => p.name === name);
                                const into = direction === 'above' ? i - 1 : i + 1;
                                if (i < 0 || !phases[into]) { return; }
                                const next = phases.map((p, k) => k === into
                                    ? {
                                        ...p,
                                        nodes: direction === 'above'
                                            ? [...p.nodes, ...phases[i].nodes]
                                            : [...phases[i].nodes, ...p.nodes],
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
                        }} />
                ))}
                {step.phases.length === 0 && (
                    <FirstPhase step={step} onAddNode={onAddNode} />
                )}
                {/* A decision no node on the board makes still says where it routes. */}
                <Decisions step={step.name}
                    decisions={step.decisions.filter(d => !nodeIds.has(d.node))}
                    changed={step.changes.decisions} onOpen={onOpenDecision} />
                {onAddTo && (
                    <button type="button"
                        class={`pb-lane-add pb-lane-add--foot${adding ? ' pb-lane-add--on' : ''}`}
                        aria-haspopup="dialog" aria-expanded={Boolean(adding)}
                        onClick={() => onAddTo(step.name)}>
                        <PlusIcon />
                        <span>Add to {step.name}</span>
                    </button>
                )}
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
function LaneJoin({ after, next, onNewStep }: {
    after: string;
    next: string;
    onNewStep: Props['onNewStep'];
}) {
    return (
        <div class="pb-lane-join">
            <svg class="pb-lane-arrow pb-lane-arrow--across" width="24" height="12"
                viewBox="0 0 24 12" aria-hidden="true">
                <path d="M1 6H21M16 1L22 6L16 11" fill="none" stroke="currentColor"
                    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="pb-lane-arrow pb-lane-arrow--down" width="12" height="24"
                viewBox="0 0 12 24" aria-hidden="true">
                <path d="M6 2V20M2 15L6 21L10 15" fill="none" stroke="currentColor"
                    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="pb-lane-then">then {next}</span>
            <button class="pb-lane-seam" onClick={() => onNewStep(after)}
                title={`Add a step after ${after}`}>
                <span class="pb-lane-seam-label">Add a step after {after}</span>
            </button>
        </div>
    );
}

export function Canvas(
    { graph, onOpenNode, onReorder, onAddHook,
        onEditHook, onSetPhases, onAddNode, onOpenFrame,
        onNewStep, selected, onMoveHook, onRefuse,
        onOpenDecision, runs, onAddTo, adding, removed, onUndo }: Props,
) {
    const actions = { onOpenNode, selected, runs, yours: hookHome(graph.workflows.active) };
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
                        <LaneJoin key={`seam-${step.name}`} after={sequence[index - 1].name}
                            next={step.name} onNewStep={onNewStep} />
                    ),
                    <Step key={step.name} step={step} index={index} actions={actions}
                        onReorder={onReorder} onAddHook={onAddHook}
                        onEditHook={onEditHook} onSetPhases={onSetPhases}
                        onAddNode={onAddNode} onOpenFrame={onOpenFrame}
                        onMoveHook={onMoveHook} onRefuse={onRefuse}
                        onOpenDecision={onOpenDecision} onAddTo={onAddTo}
                        adding={adding === step.name} removed={removed} onUndo={onUndo} />,
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
