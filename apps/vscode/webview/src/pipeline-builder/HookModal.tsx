/**
 * Adding or editing a hook, in a modal that opens where it was asked for.
 *
 * The title names the place, so the only question left is what to run there:
 * one field, the four kinds, and a list that narrows as you type.
 */

import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { HookIcon } from './HookIcon';
import { Menu } from './Menu';
import { Attachment, boundaryOf } from './AttachForm';
import {
    HookType, HookWhen, OfferedEntry, PipelineChoices, PipelineHook, PipelineStep, SkillChoice,
} from '../../../src/protocol/pipeline';

interface Props {
    step: PipelineStep;
    /** The phase or node the "+" was pressed on. */
    anchor: string;
    /** Which side of it that "+" sat on. */
    when?: HookWhen;
    choices: PipelineChoices;
    /** The hook being changed, when this is an edit rather than an addition. */
    editing?: PipelineHook | null;
    onCancel: () => void;
    /** `keepOpen` asks the parent to leave the modal up for another one. */
    onAttach: (attachment: Attachment, keepOpen: boolean) => void;
    onRemove?: () => void;
    /** Move the hook one place within its saved side and anchor. */
    onMove?: (direction: 'up' | 'down') => void;
    /** How many of this project's hooks share the edited hook's side and anchor. */
    count?: number;
    /** What the last move's write said, read once it answers. */
    announce?: string;
}

const KINDS: Array<{
    type: HookType; label: string; short: string; field: string; placeholder: string;
}> = [
    { type: 'skill', label: 'Skill', short: 'Skill', field: 'Search skills', placeholder: 'Search skills' },
    {
        type: 'prompt', label: 'Instruction', short: 'Instruction', field: 'The instruction',
        placeholder: 'Check the CHANGELOG is updated before continuing.',
    },
    {
        type: 'command', label: 'Shell command', short: 'Shell', field: 'The command',
        placeholder: 'npm run lint-spec',
    },
    { type: 'node', label: 'Node file', short: 'File', field: 'Search node files', placeholder: 'Search node files' },
];

const WHENS: Array<{ id: HookWhen; label: string; note: string }> = [
    { id: 'before', label: 'before', note: 'ahead of it, every run' },
    { id: 'after', label: 'after', note: 'once it has finished' },
];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

interface Place {
    id: string; label: string; note: string; anchor: string; boundary: 'node' | 'phase';
}

const placeId = (boundary: 'node' | 'phase', anchor: string) => `${boundary}:${anchor}`;

function places(step: PipelineStep): Place[] {
    return step.phases.flatMap(phase => [
        {
            id: placeId('phase', phase.name), label: `the ${phase.name} phase`,
            note: `every node in ${phase.name}`, anchor: phase.name, boundary: 'phase' as const,
        },
        ...phase.nodes.map(node => ({
            id: placeId('node', node.id), label: node.name, note: node.id,
            anchor: node.id, boundary: 'node' as const,
        })),
    ]);
}

/** One row of the result list. `warn` notes are the ones that change what happens. */
interface Row { id: string; label: string; note?: string; warn?: boolean; unknown?: boolean }

function sourceOf(skill: SkillChoice): string {
    if (skill.source === 'project') { return 'from this project'; }
    if (skill.source === 'user') { return 'yours'; }
    return `from ${skill.where}`;
}

function skillRow(skill: SkillChoice): Row {
    const problems = [
        !skill.callable && 'a hook cannot call it',
        !skill.enabled && 'its plugin is turned off',
    ].filter(Boolean);
    return {
        id: skill.id,
        label: skill.name || skill.id,
        note: [sourceOf(skill), ...problems].join(' · '),
        warn: problems.length > 0,
    };
}

/** The label with the typed text marked, as text nodes only. */
function Marked({ text, query }: { text: string; query: string }) {
    const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (at < 0) { return <>{text}</>; }
    return (
        <>
            {text.slice(0, at)}
            <mark class="pb-modal-match">{text.slice(at, at + query.length)}</mark>
            {text.slice(at + query.length)}
        </>
    );
}

export function HookModal(props: Props) {
    const { step, anchor, when: seededWhen, choices, editing, onCancel, onAttach } = props;
    const placeOf = (name: string) => placeId(boundaryOf(step, name), name);
    const [hookType, setHookType] = useState<HookType>(editing?.type ?? 'skill');
    const [value, setValue] = useState(editing?.summary ?? '');
    const [note, setNote] = useState(editing?.note ?? '');
    const [where, setWhere] = useState(placeOf(editing?.anchor ?? anchor));
    const [when, setWhen] = useState<HookWhen>(editing?.when ?? seededWhen ?? 'before');
    const [keep, setKeep] = useState(false);
    const [added, setAdded] = useState('');
    const [active, setActive] = useState(0);
    const box = useRef<HTMLDivElement>(null);
    const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const opener = useRef<HTMLElement | null>(null);

    const kind = KINDS.find(k => k.type === hookType)!;
    const all = places(step);
    const place = all.find(p => p.id === where);
    const placeLabel = place?.label ?? editing?.anchor ?? anchor;
    const searching = hookType === 'skill' || hookType === 'node';
    const query = value.trim();

    const known: Row[] = hookType === 'skill'
        ? choices.skillCatalog
            ? choices.skillCatalog.map(skillRow)
            : choices.skills.map(id => ({ id, label: id }))
        : hookType === 'node' ? choices.nodes.map(id => ({ id, label: id })) : [];
    const isExact = (row: Row) => row.id === query || row.label === query;
    // The exact name first, so an edit opens on the hook's own entry.
    const matches = known.filter(row => !query
        || row.id.toLowerCase().includes(query.toLowerCase())
        || row.label.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(isExact(b)) - Number(isExact(a)));
    const exact = known.some(isExact);
    const rows: Row[] = searching && query && !exact
        ? [...matches, {
            id: query, label: query, warn: true, unknown: true,
            note: hookType === 'skill' ? 'not installed' : 'no node file by that name',
        }]
        : matches;
    // Nothing is chosen until something is typed: an empty field adds nothing.
    const current = searching && query
        ? rows[Math.min(Math.max(active, 0), rows.length - 1)] ?? null
        : null;
    const chosen = searching ? current?.id ?? '' : value.trim();
    const ready = chosen.length > 0;
    const commands: OfferedEntry[] = hookType === 'prompt' ? (choices.commands ?? []) : [];
    const listId = `pb-modal-list-${step.name}`.replace(/[^\w-]/g, '-');
    const titleId = `${listId}-title`;
    const optionId = (index: number) => `${listId}-${index}`;

    useLayoutEffect(() => {
        const was = document.activeElement as HTMLElement | null;
        opener.current = was && was !== document.body ? was : null;
        field.current?.focus();
        const self = box.current;
        return () => {
            const active = document.activeElement;
            const lost = !active || active === document.body || Boolean(self?.contains(active));
            if (!lost) { return; }
            const back = opener.current?.isConnected ? opener.current
                : Array.from(document.querySelectorAll<HTMLElement>('.pb-card'))
                    .find(el => el.dataset.node === `${step.name}/${anchor}`)
                    ?.querySelector<HTMLElement>('.pb-node-main');
            back?.focus();
        };
    }, []);

    useLayoutEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // An open menu inside takes Escape for itself.
                if (box.current?.querySelector('[aria-expanded="true"]')) { return; }
                event.preventDefault();
                onCancel();
                return;
            }
            if (event.key !== 'Tab' || !box.current) { return; }
            const stops = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (stops.length === 0) { return; }
            const first = stops[0];
            const last = stops[stops.length - 1];
            const at = document.activeElement;
            if (event.shiftKey && (at === first || !box.current.contains(at))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (at === last || !box.current.contains(at))) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);

    // The note goes with the value: only a skill hook has one.
    const pick = (type: HookType) => {
        setHookType(type); setValue(''); setNote(''); setActive(0);
    };

    /** Arrows, Home and End move the kind, the way a radio group does. */
    const pickKind = (event: KeyboardEvent, index: number) => {
        const by = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
        const to = by !== undefined
            ? (index + by + KINDS.length) % KINDS.length
            : event.key === 'Home' ? 0
                : event.key === 'End' ? KINDS.length - 1 : -1;
        if (to < 0) { return; }
        event.preventDefault();
        pick(KINDS[to].type);
        const group = (event.currentTarget as HTMLElement).parentElement;
        (group?.children[to] as HTMLButtonElement | undefined)?.focus();
    };

    const submit = (event?: Event) => {
        event?.preventDefault();
        if (!ready) { return; }
        // An index belongs to the anchor it was read from, so a new place is a move.
        const moved = Boolean(editing)
            && (where !== placeOf(editing!.anchor) || when !== editing?.when);
        onAttach({
            anchor: place?.anchor ?? editing?.anchor ?? anchor,
            boundary: place?.boundary ?? boundaryOf(step, editing?.anchor ?? anchor),
            when, hookType, value: chosen, note: note.trim(),
            editIndex: moved ? undefined : editing?.index,
            movedFrom: moved && editing
                ? { anchor: editing.anchor, when: editing.when, index: editing.index }
                : undefined,
        }, keep && !editing);
        if (keep && !editing) {
            setAdded(current?.label ?? chosen);
            setValue(''); setNote(''); setActive(0);
            field.current?.focus();
        }
    };

    const onSearchKey = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (rows.length === 0) { return; }
            const by = event.key === 'ArrowDown' ? 1 : -1;
            setActive(at => (Math.min(Math.max(at, 0), rows.length - 1) + by + rows.length) % rows.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    };

    const search = (
        <div class="pb-modal-search">
            <svg class="pb-modal-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                aria-hidden="true" focusable="false">
                <circle cx="6" cy="6" r="4.25" />
                <path d="M9.5 9.5L12.5 12.5" />
            </svg>
            <input ref={field} class="pb-modal-input" type="text" value={value}
                role="combobox" aria-expanded={rows.length > 0} aria-autocomplete="list"
                aria-controls={listId} aria-label={kind.field}
                aria-activedescendant={current ? optionId(rows.indexOf(current)) : undefined}
                placeholder={kind.placeholder} autocomplete="off" spellcheck={false}
                onInput={e => { setValue((e.target as HTMLInputElement).value); setActive(0); setAdded(''); }}
                onKeyDown={onSearchKey} />
        </div>
    );

    const kinds = (
        <div class="pb-modal-kinds" role="radiogroup" aria-label="Kind">
            {KINDS.map((option, index) => (
                <button key={option.type} type="button" role="radio"
                    aria-checked={hookType === option.type}
                    aria-label={option.label}
                    tabIndex={hookType === option.type ? 0 : -1}
                    class={`pb-modal-kind${hookType === option.type ? ' pb-modal-kind--on' : ''}`}
                    onKeyDown={event => pickKind(event, index)}
                    onClick={() => { pick(option.type); setTimeout(() => field.current?.focus(), 0); }}>
                    <HookIcon type={option.type} />
                    <span class="pb-modal-kind-long">{option.label}</span>
                    <span class="pb-modal-kind-short" aria-hidden="true">{option.short}</span>
                </button>
            ))}
        </div>
    );

    const title = editing ? 'Edit hook' : `Add ${when} ${placeLabel}`;

    return (
        <div class="pb-modal-layer">
            <div class="pb-modal-scrim" aria-hidden="true" onClick={onCancel} />
            <div ref={box} class="pb-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <span class="pb-sheet-grip pb-modal-grip" aria-hidden="true" />
                <p class="pb-modal-added" role="status" aria-live="polite">
                    {added && (
                        <>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                                stroke-linejoin="round" aria-hidden="true" focusable="false">
                                <path d="M2 6.5L4.75 9L10 3.5" />
                            </svg>
                            {`Added ${added}`}
                        </>
                    )}
                </p>
                <header class="pb-modal-head">
                    <div class="pb-modal-heading">
                        <h2 class="pb-modal-title" id={titleId}>{title}</h2>
                        <p class="pb-modal-where">
                            {editing ? `${when} ${placeLabel} · ` : ''}in {step.name}
                        </p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Close" onClick={onCancel}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>

                <form class="pb-modal-form" onSubmit={submit}>
                    <div class="pb-modal-body">
                        {searching ? <>{search}{kinds}</> : kinds}
                        {searching && rows.length > 0 && (
                            <ul class="pb-modal-results" id={listId} role="listbox"
                                aria-label={hookType === 'skill' ? 'Skills' : 'Node files'}>
                                {rows.map((row, index) => {
                                    const on = row === current;
                                    return (
                                        <li key={`${row.unknown ? 'typed' : 'known'}-${row.id}`}
                                            id={optionId(index)} role="option" aria-selected={on}
                                            class={`pb-modal-row${on ? ' pb-modal-row--on' : ''}`}
                                            onMouseDown={event => event.preventDefault()}
                                            onClick={() => { setActive(index); if (!query) { setValue(row.id); } }}
                                            onDblClick={() => submit()}>
                                            <HookIcon type={hookType} />
                                            <span class="pb-modal-row-text">
                                                <span class="pb-modal-row-name">
                                                    <Marked text={row.label} query={query} />
                                                </span>
                                                {row.note && (
                                                    <span class={`pb-modal-row-note${row.warn
                                                        ? ' pb-modal-row-note--warn' : ''}`}>
                                                        {row.note}
                                                    </span>
                                                )}
                                            </span>
                                            {on && <span class="pb-modal-row-enter" aria-hidden="true">Enter adds</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {searching && known.length === 0 && !query && (
                            <p class="pb-modal-hint">
                                {hookType === 'skill' ? 'No skills found in this project' : 'No node files in this project'} · type a name
                            </p>
                        )}
                        {hookType === 'skill' && choices.pluginsRead === false && (
                            <p class="pb-modal-hint">Plugin skills could not be read, so they are not listed.</p>
                        )}
                        {hookType === 'prompt' && (
                            <div class="pb-modal-pick">
                                <textarea ref={field} class="pb-modal-area" rows={4} value={value}
                                    aria-label={kind.field} placeholder={kind.placeholder}
                                    onInput={e => { setValue((e.target as HTMLTextAreaElement).value); setAdded(''); }} />
                                {commands.length > 0 && (
                                    <Menu
                                        class="pb-pick-open"
                                        align="right"
                                        trigger="Choose…"
                                        label="Ask for a command this project has"
                                        title="Commands this project's extensions registered"
                                        options={commands.map(entry => ({
                                            id: entry.id,
                                            label: entry.label,
                                            note: [entry.note,
                                                entry.usually && `usually ${entry.usually}`,
                                                entry.from && `from ${entry.from}`]
                                                .filter(Boolean).join(' · ') || undefined,
                                        }))}
                                        onPick={id => setValue(`Run \`/${id}\` now.`)} />
                                )}
                            </div>
                        )}
                        {hookType === 'command' && (
                            <input ref={field} class="pb-modal-input pb-modal-input--mono pb-modal-line"
                                type="text" value={value} aria-label={kind.field}
                                placeholder={kind.placeholder} spellcheck={false}
                                onInput={e => { setValue((e.target as HTMLInputElement).value); setAdded(''); }} />
                        )}

                        <p class="pb-modal-runs">
                            <span>Runs</span>
                            <Menu class="pb-menu-trigger--field"
                                trigger={<span class="pb-trigger-text">{when}</span>}
                                label="When" title="Before the anchor, or after it"
                                options={WHENS}
                                onPick={id => setWhen(id as HookWhen)} />
                            <Menu class="pb-menu-trigger--field"
                                trigger={<span class="pb-trigger-text">{placeLabel}</span>}
                                label="Where" title="What this hook attaches to"
                                options={all} onPick={setWhere} />
                        </p>

                        {editing && <Order editing={editing} count={props.count}
                            label={all.find(p => p.id === placeOf(editing.anchor))?.label
                                ?? editing.anchor}
                            onMove={props.onMove} />}

                        {hookType === 'skill' && (
                            <input class="pb-modal-input pb-modal-note" type="text" value={note}
                                aria-label="Note to the assistant (optional)"
                                placeholder="Note to the assistant (optional)"
                                onInput={e => setNote((e.target as HTMLInputElement).value)} />
                        )}

                        {searching && rows.length > 0 && (
                            <p class="pb-modal-hint">Up and down move · Enter adds · Esc closes</p>
                        )}
                    </div>

                    <footer class="pb-modal-foot">
                        {editing ? (
                            props.onRemove && (
                                <button class="pb-action pb-action--remove" type="button"
                                    onClick={props.onRemove}>Remove</button>
                            )
                        ) : (
                            <label class="pb-modal-keep">
                                <input type="checkbox" checked={keep}
                                    onChange={e => setKeep((e.target as HTMLInputElement).checked)} />
                                Keep open to add another
                            </label>
                        )}
                        <p class="pb-live" role="status" aria-live="polite">{props.announce ?? ''}</p>
                        <button class="pb-action pb-modal-cancel" type="button" onClick={onCancel}>Cancel</button>
                        <button class="pb-action pb-action--primary" type="submit" disabled={!ready}>
                            {editing ? 'Save' : 'Add'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}

/** Where the hook sits now, among its side's hooks, and the keyboard's way to change it. */
function Order({ editing, count, label, onMove }: {
    editing: PipelineHook;
    count?: number;
    label: string;
    onMove?: (direction: 'up' | 'down') => void;
}) {
    const total = Math.max(count ?? 0, editing.index + 1);
    const first = editing.index <= 0;
    const last = editing.index >= total - 1;
    const where = `${editing.when} ${label}`;
    const move = (direction: 'up' | 'down', edge: boolean, reason: string) => (
        <button type="button" class="pb-order-move"
            aria-disabled={edge ? 'true' : undefined}
            title={edge ? reason : undefined}
            onClick={() => { if (!edge) { onMove?.(direction); } }}>
            {direction === 'up' ? 'Move up' : 'Move down'}
            {edge && <span class="sr-only">{`, ${reason[0].toLowerCase()}${reason.slice(1)}`}</span>}
        </button>
    );
    return (
        <div class="pb-order">
            <span class="pb-order-place">{`${editing.index + 1} of ${total} ${where}`}</span>
            {move('up', first, `Already first ${where}`)}
            {move('down', last, `Already last ${where}`)}
        </div>
    );
}
