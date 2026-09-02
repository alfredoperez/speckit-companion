/**
 * The shape of the document a step writes.
 *
 * A node says what the assistant does; the template says what the document it
 * produces looks like. The second was the half nothing in the panel could
 * reach: the mechanism for replacing a section by its heading has shipped since
 * the template engine landed — its own docstring names "outcomes instead of
 * user stories" as the case it was built for — with no library to pick from and
 * nothing offering the choice.
 *
 * One row per section the template actually has, so this reads as the document
 * it is about rather than as a list of things already changed. A section nobody
 * touched says "As it ships", which is the truth and not an empty state.
 */

import { PipelineFragment, PipelineStep } from '../../../src/protocol/pipeline';

interface Props {
    step: PipelineStep;
    /** Every shipped fragment; each row shows the ones written for it. */
    fragments: PipelineFragment[];
    onCancel: () => void;
    onPick: (heading: string, fragment: string) => void;
}

export function TemplateForm({ step, fragments, onCancel, onPick }: Props) {
    const template = step.template;
    if (!template) { return null; }

    const forStep = fragments.filter(f => !f.for || f.for === step.name);

    return (
        <aside class="pb-side" aria-label="Template">
            <header class="pb-side-head">
                <h2 class="pb-side-title">What {step.name} writes</h2>
                <button class="pb-side-close" onClick={onCancel} title="Close">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
                <p class="pb-side-where">
                    <span class="pb-facts-mono">{template.file}</span> · section by section.
                    Changing one leaves the rest alone.
                </p>
            </header>

            <div class="pb-template-rows">
                {template.sectionsAvailable.map(heading => {
                    const options = forStep.filter(f => f.section === heading);
                    const replaced = template.sections.includes(heading);
                    return (
                        <div class="pb-template-row" key={heading}>
                            <div class="pb-template-section">
                                <span class="pb-template-heading">{heading}</span>
                                {replaced && <span class="pb-yours">yours</span>}
                            </div>
                            {options.length === 0 ? (
                                <span class="pb-template-none">
                                    nothing else written for this one yet
                                </span>
                            ) : (
                                <select class="pb-input"
                                    value={template.chosenBy[heading] ?? ''}
                                    onChange={event => onPick(
                                        heading,
                                        (event.currentTarget as HTMLSelectElement).value)}>
                                    <option value="">As it ships</option>
                                    {options.map(fragment => (
                                        <option key={fragment.name} value={fragment.name}
                                            title={fragment.summary}>{fragment.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
