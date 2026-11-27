// A new workflow: a name, and what it starts from. Nothing builds until Build.
import { useRef, useState } from 'preact/hooks';
import { PipelinePreset } from '../../../src/protocol/pipeline';
import { useModal } from './useModal';

interface Props {
    /** Workflow names already in use, `shipped` among them. */
    taken: string[];
    /** Whether the project has its own companion.yml to copy. */
    hasProject: boolean;
    /** The workflow in force, offered as a start when it is a saved one. */
    active: string;
    presets: PipelinePreset[];
    onCancel: () => void;
    /** `from` is `shipped`, `this`, a saved workflow, or `preset:<name>`, as the writer reads it. */
    onCreate: (name: string, from: string) => void;
}

const NAME = /^[a-z0-9][a-z0-9-]*$/;

export function NewWorkflowModal({ taken, hasProject, active, presets, onCancel, onCreate }: Props) {
    const box = useRef<HTMLDivElement>(null);
    const saved = active && active !== 'shipped' ? active : '';
    const [name, setName] = useState('');
    const [from, setFrom] = useState(saved || (hasProject ? 'this' : 'shipped'));
    useModal(box, onCancel, 'input');

    const clean = name.trim();
    const problem = !clean ? ''
        : !NAME.test(clean) ? 'Lowercase letters, digits and dashes: it becomes a filename.'
            : taken.includes(clean) ? `There is already a workflow called ${clean}.` : '';
    const starts = [
        { id: 'shipped', label: 'Shipped', trail: 'nothing changed', note: '' },
        ...(hasProject ? [{ id: 'this', label: 'This project', trail: 'a copy of yours', note: '' }] : []),
        ...(saved ? [{ id: saved, label: saved, trail: 'a copy of it', note: 'The workflow in force' }] : []),
        ...presets.map(p => ({ id: `preset:${p.name}`, label: p.label, trail: 'preset', note: p.summary })),
    ];

    const submit = (event: Event) => {
        event.preventDefault();
        if (clean && !problem) { onCreate(clean, from); }
    };

    return (
        <div class="pb-modal-layer">
            <div class="pb-modal-scrim" aria-hidden="true" onClick={onCancel} />
            <div ref={box} class="pb-modal pb-nw" role="dialog" aria-modal="true"
                aria-labelledby="pb-nw-title">
                <span class="pb-sheet-grip pb-modal-grip" aria-hidden="true" />
                <header class="pb-modal-head">
                    <div class="pb-modal-heading">
                        <h2 class="pb-modal-title" id="pb-nw-title">New workflow</h2>
                        <p class="pb-modal-where">
                            Saved in <span class="pb-dm-mono">.specify/companion/workflows/</span>
                        </p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Cancel" onClick={onCancel}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>
                <form class="pb-modal-form" onSubmit={submit}>
                    <div class="pb-nw-body">
                        <label class="pb-nw-field">
                            <span class="pb-nw-label">Name</span>
                            <input class="pb-nw-input" type="text" value={name} placeholder="bugfix"
                                aria-invalid={problem ? 'true' : undefined}
                                aria-describedby={problem ? 'pb-nw-problem' : undefined}
                                onInput={e => setName((e.target as HTMLInputElement).value)} />
                            {problem && <span class="pb-field-problem" id="pb-nw-problem">{problem}</span>}
                        </label>
                        <fieldset class="pb-nw-starts">
                            <legend class="pb-nw-label">Start from</legend>
                            {starts.map(start => (
                                <label key={start.id} title={start.note || undefined}
                                    class={`pb-nw-start${from === start.id ? ' pb-nw-start--on' : ''}`}>
                                    <input class="pb-nw-radio" type="radio" name="pb-nw-from"
                                        value={start.id} checked={from === start.id}
                                        onChange={() => setFrom(start.id)} />
                                    <span class="pb-nw-start-text">
                                        <span class="pb-nw-start-label">{start.label}</span>
                                        {start.note && <span class="sr-only">{`, ${start.note}`}</span>}
                                    </span>
                                    <span class="pb-nw-start-trail">{start.trail}</span>
                                </label>
                            ))}
                        </fieldset>
                    </div>
                    <footer class="pb-modal-foot">
                        <p class="pb-dm-foot-note">Nothing builds until Build</p>
                        <button type="button" class="pb-action pb-modal-cancel" onClick={onCancel}>Cancel</button>
                        <button type="submit" class="pb-action pb-action--primary"
                            disabled={!clean || Boolean(problem)}>Create</button>
                    </footer>
                </form>
            </div>
        </div>
    );
}
