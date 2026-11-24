/**
 * The shared shape of a hook write, and the side-pane forms for a new step and
 * a new workflow. Adding or editing a hook happens in `HookModal`.
 */

import { useState } from 'preact/hooks';
import { SidePanel } from './SidePanel';
import { HookType, HookWhen, PipelinePreset, PipelineStep } from '../../../src/protocol/pipeline';

export interface Attachment {
    anchor: string;
    when: HookWhen;
    hookType: HookType;
    value: string;
    note: string;
    /** Set when this replaces a hook in place, at the anchor it already had. */
    editIndex?: number;
    /** Where the hook was, when the edit moved it: an index belongs to its anchor, so this is a move, not a replace. */
    movedFrom?: { anchor: string; when: HookWhen; index: number };
    /** Whether `anchor` names a node or a phase, since the two can share a name. */
    boundary: 'node' | 'phase';
}

/** A node wins a name it shares with a phase, which is the order the writer resolves it in. */
export function boundaryOf(step: PipelineStep, anchor: string): 'node' | 'phase' {
    return step.phases.some(p => p.nodes.some(n => n.id === anchor)) ? 'node' : 'phase';
}

interface NewStepProps {
    /** Steps a new one can be placed behind, in run order. */
    sequence: string[];
    /** Every step name already in use. */
    taken: string[];
    /**
     * The step this one should run behind, when the click already said where.
     *
     * A seam between two lanes IS the answer to "runs after", so arriving from
     * one should not ask again.
     */
    initialAfter?: string;
    onCancel: () => void;
    onCreate: (step: { name: string; label: string; after: string; writes: string }) => void;
}

/**
 * Add a step of the project's own.
 *
 * The board could show the steps and not change them, so a review pass had to
 * hide inside implement. A step is a directory of nodes; this writes one.
 */
export function NewStepForm({
    sequence, taken, initialAfter, onCancel, onCreate,
}: NewStepProps) {
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [after, setAfter] = useState(
        initialAfter ?? sequence[sequence.length - 1] ?? '');
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
        <SidePanel
            label="New step" title="New step"
            where="A turn of its own in the run, with its own command."
            onClose={onCancel} closeLabel="Cancel"
        >
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
        </SidePanel>
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
        <SidePanel
            label="New workflow" title="New workflow"
            where="Pick something close, then change it."
            onClose={onCancel} closeLabel="Cancel"
        >
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
        </SidePanel>
    );
}
