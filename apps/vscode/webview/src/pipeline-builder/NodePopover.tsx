/**
 * One node's details beside its card: what it writes and needs, its hooks and
 * whether each ran, and everything the node can do. A bottom sheet when the
 * builder is narrow, which holds the keyboard until it closes.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Menu, MenuOption } from './Menu';
import { HookIcon } from './HookIcon';
import { KIND_LABELS } from './hookKinds';
import { hookStatus } from './hookStatus';
import { StatusMark, hookName } from './Canvas';
import { MovePlaces } from './moves';
import { HookRunsAnswer, PipelineHook, PipelineNode } from '../../../src/protocol/pipeline';

export type NodeAction =
    | 'open-file' | 'up' | 'down' | 'remove' | 'shipped' | 'add-hook'
    | `phase:${string}` | `variant:${string}`;

interface Props {
    node: PipelineNode;
    step: string;
    runs?: HookRunsAnswer | null;
    /** The file this project's hooks are written in, as the hook card names it. */
    hooksIn: string;
    /** The `data-node` of the card this hangs beside; absent in a story, where it sits in the flow. */
    anchorKey?: string;
    narrow?: boolean;
    /** Where the node can go, and why the writer would refuse the rest. */
    moves: MovePlaces;
    /** Why the node cannot leave the run, or empty when it can. */
    removeBlocked: string;
    announce?: string;
    onClose: () => void;
    onEditNode: () => void;
    onAddHook: () => void;
    onEditHook: (hook: PipelineHook) => void;
    onRemoveHook: (hook: PipelineHook) => void;
    onAction: (action: NodeAction) => void;
    /** Render with More already open, for a story or a capture. */
    moreOpen?: boolean;
    /** Render with the move list showing, for a story or a capture. */
    moveOpen?: boolean;
}

function Arrow({ direction }: { direction: 'up' | 'down' }) {
    return (
        <svg class="pb-move-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d={direction === 'up' ? 'M7 11.5V2.5M3.5 6L7 2.5L10.5 6' : 'M7 2.5V11.5M3.5 8L7 11.5L10.5 8'} />
        </svg>
    );
}

function Lock() {
    return (
        <svg class="pb-move-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false">
            <rect x="3" y="6.5" width="8" height="5.5" rx="1" />
            <path d="M5 6.5V4.5a2 2 0 0 1 4 0v2" />
        </svg>
    );
}

/** The places a node can go; a refused one stays focusable so its reason is read. */
function MoveList({ moves, onPick }: { moves: MovePlaces; onPick: (id: string) => void }) {
    return (
        <section class="pb-pop-section" aria-label="Move to">
            <h3 class="pb-pop-label">Move to</h3>
            {moves.pinned ? (
                <p class="pb-move-held"><Lock />{`Held in place: ${moves.pinned}.`}</p>
            ) : (
                <ul class="pb-move-list">
                    {moves.places.map(place => (
                        <li key={place.id}>
                            <button type="button"
                                class={`pb-move-place${place.refused ? ' pb-move-place--refused' : ''}`}
                                aria-disabled={place.refused ? 'true' : undefined}
                                onClick={() => { if (!place.refused) { onPick(place.id); } }}>
                                <Arrow direction={place.direction} />
                                <span class="pb-move-text">
                                    <span class="pb-move-label">{place.label}</span>
                                    {place.refused && <span class="pb-move-reason">{place.refused}</span>}
                                </span>
                            </button>
                        </li>
                    ))}
                    {moves.places.length === 0 && (
                        <li class="pb-pop-empty">It is the only node in this step, so there is nowhere to move it.</li>
                    )}
                </ul>
            )}
            {moves.held.map(line => <p key={line} class="pb-move-held"><Lock />{line}</p>)}
            <p class="pb-pop-empty">Or hold the grip and drag within the lane.</p>
        </section>
    );
}

const WIDTH = 372;
const GAP = 12;
const EDGE = 8;

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The node actions that are not in the footer, said the same way. */
export function moreOptions(props: Pick<Props, 'node'>): MenuOption[] {
    const { node } = props;
    const options: MenuOption[] = [
        { id: 'add-hook', label: 'Add hook', note: 'A skill, an instruction or a command, before or after it.' },
        { id: 'open-file', label: 'Open the file', note: 'In the editor, frontmatter and all.' },
        ...node.variants.map(variant => ({
            id: `variant:${variant.id}`,
            label: `Replace with ${variant.name}`,
            note: variant.summary,
        })),
    ];
    if (node.replaced && node.shipped) {
        options.push({
            id: 'shipped', label: 'Use the shipped node',
            note: 'Sends your copy to the trash. Undo in the status line puts it back.',
        });
    }
    return options;
}

function HookCard({ hook, step, runs, hooksIn, onEdit, onRemove }: {
    hook: PipelineHook;
    step: string;
    runs?: HookRunsAnswer | null;
    hooksIn: string;
    onEdit: () => void;
    onRemove: () => void;
}) {
    const status = hookStatus(step, hook, runs);
    const name = hookName(hook);
    return (
        <li class="pb-pop-hook">
            <div class="pb-pop-hook-head">
                <span class="pb-pop-hook-when">{hook.when === 'before' ? 'Before' : 'After'}</span>
                <HookIcon type={hook.type} />
                <span class="pb-pop-hook-kind">{KIND_LABELS[hook.type].toLowerCase()}</span>
                <StatusMark status={status} />
            </div>
            <p class={`pb-pop-hook-name${hook.type === 'command' || hook.type === 'node'
                ? ' pb-pop-hook-name--ref' : ''}`}>{name}</p>
            {status && <p class="pb-pop-hook-reason">{status.reason}</p>}
            <div class="pb-pop-hook-foot">
                <span class="pb-pop-hook-where">
                    {hook.parked ? `Parked, in ${hooksIn}` : `Yours, in ${hooksIn}`}
                </span>
                {!hook.parked && (
                    <>
                        <button type="button" class="pb-pop-link" onClick={onEdit}
                            aria-label={`Edit ${name}`}>Edit</button>
                        <button type="button" class="pb-pop-link" onClick={onRemove}
                            aria-label={`Remove ${name}`}>Remove</button>
                    </>
                )}
            </div>
        </li>
    );
}

export function NodePopover(props: Props) {
    const { node, step, runs, narrow, anchorKey } = props;
    // Matched on the property, since a step and a node are named by whoever wrote them.
    const card = () => (anchorKey
        ? Array.from(document.querySelectorAll<HTMLElement>('.pb-card'))
            .find(el => el.dataset.node === anchorKey) ?? null
        : null);
    const box = useRef<HTMLDivElement>(null);
    const opener = useRef<Element | null>(null);
    const [place, setPlace] = useState<{ top: number; left: number; side: 'left' | 'right'; arrow: number } | null>(null);
    const [moving, setMoving] = useState(Boolean(props.moveOpen));

    // The list takes the keyboard when it opens, on its first place that can be taken.
    useLayoutEffect(() => {
        if (!moving || props.moveOpen) { return; }
        (box.current?.querySelector<HTMLElement>('.pb-move-place:not([aria-disabled])')
            ?? box.current?.querySelector<HTMLElement>('.pb-move-place'))?.focus();
    }, [moving]);

    useLayoutEffect(() => {
        if (narrow || !anchorKey || !box.current) { setPlace(null); return undefined; }
        const position = () => {
            const anchor = card();
            if (!anchor || !box.current) { return; }
            const at = anchor.getBoundingClientRect();
            const el = box.current!;
            const vw = document.documentElement.clientWidth || window.innerWidth;
            const vh = document.documentElement.clientHeight || window.innerHeight;
            const width = Math.min(WIDTH, vw - EDGE * 2);
            const right = at.right + GAP + width <= vw - EDGE;
            const left = right ? at.right + GAP : Math.max(EDGE, at.left - GAP - width);
            const top = Math.min(Math.max(at.top, EDGE), Math.max(EDGE, vh - el.offsetHeight - EDGE));
            setPlace({ top, left, side: right ? 'right' : 'left', arrow: Math.max(12, at.top - top + 12) });
        };
        position();
        window.addEventListener('resize', position);
        document.addEventListener('scroll', position, true);
        return () => {
            window.removeEventListener('resize', position);
            document.removeEventListener('scroll', position, true);
        };
    }, [anchorKey, narrow, node.hooks.length, moving]);

    useLayoutEffect(() => {
        opener.current = document.activeElement;
        const self = box.current;
        self?.focus();
        return () => {
            const back = opener.current as HTMLElement | null;
            const active = document.activeElement;
            // Only when the keyboard was inside it: a click elsewhere, or a pane it opened, keeps focus.
            const lost = !active || active === document.body || Boolean(self?.contains(active));
            if (lost && back?.isConnected && !document.querySelector('.pb-side')) { back.focus(); }
        };
    }, []);

    // Before paint, so a key pressed the moment it opens is already caught.
    useLayoutEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // An open menu inside takes Escape for itself.
                if (box.current?.querySelector('[aria-expanded="true"]')) { return; }
                props.onClose();
                return;
            }
            if (event.key !== 'Tab' || !narrow || !box.current) { return; }
            const stops = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (stops.length === 0) { return; }
            const first = stops[0];
            const last = stops[stops.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === first || active === box.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const away = (event: MouseEvent) => {
            const target = event.target as Element | null;
            if (!target || target.closest('.pb-popover, .pb-menu-list')) { return; }
            if (card()?.contains(target)) { return; }
            props.onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', away);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', away);
        };
    }, [narrow, anchorKey, props.onClose]);

    const ownHooks = [...node.hooks].sort((a, b) => (a.when === b.when
        ? a.index - b.index : a.when === 'before' ? -1 : 1));
    const writes = [...node.writes, ...node.mayWrite];
    const titleId = `pb-pop-title-${step}-${node.id}`.replace(/[^\w-]/g, '-');

    const body = (
        <div
            ref={box}
            class={[
                'pb-popover',
                narrow ? 'pb-popover--sheet' : '',
                place ? `pb-popover--${place.side}` : '',
                !narrow && anchorKey ? 'pb-popover--floating' : '',
            ].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal={narrow ? 'true' : undefined}
            aria-labelledby={titleId}
            tabIndex={-1}
            style={place
                ? `top: ${place.top}px; left: ${place.left}px; --pb-arrow-top: ${place.arrow}px`
                : undefined}>
            {narrow && <span class="pb-sheet-grip" aria-hidden="true" />}
            <header class="pb-pop-head">
                <h2 class="pb-pop-title" id={titleId}>{node.name}</h2>
                <span class={`pb-pop-source${node.replaced ? ' pb-pop-source--yours' : ''}`}>
                    {node.replaced ? 'Yours' : 'As shipped'}
                </span>
                {narrow && moving && (
                    <button type="button" class="pb-pop-button pb-pop-back"
                        onClick={() => setMoving(false)}>Back</button>
                )}
                <button type="button" class="pb-pop-close" aria-label="Close" title="Close"
                    onClick={props.onClose}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round" aria-hidden="true" focusable="false">
                        <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                </button>
            </header>

            {moving ? <MoveList moves={props.moves} onPick={id => props.onAction(id as NodeAction)} /> : <>
            <section class="pb-pop-section" aria-label="This node">
                <h3 class="pb-pop-label">This node</h3>
                <dl class="pb-pop-facts">
                    <dt>Writes</dt>
                    <dd class={writes.length ? 'pb-pop-mono' : ''}>
                        {writes.length ? writes.join(', ') : 'No file'}
                    </dd>
                    {node.reads.length > 0 && (
                        <>
                            <dt>Needs</dt>
                            <dd class="pb-pop-mono">{node.reads.join(', ')}</dd>
                        </>
                    )}
                    {node.kind === 'gate' && (
                        <>
                            <dt>Gate</dt>
                            <dd>It can stop the run.</dd>
                        </>
                    )}
                    {node.pinned && (
                        <>
                            <dt>Held</dt>
                            <dd>{node.pinned}</dd>
                        </>
                    )}
                </dl>
            </section>

            <section class="pb-pop-section" aria-label="Its hooks">
                <h3 class="pb-pop-label">Its hooks · {ownHooks.length}</h3>
                {ownHooks.length > 0 ? (
                    <ul class="pb-pop-hooks">
                        {ownHooks.map(hook => (
                            <HookCard key={`${hook.when}-${hook.index}`} hook={hook} step={step}
                                runs={runs} hooksIn={props.hooksIn}
                                onEdit={() => props.onEditHook(hook)}
                                onRemove={() => props.onRemoveHook(hook)} />
                        ))}
                    </ul>
                ) : (
                    <p class="pb-pop-empty">Nothing runs before or after it yet.</p>
                )}
            </section>
            </>}

            <footer class="pb-pop-actions">
                <p class="pb-live" role="status" aria-live="polite">{props.announce ?? ''}</p>
                <button type="button" class={`pb-pop-button${moving ? ' pb-pop-button--on' : ''}`}
                    aria-pressed={moving} onClick={() => setMoving(!moving)}>
                    Move…
                </button>
                <button type="button" class="pb-pop-button" onClick={props.onEditNode}>
                    Edit node
                </button>
                <Menu
                    class="pb-pop-more"
                    trigger="More"
                    align="right"
                    floating
                    title={`Everything else ${node.name} can do`}
                    options={moreOptions(props)}
                    onPick={id => (id === 'add-hook' ? props.onAddHook() : props.onAction(id as NodeAction))}
                    defaultOpen={props.moreOpen}
                />
                <button type="button" class="pb-pop-remove"
                    aria-disabled={props.removeBlocked ? 'true' : undefined}
                    title={props.removeBlocked || 'Keeps the file: it stays on offer under Add node.'}
                    onClick={() => { if (!props.removeBlocked) { props.onAction('remove'); } }}>
                    Remove from the run
                    {props.removeBlocked && <span class="sr-only">{`, ${props.removeBlocked}`}</span>}
                </button>
            </footer>
        </div>
    );

    if (!narrow) { return body; }
    return (
        <div class="pb-sheet-layer">
            <div class="pb-sheet-scrim" aria-hidden="true" onClick={props.onClose} />
            {body}
        </div>
    );
}
