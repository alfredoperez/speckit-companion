/**
 * Attaching work, in the panel.
 *
 * This was a VS Code quick-pick and two input boxes, which covered the thing you
 * were pointing at and made the panel a launcher for someone else's dialogs. It
 * also meant the view could only ever run inside the editor. Everything is
 * collected here now, in the panel's own chrome.
 */

import { useState } from 'preact/hooks';
import { Menu } from './Menu';
import {
    HookType, HookWhen, PipelineChoices, PipelineHook, PipelinePreset, PipelineStep,
} from '../../../src/protocol/pipeline';

export interface Attachment {
    anchor: string;
    when: HookWhen;
    hookType: HookType;
    value: string;
    note: string;
    /** Set when this replaces a hook rather than adding one. */
    editIndex?: number;
}

interface Props {
    step: PipelineStep;
    /** The phase or node the button was pressed on. */
    anchor: string;
    /** What this project can point a hook at, so a name is picked not typed. */
    choices: PipelineChoices;
    /** The hook being changed, when this is an edit rather than an addition. */
    editing?: PipelineHook | null;
    onCancel: () => void;
    onAttach: (attachment: Attachment) => void;
    onRemove?: () => void;
}

/** The four things a hook can be; `field` names the value box a segment cannot. */
const KINDS: Array<{
    type: HookType; label: string; field: string; help: string; placeholder: string;
}> = [
    {
        type: 'skill',
        label: 'Skill',
        field: 'Which skill',
        help: 'The instructions stay in the skill, so editing it later changes what runs.',
        placeholder: 'verify-code-review',
    },
    {
        type: 'prompt',
        label: 'Instruction',
        field: 'The instruction',
        help: 'One instruction, kept in companion.yml.',
        placeholder: 'Check the CHANGELOG is updated before continuing.',
    },
    {
        type: 'command',
        label: 'Command',
        field: 'The command',
        help: 'A shell line. The assistant needs a terminal for this one.',
        placeholder: 'npm run lint-spec',
    },
    {
        type: 'node',
        label: 'Node',
        field: 'Which node',
        help: 'A file from .specify/companion/nodes/, reusable in more than one place.',
        placeholder: 'review',
    },
];

const WHENS: Array<{ id: HookWhen; label: string; note: string }> = [
    { id: 'before', label: 'before', note: 'ahead of it, every run' },
    { id: 'after', label: 'after', note: 'once it has finished' },
];

/** Every place in this step something can attach to, in the order they run. */
function anchors(step: PipelineStep): Array<{ id: string; label: string; note: string }> {
    const out: Array<{ id: string; label: string; note: string }> = [];
    for (const phase of step.phases) {
        out.push({
            id: phase.name,
            label: `the ${phase.name} phase`,
            note: `every node in ${phase.name}`,
        });
        for (const node of phase.nodes) {
            out.push({ id: node.id, label: node.name, note: node.id });
        }
    }
    return out;
}

export function AttachForm(props: Props) {
    const { step, anchor, choices, editing, onCancel, onAttach } = props;
    const [hookType, setHookType] = useState<HookType>(editing?.type ?? 'skill');
    const [value, setValue] = useState(editing?.summary ?? '');
    const [note, setNote] = useState(editing?.note ?? '');
    const [where, setWhere] = useState(editing?.anchor ?? anchor);
    const [when, setWhen] = useState<HookWhen>(editing?.when ?? 'before');

    const kind = KINDS.find(k => k.type === hookType)!;
    const places = anchors(step);
    const named = hookType === 'skill' ? choices.skills
        : hookType === 'node' ? choices.nodes : [];
    const ready = value.trim().length > 0;

    const submit = (event: Event) => {
        event.preventDefault();
        if (!ready) { return; }
        onAttach({
            anchor: where, when, hookType, value: value.trim(), note: note.trim(),
            editIndex: editing?.index,
        });
    };

    return (
        <aside class="pb-side" aria-label={editing ? 'Edit hook' : 'Add hook'}>
            <header class="pb-side-head">
                <h2 class="pb-side-title">{editing ? 'Edit hook' : 'Add hook'}</h2>
                <button class="pb-side-close" onClick={onCancel} title="Cancel">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
                <p class="pb-side-where">in <span class="pb-side-step">{step.name}</span></p>
            </header>

            <form class="pb-form" onSubmit={submit}>
                <div class="pb-form-fields">
                {/* First, so the sentence reads "runs before Draft the spec". */}
                <div class="pb-field pb-field--labelled">
                    <span class="pb-field-label">Runs</span>
                    <div class="pb-runs">
                        <span class="pb-runs-when">
                            <Menu class="pb-menu-trigger--field"
                                trigger={<span class="pb-trigger-text">{when}</span>}
                                label="When" title="Before the anchor, or after it"
                                options={WHENS}
                                onPick={id => setWhen(id as HookWhen)} />
                        </span>
                        <span class="pb-runs-where">
                            <Menu class="pb-menu-trigger--field"
                                trigger={<span class="pb-trigger-text">
                                    {places.find(p => p.id === where)?.label ?? where}
                                </span>}
                                label="Where" title="What this hook attaches to"
                                options={places} onPick={setWhere} />
                        </span>
                    </div>
                </div>

                <div class="pb-field pb-field--labelled">
                    <span class="pb-field-label" id="pb-kind-label">Kind</span>
                    <div class="pb-kind">
                        <div class="pb-segments" role="radiogroup" aria-labelledby="pb-kind-label">
                            {KINDS.map(option => (
                                <button key={option.type} type="button" role="radio"
                                    aria-checked={hookType === option.type}
                                    class={`pb-segment${hookType === option.type
                                        ? ' pb-segment--on' : ''}`}
                                    onClick={() => { setHookType(option.type); setValue(''); }}>
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {/* One line, for the kind that is on. */}
                        <span class="pb-field-note">{kind.help}</span>
                        {hookType === 'prompt' ? (
                            <textarea class="pb-input pb-input--area" rows={3} value={value}
                                aria-label={kind.field} placeholder={kind.placeholder}
                                onInput={e => setValue((e.target as HTMLTextAreaElement).value)} />
                        ) : (
                            <>
                                {/* A name typed from memory is a hook that invokes
                                    nothing. The list is what this project has; the
                                    field stays free so a new one can still be named. */}
                                <input class="pb-input pb-input--mono" type="text" value={value}
                                    aria-label={kind.field}
                                    list={named.length ? `pb-known-${hookType}` : undefined}
                                    placeholder={kind.placeholder}
                                    onInput={e => setValue((e.target as HTMLInputElement).value)} />
                                {named.length > 0 && (
                                    <datalist id={`pb-known-${hookType}`}>
                                        {named.map(name => <option key={name} value={name} />)}
                                    </datalist>
                                )}
                            </>
                        )}
                        {named.length > 0 && (
                            <span class="pb-field-help">
                                {named.length} in this project · start typing to filter
                            </span>
                        )}
                    </div>
                </div>

                {(hookType === 'skill' || hookType === 'node') && (
                    <div class="pb-field pb-field--labelled">
                        <span class="pb-field-label">Note</span>
                        <div class="pb-note">
                            <input class="pb-input" type="text" value={note}
                                aria-label="Note to the assistant (optional)"
                                placeholder="Anything the assistant should know first"
                                onInput={e => setNote((e.target as HTMLInputElement).value)} />
                            <span class="pb-field-help">optional</span>
                        </div>
                    </div>
                )}

                <p class="pb-form-preview">
                    Writes to <span class="pb-mono">companion.yml</span>. Build to apply.
                </p>
                </div>

                {/* Forward, destructive, then leaving — the panel's order. */}
                <div class="pb-form-actions">
                    <button class="pb-action pb-action--primary" type="submit" disabled={!ready}>
                        {editing ? 'Save hook' : 'Add hook'}
                    </button>
                    {editing && props.onRemove && (
                        <button class="pb-action pb-action--remove" type="button"
                            onClick={props.onRemove}>Remove</button>
                    )}
                    <button class="pb-action pb-action--quiet" type="button"
                        onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </aside>
    );
}

interface NewStepProps {
    /** Steps a new one can be placed behind, in run order. */
    sequence: string[];
    /** Every step name already in use. */
    taken: string[];
    onCancel: () => void;
    onCreate: (step: { name: string; label: string; after: string; writes: string }) => void;
}

/**
 * Add a step of the project's own.
 *
 * The board could show the steps and not change them, so a review pass had to
 * hide inside implement. A step is a directory of nodes; this writes one.
 */
export function NewStepForm({ sequence, taken, onCancel, onCreate }: NewStepProps) {
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [after, setAfter] = useState(sequence[sequence.length - 1] ?? '');
    const [writes, setWrites] = useState('');
    const clean = name.trim();

    const problem = !clean ? ''
        : !/^[a-z][a-z0-9-]*$/.test(clean)
            ? 'Lowercase letters, digits and dashes — it becomes a command.'
            : taken.includes(clean) ? `There is already a step called ${clean}.` : '';

    const submit = (event: Event) => {
        event.preventDefault();
        if (clean && !problem) {
            onCreate({ name: clean, label: label.trim(), after, writes: writes.trim() });
        }
    };

    return (
        <aside class="pb-side" aria-label="New step">
            <header class="pb-side-head">
                <h2 class="pb-side-title">New step</h2>
                <button class="pb-side-close" onClick={onCancel} title="Cancel">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
                <p class="pb-side-where">
                    A turn of its own in the run, with its own command.
                </p>
            </header>

            <form class="pb-form" onSubmit={submit}>
                <div class="pb-form-fields">
                <label class="pb-field">
                    <span class="pb-field-label">Name</span>
                    <input class="pb-input pb-input--mono" type="text" value={name} autofocus
                        placeholder="review"
                        onInput={e => setName((e.target as HTMLInputElement).value)} />
                    {problem && <span class="pb-field-problem">{problem}</span>}
                </label>

                {/* Empty is what tells the writer to derive it from the name. */}
                <label class="pb-field">
                    <span class="pb-field-label">Display name</span>
                    <input class="pb-input" type="text" value={label}
                        placeholder={clean ? `${clean[0].toUpperCase()}${clean.slice(1)}` : 'Review'}
                        onInput={e => setLabel((e.target as HTMLInputElement).value)} />
                    <span class="pb-field-note">
                        Taken from the name unless you write something here.
                    </span>
                </label>

                <label class="pb-field">
                    <span class="pb-field-label">Runs after</span>
                    <select class="pb-input" value={after}
                        onChange={e => setAfter((e.target as HTMLSelectElement).value)}>
                        {sequence.map(step => (
                            <option key={step} value={step}>{step}</option>
                        ))}
                        <option value="">Nothing — I launch it myself</option>
                    </select>
                </label>

                <label class="pb-field">
                    <span class="pb-field-label">Writes</span>
                    <input class="pb-input pb-input--mono" type="text" value={writes}
                        placeholder="review.md"
                        onInput={e => setWrites((e.target as HTMLInputElement).value)} />
                    <span class="pb-field-note">
                        Several go in brackets: <span class="pb-mono">[review.md, notes.md]</span>.
                        Leave it empty if the step writes nothing.
                    </span>
                </label>

                <p class="pb-form-preview">
                    Writes <span class="pb-mono">
                        .specify/companion/nodes/{clean || 'name'}/
                    </span> with one node to edit. After the next build the assistant can
                    run <span class="pb-mono">
                        /speckit.companion.{clean || 'name'}
                    </span>.
                </p>
                </div>

                <div class="pb-form-actions">
                    <button class="pb-action pb-action--primary" type="submit"
                        disabled={!clean || Boolean(problem)}>Add step</button>
                    <button class="pb-action pb-action--quiet" type="button"
                        onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </aside>
    );
}

interface NewWorkflowProps {
    /** The workflow in force — the default thing to start from. */
    from: string;
    taken: string[];
    /** Shipped configurations that can be started from instead. */
    presets: PipelinePreset[];
    onCancel: () => void;
    /** `seedFrom` is a workflow name, or `preset:<name>`. */
    onCreate: (name: string, seedFrom: string) => void;
}

export function NewWorkflowForm({ from, taken, presets, onCancel, onCreate }: NewWorkflowProps) {
    const [name, setName] = useState('');
    // Empty means the workflow in force, which is what "like what we run now,
    // but…" needs and what this form did before there was anything else.
    const [seed, setSeed] = useState('');
    const clean = name.trim();

    // Whole configurations, so each is read beside the others before the pick.
    const starts = [
        {
            id: '',
            label: from && from !== 'shipped'
                ? `What ${from} runs now`
                : 'The pipeline as shipped',
            help: 'Your nodes, hooks and templates as they are today.',
        },
        ...presets.map(p => ({
            id: `preset:${p.name}`, label: p.label, help: p.summary,
        })),
    ];

    const problem = !clean ? ''
        : !/^[a-z0-9][a-z0-9-]*$/.test(clean)
            ? 'Lowercase letters, digits and dashes — it becomes a filename.'
            : taken.includes(clean) ? `There is already a workflow called ${clean}.` : '';

    const submit = (event: Event) => {
        event.preventDefault();
        if (clean && !problem) { onCreate(clean, seed || from); }
    };

    return (
        <aside class="pb-side" aria-label="New workflow">
            <header class="pb-side-head">
                <h2 class="pb-side-title">New workflow</h2>
                <button class="pb-side-close" onClick={onCancel} title="Cancel">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
                <p class="pb-side-where">
                    Pick something close, then change it.
                </p>
            </header>

            <form class="pb-form" onSubmit={submit}>
                <div class="pb-form-fields">
                <label class="pb-field">
                    <span class="pb-field-label">Name</span>
                    <input class="pb-input pb-input--mono" type="text" value={name} autofocus
                        placeholder="bugfix"
                        onInput={e => setName((e.target as HTMLInputElement).value)} />
                    {problem && <span class="pb-field-problem">{problem}</span>}
                </label>

                {/* A blank file is the worst place to start and was the only
                    place to start. The presets are whole configurations, so the
                    first question becomes "which of these is closest?" */}
                <fieldset class="pb-field">
                    <legend class="pb-field-label">Start from</legend>
                    {starts.map(start => (
                        <label key={start.id}
                            class={`pb-choice ${seed === start.id ? 'pb-choice--on' : ''}`}>
                            <input type="radio" name="workflow-seed" value={start.id}
                                checked={seed === start.id}
                                onChange={() => setSeed(start.id)} />
                            <span class="pb-choice-body">
                                <span class="pb-choice-label">{start.label}</span>
                                <span class="pb-choice-help">{start.help}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                <p class="pb-form-preview">
                    Writes <span class="pb-mono">
                        .specify/companion/workflows/{clean || 'name'}.yml
                    </span> and switches to it. Your nodes and fragments stay shared.
                </p>
                </div>

                <div class="pb-form-actions">
                    <button class="pb-action pb-action--primary" type="submit"
                        disabled={!clean || Boolean(problem)}>Create</button>
                    <button class="pb-action pb-action--quiet" type="button"
                        onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </aside>
    );
}
