// A node's document, section by section; picks wait for Done, and the preview is an outline because no rendered text is sent.
import { useRef, useState } from 'preact/hooks';
import { PipelineFragment, PipelineStep } from '../../../src/protocol/pipeline';
import { documentFile, sectionsOf } from './documentNode';
import { useModal } from './useModal';

export interface SectionPick { heading: string; fragment: string }

interface Props {
    step: PipelineStep;
    /** The node that writes the document, as the popover names it. */
    nodeName: string;
    fragments: PipelineFragment[];
    /** The file the picks are written to, said in the footer. */
    savesTo: string;
    narrow?: boolean;
    onCancel: () => void;
    onSave: (picks: SectionPick[]) => void;
    /** A section shown open, for a story or a capture. */
    openSection?: string;
    tab?: 'sections' | 'preview';
}

/** A section someone replaced with text that is not a shipped fragment. */
const OWN = '#own';

function FileIcon() {
    return (
        <svg class="pb-dm-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M3 1.5H8.5L11 4V12.5H3Z M8.5 1.5V4H11" />
        </svg>
    );
}

function Check() {
    return (
        <svg class="pb-dm-check" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M2.5 7.5L5.5 10.5L11.5 3.5" />
        </svg>
    );
}

function RestoreIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M3 5H9.5C11 5 12 6 12 7.5C12 9 11 10 9.5 10H6M3 5L5.5 2.5M3 5L5.5 7.5" />
        </svg>
    );
}

function InfoIcon() {
    return (
        <svg class="pb-dm-tip-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="5.25" />
            <path d="M7 6.5V10M7 4.25V4.5" />
        </svg>
    );
}

/** What each section holds before any pick: a fragment, the project's own text, or nothing changed. */
function startingPicks(step: PipelineStep): Record<string, string> {
    const t = step.template!;
    return Object.fromEntries(sectionsOf(step).map(heading => [
        heading,
        t.sections.includes(heading) ? (t.chosenBy[heading] || OWN) : '',
    ]));
}

export function DocumentModal(props: Props) {
    const { step, fragments, narrow } = props;
    const template = step.template!;
    const box = useRef<HTMLDivElement>(null);
    const start = useRef(startingPicks(step)).current;
    const [picks, setPicks] = useState(start);
    const [open, setOpen] = useState<string | null>(props.openSection ?? null);
    const [tab, setTab] = useState<'sections' | 'preview'>(props.tab ?? 'sections');
    useModal(box, props.onCancel, '.pb-dm-row-head');

    const file = documentFile(template.file);
    const sections = sectionsOf(step);
    const forStep = fragments.filter(f => !f.for || f.for === step.name);
    const optionsFor = (heading: string) => forStep.filter(f => f.section === heading);
    const anyOptions = sections.some(h => optionsFor(h).length > 0);
    const fragmentNamed = (name: string) => forStep.find(f => f.name === name);
    const titleId = `pb-dm-title-${step.name}`.replace(/[^\w-]/g, '-');

    const pick = (heading: string, fragment: string) =>
        setPicks(current => ({ ...current, [heading]: fragment }));

    const done = () => {
        const changed = sections
            .filter(h => picks[h] !== start[h] && picks[h] !== OWN)
            .map(heading => ({ heading, fragment: picks[heading] }));
        props.onSave(changed);
    };

    const status = (heading: string) => {
        const value = picks[heading];
        if (!value) { return <span class="pb-dm-status">Shipped</span>; }
        return (
            <span class="pb-dm-status pb-dm-status--yours">
                <span class="pb-dm-dot" aria-hidden="true" />
                {value === OWN ? 'yours' : `yours · ${value}`}
            </span>
        );
    };

    const list = (
        <section class="pb-dm-sections" aria-label="Sections" id={`${titleId}-sections`}
            role={narrow ? 'tabpanel' : undefined}
            hidden={narrow && tab !== 'sections' ? true : undefined}>
            {!narrow && <h3 class="pb-dm-label">Sections</h3>}
            {!anyOptions && (
                <p class="pb-dm-empty">Nothing but the shipped text is written for any section of this document.</p>
            )}
            <ol class="pb-dm-rows">
                {sections.map((heading, index) => {
                    const options = optionsFor(heading);
                    const isOpen = open === heading;
                    const value = picks[heading];
                    const bodyId = `${titleId}-s${index}`;
                    return (
                        <li key={heading} class={`pb-dm-row${isOpen ? ' pb-dm-row--open' : ''}`}>
                            <button type="button" class="pb-dm-row-head"
                                aria-expanded={isOpen} aria-controls={bodyId}
                                onClick={() => setOpen(isOpen ? null : heading)}>
                                <span class="pb-dm-num" aria-hidden="true">{index + 1}</span>
                                <span class="pb-dm-heading">{heading}</span>
                                {status(heading)}
                            </button>
                            {isOpen && (
                                <div class="pb-dm-row-body" id={bodyId}>
                                    {options.length > 0 ? <>
                                        <p class="pb-dm-replace" id={`${bodyId}-label`}>Replace with</p>
                                        <ul class="pb-dm-options" aria-labelledby={`${bodyId}-label`}>
                                            {options.map(option => {
                                                const on = value === option.name;
                                                return (
                                                    <li key={option.name}>
                                                        <button type="button"
                                                            class={`pb-dm-option${on ? ' pb-dm-option--on' : ''}`}
                                                            aria-pressed={on}
                                                            onClick={() => pick(heading, option.name)}>
                                                            <FileIcon />
                                                            <span class="pb-dm-option-text">
                                                                <span class="pb-dm-option-name">{option.name}</span>
                                                                {option.summary && (
                                                                    <span class="pb-dm-option-note">{option.summary}</span>
                                                                )}
                                                            </span>
                                                            {on && <Check />}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </> : (
                                        <p class="pb-dm-empty">Nothing else is written for this section.</p>
                                    )}
                                    {value && (
                                        <button type="button" class="pb-dm-restore"
                                            onClick={() => pick(heading, '')}>
                                            <RestoreIcon />Restore shipped
                                        </button>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>
            <p class="pb-dm-tip">
                <InfoIcon />
                <span>
                    Write a section as a placeholder, like{' '}
                    <code class="pb-dm-mono">[List the house rules or write None]</code>.
                    Text written as an order tends to be ignored by the assistant.
                </span>
            </p>
        </section>
    );

    const preview = (
        <section class="pb-dm-preview" aria-label="Preview" id={`${titleId}-preview`}
            role={narrow ? 'tabpanel' : undefined}
            hidden={narrow && tab !== 'preview' ? true : undefined}>
            <div class="pb-dm-preview-head">
                {!narrow && <h3 class="pb-dm-label">Preview</h3>}
                <span class="pb-dm-mono pb-dm-preview-file">{file}</span>
            </div>
            <div class="pb-dm-page">
                {sections.map(heading => {
                    const value = picks[heading];
                    const fragment = value && value !== OWN ? fragmentNamed(value) : undefined;
                    return (
                        <div key={heading} class={`pb-dm-block${value ? ' pb-dm-block--yours' : ''}`}>
                            <div class="pb-dm-block-head">
                                <span class="pb-dm-block-title">{heading}</span>
                                {value && (
                                    <span class="pb-dm-block-tag">
                                        {value === OWN ? 'your text' : value}
                                    </span>
                                )}
                            </div>
                            <p class="pb-dm-block-body">
                                {!value ? 'As shipped'
                                    : value === OWN ? 'Your own text for this section'
                                        : fragment?.summary || value}
                            </p>
                        </div>
                    );
                })}
            </div>
            <p class="pb-dm-preview-note">
                An outline of what each section holds. The full text is in{' '}
                <span class="pb-dm-mono">{template.file}</span>.
            </p>
        </section>
    );

    return (
        <div class="pb-modal-layer">
            <div class="pb-modal-scrim" aria-hidden="true" onClick={props.onCancel} />
            <div ref={box} class="pb-modal pb-dm" role="dialog" aria-modal="true"
                aria-labelledby={titleId}>
                <span class="pb-sheet-grip pb-modal-grip" aria-hidden="true" />
                <header class="pb-modal-head pb-dm-head">
                    <div class="pb-modal-heading">
                        <h2 class="pb-modal-title" id={titleId}>
                            Document: <span class="pb-dm-title-file">{file}</span>
                        </h2>
                        <p class="pb-modal-where">
                            {`Written by ${props.nodeName}, in ${step.name} · ${sections.length} section${
                                sections.length === 1 ? '' : 's'}`}
                        </p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Close"
                        onClick={props.onCancel}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>
                {narrow && (
                    <div class="pb-dm-tabs" role="tablist" aria-label="View">
                        {(['sections', 'preview'] as const).map(id => (
                            <button key={id} type="button" role="tab"
                                class={`pb-dm-tab${tab === id ? ' pb-dm-tab--on' : ''}`}
                                aria-selected={tab === id} aria-controls={`${titleId}-${id}`}
                                onClick={() => setTab(id)}>
                                {id === 'sections' ? 'Sections' : 'Preview'}
                            </button>
                        ))}
                    </div>
                )}
                <div class="pb-dm-body">
                    {list}
                    {preview}
                </div>
                <footer class="pb-modal-foot">
                    <p class="pb-dm-foot-note">{`Done saves to ${props.savesTo}. Build to use it.`}</p>
                    <button type="button" class="pb-action pb-modal-cancel"
                        onClick={props.onCancel}>Cancel</button>
                    <button type="button" class="pb-action pb-action--primary"
                        onClick={done}>Done</button>
                </footer>
            </div>
        </div>
    );
}
