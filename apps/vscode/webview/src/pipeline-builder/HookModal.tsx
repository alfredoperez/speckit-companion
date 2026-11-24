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
    /** Which choice opens. Hook unless said. */
    mode?: AddMode;
    /** The choices offered in the first row; none, or one, draws no row. */
    modes?: AddMode[];
    /** The phase a node lands at the end of, when the opener said. */
    nodePhase?: string;
    onAddNode?: (phase: string, nodeId: string, keepOpen: boolean) => void;
    /** What a new step can be placed behind, and which steps auto runs. */
    stepForm?: StepForm;
    onNewStep?: (step: NewStep, keepOpen: boolean) => void;
    /** Replaces the title the place would give, for an opener with no lane. */
    title?: string;
}

export type AddMode = 'hook' | 'node' | 'step';

export interface NewStep { name: string; label: string; after: string; writes: string }

export interface StepForm {
    /** Steps a new one can run behind, in run order. */
    sequence: string[];
    /** Every step name already in use. */
    taken: string[];
    after?: string;
    /** The steps the hands-off auto command runs, or null when the project has no auto. */
    autoRuns: string[] | null;
}

const MODES: Array<{ id: AddMode; label: string }> = [
    { id: 'hook', label: 'Hook' }, { id: 'node', label: 'Node' }, { id: 'step', label: 'Step' },
];

/** What a phase made for a step with none is called; the writer refuses an empty one. */
export const FRESH_PHASE = 'new phase';

/** The last phase that does not end on a held node, since nothing can join after one. */
export function defaultPhase(step: PipelineStep): string {
    const open = [...step.phases].reverse().find(p => !p.nodes[p.nodes.length - 1]?.pinned);
    return open?.name ?? step.phases[step.phases.length - 1]?.name ?? FRESH_PHASE;
}

/** What a hands-off run will and will not do with a step added after `after`. */
export function autoWarning(autoRuns: string[], after: string): { title: string; body: string } {
    const last = autoRuns[autoRuns.length - 1];
    return {
        title: after && after === last
            ? 'The hands-off auto command stops before it'
            : 'The hands-off auto command will not run it',
        body: `Auto runs ${autoRuns[0]} through ${last}. A step you add runs only when you start it.`,
    };
}

/** The same rule the writer applies, said before it is asked. */
export function stepNameProblem(name: string, taken: string[]): string {
    if (!name) { return ''; }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) { return 'Lowercase letters, digits and dashes — it becomes a command.'; }
    return taken.includes(name) ? `There is already a step called ${name}.` : '';
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
    const modes = editing ? [] : props.modes ?? [];
    const [mode, setMode] = useState<AddMode>(editing ? 'hook' : props.mode ?? 'hook');
    const [nodeQuery, setNodeQuery] = useState('');
    const [nodeActive, setNodeActive] = useState(0);
    const [nodePhase, setNodePhase] = useState(props.nodePhase ?? defaultPhase(step));
    const form = props.stepForm;
    const [stepName, setStepName] = useState('');
    const [stepLabel, setStepLabel] = useState('');
    const [stepAfter, setStepAfter] = useState(
        form?.after ?? form?.sequence[form.sequence.length - 1] ?? '');
    const [stepWrites, setStepWrites] = useState('');

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

    /** The first thing to type in, whichever choice is showing. */
    function focusField() {
        (field.current ?? box.current?.querySelector<HTMLElement>(
            '.pb-modal-body input, .pb-modal-body textarea'))?.focus();
    }

    const offers: Row[] = step.dropped.map(id => ({
        id,
        label: step.offers[id]?.name || id,
        note: [step.addOns.includes(id) ? 'Shipped, optional' : 'Removed from this run',
            step.offers[id]?.summary].filter(Boolean).join(' · '),
    }));
    const nodeText = nodeQuery.trim().toLowerCase();
    const nodeRows = offers.filter(row => !nodeText || row.id.toLowerCase().includes(nodeText)
        || row.label.toLowerCase().includes(nodeText)
        || (row.note ?? '').toLowerCase().includes(nodeText));
    const nodeCurrent = nodeRows[Math.min(Math.max(nodeActive, 0), nodeRows.length - 1)] ?? null;
    const phaseNames = step.phases.length ? step.phases.map(p => p.name) : [FRESH_PHASE];
    const cleanName = stepName.trim();
    const stepProblem = stepNameProblem(cleanName, form?.taken ?? []);
    const canAdd = mode === 'hook' ? ready
        : mode === 'node' ? Boolean(nodeCurrent)
            : Boolean(cleanName) && !stepProblem;

    const switchMode = (next: AddMode) => {
        setMode(next);
        setAdded('');
        setTimeout(focusField, 0);
    };

    const pickMode = (event: KeyboardEvent, index: number) => {
        const by = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
        if (by === undefined) { return; }
        event.preventDefault();
        const shown = MODES.filter(m => modes.includes(m.id));
        const to = (index + by + shown.length) % shown.length;
        setMode(shown[to].id);
        setAdded('');
        const group = (event.currentTarget as HTMLElement).parentElement;
        (group?.children[to] as HTMLButtonElement | undefined)?.focus();
    };

    const submitNode = () => {
        if (!nodeCurrent) { return; }
        props.onAddNode?.(nodePhase, nodeCurrent.id, keep);
        if (keep) { setAdded(nodeCurrent.label); setNodeQuery(''); setNodeActive(0); }
    };

    const submitStep = () => {
        if (!cleanName || stepProblem) { return; }
        props.onNewStep?.({
            name: cleanName, label: stepLabel.trim(), after: stepAfter, writes: stepWrites.trim(),
        }, keep);
        if (keep) { setAdded(cleanName); setStepName(''); setStepLabel(''); setStepWrites(''); }
    };

    useLayoutEffect(() => {
        const was = document.activeElement as HTMLElement | null;
        opener.current = was && was !== document.body ? was : null;
        focusField();
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
                if (box.current?.querySelector('[aria-haspopup][aria-expanded="true"]')) { return; }
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
        if (mode === 'node') { submitNode(); return; }
        if (mode === 'step') { submitStep(); return; }
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

    const title = editing ? 'Edit hook'
        : props.title ?? (modes.length > 1 ? `Add to ${step.name}` : `Add ${when} ${placeLabel}`);
    const subtitle = editing ? `${when} ${placeLabel} · in ${step.name}`
        : mode === 'node' ? 'Choose what to add. It goes at the end of its phase; drag it after.'
            : mode === 'step' ? 'A step is a new lane with its own phases.'
                : modes.length > 1 ? `Runs ${when} ${placeLabel}, or anywhere you pick below.`
                    : `in ${step.name}`;

    const modeRow = modes.length > 1 && (
        <div class="pb-modal-modes" role="radiogroup" aria-label="What to add">
            {MODES.filter(m => modes.includes(m.id)).map((option, index) => (
                <button key={option.id} type="button" role="radio" aria-checked={mode === option.id}
                    tabIndex={mode === option.id ? 0 : -1}
                    class={`pb-modal-mode${mode === option.id ? ' pb-modal-mode--on' : ''}`}
                    onKeyDown={event => pickMode(event, index)}
                    onClick={() => switchMode(option.id)}>
                    {option.label}
                </button>
            ))}
        </div>
    );

    const nodeListId = `${listId}-nodes`;
    const nodePanel = (
        <>
            {offers.length > 0 ? (
                <>
                    <div class="pb-modal-search">
                        <svg class="pb-modal-search-icon" width="14" height="14" viewBox="0 0 14 14"
                            fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                            aria-hidden="true" focusable="false">
                            <circle cx="6" cy="6" r="4.25" />
                            <path d="M9.5 9.5L12.5 12.5" />
                        </svg>
                        <input class="pb-modal-input" type="text" value={nodeQuery}
                            role="combobox" aria-expanded={nodeRows.length > 0}
                            aria-autocomplete="list" aria-controls={nodeListId}
                            aria-label="Search nodes on offer" placeholder="Search nodes on offer"
                            aria-activedescendant={nodeCurrent
                                ? `${nodeListId}-${nodeRows.indexOf(nodeCurrent)}` : undefined}
                            autocomplete="off" spellcheck={false}
                            onInput={e => {
                                setNodeQuery((e.target as HTMLInputElement).value);
                                setNodeActive(0); setAdded('');
                            }}
                            onKeyDown={event => {
                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    if (nodeRows.length === 0) { return; }
                                    const by = event.key === 'ArrowDown' ? 1 : -1;
                                    setNodeActive(at => (Math.min(Math.max(at, 0), nodeRows.length - 1)
                                        + by + nodeRows.length) % nodeRows.length);
                                } else if (event.key === 'Enter') {
                                    event.preventDefault();
                                    submitNode();
                                }
                            }} />
                    </div>
                    <p class="pb-modal-section">On offer for {step.name}</p>
                    {nodeRows.length > 0 ? (
                        <ul class="pb-modal-results" id={nodeListId} role="listbox"
                            aria-label={`Nodes on offer for ${step.name}`}>
                            {nodeRows.map((row, index) => {
                                const on = row === nodeCurrent;
                                return (
                                    <li key={row.id} id={`${nodeListId}-${index}`} role="option"
                                        aria-selected={on}
                                        class={`pb-modal-row${on ? ' pb-modal-row--on' : ''}`}
                                        onMouseDown={event => event.preventDefault()}
                                        onClick={() => setNodeActive(index)}
                                        onDblClick={submitNode}>
                                        <HookIcon type="node" />
                                        <span class="pb-modal-row-text">
                                            <span class="pb-modal-row-name">
                                                <Marked text={row.label} query={nodeQuery.trim()} />
                                            </span>
                                            {row.note && <span class="pb-modal-row-note">{row.note}</span>}
                                        </span>
                                        <span class="pb-modal-row-id">{row.id}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p class="pb-modal-hint">No node on offer matches that.</p>
                    )}
                    <p class="pb-modal-runs">
                        <span>Goes at the end of</span>
                        <Menu class="pb-menu-trigger--field"
                            trigger={<span class="pb-trigger-text">{nodePhase}</span>}
                            label="Phase" title="The phase the node joins, at its end"
                            options={phaseNames.map(name => ({ id: name, label: name }))}
                            onPick={setNodePhase} />
                    </p>
                    <p class="pb-modal-hint">
                        Only shipped optional nodes and ones removed from this run are on offer.
                    </p>
                </>
            ) : (
                <p class="pb-modal-hint pb-modal-empty">
                    Every node {step.name} has is already in a phase. Write your own at{' '}
                    <span class="pb-mono">.specify/companion/nodes/{step.name}/</span> and it is
                    offered here.
                </p>
            )}
        </>
    );

    const runsAfter = form ? [
        ...form.sequence.map((name, at) => ({ id: name, label: `${at + 1} ${name}` })),
        { id: '', label: 'Nothing, I launch it myself' },
    ] : [];
    const warning = form?.autoRuns?.length ? autoWarning(form.autoRuns, stepAfter) : null;
    const stepPanel = form && (
        <div class="pb-modal-fields">
            <label class="pb-modal-field pb-modal-field--wide">
                <span class="pb-modal-field-label">Name</span>
                <input class="pb-modal-text" type="text" value={stepName} placeholder="review"
                    spellcheck={false} aria-invalid={stepProblem ? 'true' : undefined}
                    onInput={e => { setStepName((e.target as HTMLInputElement).value); setAdded(''); }} />
                {stepProblem && <span class="pb-field-problem">{stepProblem}</span>}
            </label>
            <label class="pb-modal-field pb-modal-field--wide">
                <span class="pb-modal-field-label">Display name</span>
                <input class="pb-modal-text" type="text" value={stepLabel}
                    placeholder={cleanName ? `${cleanName[0].toUpperCase()}${cleanName.slice(1)}` : 'Review'}
                    onInput={e => setStepLabel((e.target as HTMLInputElement).value)} />
                <span class="pb-modal-field-note">Taken from the name unless you write something here.</span>
            </label>
            <div class="pb-modal-field">
                <span class="pb-modal-field-label" id={`${listId}-after`}>Runs after</span>
                <Menu class="pb-menu-trigger--field pb-modal-select"
                    trigger={<span class="pb-trigger-text">
                        {runsAfter.find(o => o.id === stepAfter)?.label ?? stepAfter}
                    </span>}
                    label={`Runs after: ${runsAfter.find(o => o.id === stepAfter)?.label ?? stepAfter}`}
                    title="The step this one runs behind"
                    options={runsAfter} onPick={setStepAfter} />
            </div>
            <label class="pb-modal-field">
                <span class="pb-modal-field-label">Writes</span>
                <input class="pb-modal-text pb-modal-text--mono" type="text" value={stepWrites}
                    placeholder="review.md" spellcheck={false}
                    onInput={e => setStepWrites((e.target as HTMLInputElement).value)} />
            </label>
            <p class="pb-modal-field-note pb-modal-field--wide">
                Several files go in brackets: <span class="pb-mono">[review.md, notes.md]</span>;
                leave it empty if the step writes nothing. It writes{' '}
                <span class="pb-mono">.specify/companion/nodes/{cleanName || 'name'}/</span> with one
                node to edit, and after the next build the assistant can run{' '}
                <span class="pb-mono">/speckit.companion.{cleanName || 'name'}</span>.
            </p>
            {warning && (
                <div class="pb-modal-warning pb-modal-field--wide" role="note">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                        aria-hidden="true" focusable="false">
                        <path d="M7 1.8L12.6 11.8H1.4Z" />
                        <path d="M7 5.5V8.2" />
                        <circle cx="7" cy="10" r="0.6" fill="currentColor" />
                    </svg>
                    <span class="pb-modal-warning-text">
                        <strong class="pb-modal-warning-title">{warning.title}</strong>
                        <span>{warning.body}</span>
                    </span>
                </div>
            )}
        </div>
    );

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
                        <p class="pb-modal-where">{subtitle}</p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Close" onClick={onCancel}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>

                <form class="pb-modal-form" onSubmit={submit}>
                    <div class="pb-modal-body">
                        {modeRow}
                        {mode === 'node' && nodePanel}
                        {mode === 'step' && stepPanel}
                        {mode === 'hook' && <>
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
                        </>}
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
                        <button class="pb-action pb-action--primary" type="submit" disabled={!canAdd}>
                            {editing ? 'Save' : mode === 'node' ? 'Add node'
                                : mode === 'step' ? 'Add step' : 'Add'}
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
