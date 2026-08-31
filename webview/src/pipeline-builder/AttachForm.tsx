/**
 * Attaching work, in the panel.
 *
 * This was a VS Code quick-pick and two input boxes, which covered the thing you
 * were pointing at and made the panel a launcher for someone else's dialogs. It
 * also meant the view could only ever run inside the editor. Everything is
 * collected here now, in the panel's own chrome.
 */

import { useState } from 'preact/hooks';
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

const KINDS: Array<{ type: HookType; label: string; help: string; placeholder: string }> = [
    {
        type: 'skill',
        label: 'Run a skill you already have',
        help: 'The instructions stay in the skill, so editing it later changes what runs.',
        placeholder: 'verify-code-review',
    },
    {
        type: 'prompt',
        label: 'Say something to the assistant',
        help: 'One instruction, kept in companion.yml.',
        placeholder: 'Check the CHANGELOG is updated before continuing.',
    },
    {
        type: 'command',
        label: 'Run a command',
        help: 'A shell line. The assistant needs a terminal for this one.',
        placeholder: 'npm run lint-spec',
    },
    {
        type: 'node',
        label: 'Include one of your nodes',
        help: 'A file from .specify/companion/nodes/, reusable in more than one place.',
        placeholder: 'review',
    },
];

/** Every place in this step something can attach to, in the order they run. */
function anchors(step: PipelineStep): Array<{ id: string; label: string }> {
    const out: Array<{ id: string; label: string }> = [];
    for (const phase of step.phases) {
        out.push({ id: phase.name, label: `the ${phase.name} phase` });
        for (const node of phase.nodes) {
            out.push({ id: node.id, label: `${node.name} (${node.id})` });
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
                <fieldset class="pb-field">
                    <legend class="pb-field-label">What should happen</legend>
                    {KINDS.map(option => (
                        <label key={option.type}
                            class={`pb-choice ${hookType === option.type ? 'pb-choice--on' : ''}`}>
                            <input type="radio" name="hook-type" value={option.type}
                                checked={hookType === option.type}
                                onChange={() => { setHookType(option.type); setValue(''); }} />
                            <span class="pb-choice-body">
                                <span class="pb-choice-label">{option.label}</span>
                                <span class="pb-choice-help">{option.help}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                <label class="pb-field">
                    <span class="pb-field-label">
                        {hookType === 'skill' ? 'Which skill'
                            : hookType === 'node' ? 'Which node'
                                : hookType === 'command' ? 'The command' : 'The instruction'}
                    </span>
                    {hookType === 'prompt' ? (
                        <textarea class="pb-input pb-input--area" rows={3} value={value}
                            placeholder={kind.placeholder}
                            onInput={e => setValue((e.target as HTMLTextAreaElement).value)} />
                    ) : (
                        <>
                            {/* A name typed from memory is a hook that invokes
                                nothing. The list is what this project has; the
                                field stays free so a new one can still be named. */}
                            <input class="pb-input pb-input--mono" type="text" value={value}
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
                            {named.length} in this project — start typing to filter
                        </span>
                    )}
                </label>

                {hookType === 'skill' && (
                    <label class="pb-field">
                        <span class="pb-field-label">Anything to add <span class="pb-optional">optional</span></span>
                        <input class="pb-input" type="text" value={note}
                            placeholder="Leave empty to just invoke the skill"
                            onInput={e => setNote((e.target as HTMLInputElement).value)} />
                    </label>
                )}

                <div class="pb-field pb-field--row pb-field--place">
                    <label class="pb-field">
                        <span class="pb-field-label">When</span>
                        <select class="pb-input" value={when}
                            onChange={e => setWhen((e.target as HTMLSelectElement).value as HookWhen)}>
                            <option value="before">before</option>
                            <option value="after">after</option>
                        </select>
                    </label>
                    <label class="pb-field pb-field--grow">
                        <span class="pb-field-label">Where</span>
                        <select class="pb-input" value={where}
                            onChange={e => setWhere((e.target as HTMLSelectElement).value)}>
                            {places.map(place => (
                                <option key={place.id} value={place.id}>{place.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <p class="pb-form-preview">
                    Adds to <span class="pb-mono">companion.yml</span>. You will still need to build.
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

                <label class="pb-field">
                    <span class="pb-field-label">Reads as</span>
                    <input class="pb-input" type="text" value={label}
                        placeholder={clean ? `${clean[0].toUpperCase()}${clean.slice(1)}` : 'Review'}
                        onInput={e => setLabel((e.target as HTMLInputElement).value)} />
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
                        placeholder="review.md — leave empty if it writes nothing"
                        onInput={e => setWrites((e.target as HTMLInputElement).value)} />
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
                    <button class="pb-action" type="button" onClick={onCancel}>Cancel</button>
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
    const preset = seed.startsWith('preset:')
        ? presets.find(p => p.name === seed.slice('preset:'.length))
        : undefined;

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
                <label class="pb-field">
                    <span class="pb-field-label">Start from</span>
                    <select class="pb-input" value={seed}
                        onChange={e => setSeed((e.target as HTMLSelectElement).value)}>
                        <option value="">
                            {from === 'shipped' || !from
                                ? 'The pipeline as it ships'
                                : `What ${from} runs now`}
                        </option>
                        {presets.length > 0 && (
                            <optgroup label="A preset">
                                {presets.map(p => (
                                    <option key={p.name} value={`preset:${p.name}`}
                                        title={p.summary}>{p.label}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    {preset && <span class="pb-field-note">{preset.summary}</span>}
                </label>

                <p class="pb-form-preview">
                    Writes <span class="pb-mono">
                        .specify/companion/workflows/{clean || 'name'}.yml
                    </span> and switches to it. Your nodes and fragments stay shared.
                </p>
                </div>

                <div class="pb-form-actions">
                    <button class="pb-action pb-action--primary" type="submit"
                        disabled={!clean || Boolean(problem)}>Create</button>
                    <button class="pb-action" type="button" onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </aside>
    );
}
