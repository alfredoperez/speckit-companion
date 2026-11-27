// Adding or changing a hook of your own on a stock step: what stock Spec Kit's registry can hold, and nothing more.
import { useRef, useState } from 'preact/hooks';
import { HookWhen, StockHookDraft, StockHookRow } from '../../../src/protocol/pipeline';
import { useModal } from './useModal';
import { AddedLine, WriteAnswer } from './AddedLine';

interface Props {
    /** The registry step the hook goes under, such as `plan`. */
    step: string;
    /** What the card is called, such as "Plan the work". */
    label: string;
    when: HookWhen;
    /** The person's own hook being changed, when this is an edit. */
    editing?: StockHookRow | null;
    onCancel: () => void;
    onSave: (hook: StockHookDraft, keepOpen: boolean) => void;
    onRemove?: () => void;
    /** How the write behind a kept-open addition answered. */
    answer?: WriteAnswer;
}

/** The writer's own rule, said before it is asked. */
const COMMAND_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

export function commandProblem(command: string): string {
    const clean = command.trim();
    if (!clean || COMMAND_NAME.test(clean)) { return ''; }
    return 'A skill or command name: letters, digits and . _ : / - only.';
}

export function StockHookModal({ step, label, when, editing, onCancel, onSave, onRemove, answer }: Props) {
    const box = useRef<HTMLDivElement>(null);
    const [command, setCommand] = useState(editing?.command ?? '');
    const [description, setDescription] = useState(editing?.description ?? '');
    const [optional, setOptional] = useState(editing?.optional ?? false);
    const [prompt, setPrompt] = useState(editing?.prompt ?? '');
    const [keep, setKeep] = useState(false);
    const [added, setAdded] = useState('');
    useModal(box, onCancel, 'input');

    const problem = commandProblem(command);
    const ready = Boolean(command.trim() && description.trim() && !problem);
    const id = `pb-sh-${step}-${when}`;

    const submit = (event: Event) => {
        event.preventDefault();
        if (!ready) { return; }
        const draft: StockHookDraft = {
            command: command.trim(),
            description: description.trim(),
            optional,
            ...(optional && prompt.trim() ? { prompt: prompt.trim() } : {}),
        };
        onSave(draft, keep && !editing);
        if (keep && !editing) {
            setAdded(draft.command);
            setCommand(''); setDescription(''); setPrompt('');
            box.current?.querySelector<HTMLInputElement>('input')?.focus();
        }
    };

    return (
        <div class="pb-modal-layer">
            <div class="pb-modal-scrim" aria-hidden="true" onClick={onCancel} />
            <div ref={box} class="pb-modal pb-sh" role="dialog" aria-modal="true"
                aria-labelledby={`${id}-title`}>
                <span class="pb-sheet-grip pb-modal-grip" aria-hidden="true" />
                <AddedLine pending={added} answer={answer} />
                <header class="pb-modal-head">
                    <div class="pb-modal-heading">
                        <h2 class="pb-modal-title" id={`${id}-title`}>
                            {editing ? 'Edit your hook' : `Add ${when} ${label}`}
                        </h2>
                        <p class="pb-modal-where">
                            {editing ? `${when} ${label} · in ${step}` : `in ${step}`}
                        </p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Close" onClick={onCancel}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>
                <form class="pb-modal-form" onSubmit={submit}>
                    <div class="pb-modal-body pb-modal-fields">
                        <label class="pb-modal-field pb-modal-field--wide">
                            <span class="pb-modal-field-label">Skill or command</span>
                            <input class="pb-modal-text pb-modal-text--mono" type="text" value={command}
                                placeholder="house-note" spellcheck={false} autocomplete="off"
                                aria-invalid={problem ? 'true' : undefined}
                                aria-describedby={problem ? `${id}-problem` : undefined}
                                onInput={e => { setCommand((e.target as HTMLInputElement).value); setAdded(''); }} />
                            {problem && <span class="pb-field-problem" id={`${id}-problem`}>{problem}</span>}
                        </label>
                        <label class="pb-modal-field pb-modal-field--wide">
                            <span class="pb-modal-field-label">What it does</span>
                            <input class="pb-modal-text" type="text" value={description}
                                placeholder="Write a house note after the plan"
                                onInput={e => setDescription((e.target as HTMLInputElement).value)} />
                        </label>
                        <div class="pb-modal-field pb-modal-field--wide">
                            <span class="pb-modal-field-label" id={`${id}-asks`}>When it runs</span>
                            <div class="pb-sh-asks" role="radiogroup" aria-labelledby={`${id}-asks`}>
                                {[false, true].map(value => (
                                    <button key={String(value)} type="button" role="radio"
                                        aria-checked={optional === value}
                                        class={`pb-sh-ask${optional === value ? ' pb-sh-ask--on' : ''}`}
                                        onClick={() => setOptional(value)}>
                                        {value ? 'Optional' : 'Required'}
                                    </button>
                                ))}
                            </div>
                            <span class="pb-modal-field-note">
                                {optional ? 'The run asks before it runs.' : 'It runs every time.'}
                            </span>
                        </div>
                        {optional && (
                            <label class="pb-modal-field pb-modal-field--wide">
                                <span class="pb-modal-field-label">What it asks (optional)</span>
                                <input class="pb-modal-text" type="text" value={prompt}
                                    placeholder="Write the house note now?"
                                    onInput={e => setPrompt((e.target as HTMLInputElement).value)} />
                            </label>
                        )}
                        <p class="pb-modal-field-note pb-modal-field--wide">
                            Saved to <span class="pb-mono">.specify/extensions.yml</span>, where Spec Kit reads it on the next run.
                        </p>
                    </div>
                    <footer class="pb-modal-foot">
                        {editing ? (
                            onRemove && (
                                <button type="button" class="pb-action pb-action--remove"
                                    onClick={onRemove}>Remove</button>
                            )
                        ) : (
                            <label class="pb-modal-keep">
                                <input type="checkbox" checked={keep}
                                    onChange={e => setKeep((e.target as HTMLInputElement).checked)} />
                                Keep open to add another
                            </label>
                        )}
                        <button type="button" class="pb-action pb-modal-cancel" onClick={onCancel}>Cancel</button>
                        <button type="submit" class="pb-action pb-action--primary" disabled={!ready}>
                            {editing ? 'Save' : 'Add'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}
