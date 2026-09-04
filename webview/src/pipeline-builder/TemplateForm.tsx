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
 * touched says "As shipped", which is the truth and not an empty state.
 */

import { Menu } from './Menu';
import { SidePanel } from './SidePanel';
import { PipelineFragment, PipelineStep } from '../../../src/protocol/pipeline';

/** How a section goes back to the shipped shape, and what that shape is called. */
const SHIPPED = {
    id: '',
    label: 'As shipped',
    note: 'The section the way Companion writes it.',
};

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
    const anywhere = template.sectionsAvailable.some(
        heading => forStep.some(f => f.section === heading));

    return (
        <SidePanel
            label="Template"
            title={<>What {step.name} writes</>}
            where={<>
                <span class="pb-facts-mono">{template.file}</span> · section by section.
                Changing one leaves the rest alone.
            </>}
            onClose={onCancel}
        >
            <div class="pb-template-rows">
                {/* Said once, rather than in every row, when it is true of all of them. */}
                {!anywhere && (
                    <p class="pb-template-summary">
                        <span class="pb-facts-mono">{SHIPPED.label}</span>
                        {' · nothing else is written for any section of this document.'}
                    </p>
                )}
                {template.sectionsAvailable.map(heading => {
                    const options = forStep.filter(f => f.section === heading);
                    const replaced = template.sections.includes(heading);
                    const chosen = template.chosenBy[heading] ?? '';
                    const picked = options.find(f => f.name === chosen);
                    return (
                        <div class="pb-template-row" key={heading}>
                            <div class="pb-template-section">
                                <span class="pb-template-heading">{heading}</span>
                                {replaced && <span class="pb-yours">yours</span>}
                            </div>
                            {/* A dead field read as the working one a row above. */}
                            {options.length === 0 ? (anywhere && (
                                <span class="pb-template-summary">
                                    <span class="pb-facts-mono">{SHIPPED.label}</span>
                                    {' · nothing else is written for this section.'}
                                </span>
                            )) : (
                                <>
                                    {/* A select had nowhere to put a fragment's summary. */}
                                    <span class="pb-template-pick">
                                        <Menu class="pb-menu-trigger--field"
                                            trigger={<span class="pb-trigger-text">
                                                {picked?.name ?? SHIPPED.label}
                                            </span>}
                                            label={heading}
                                            title={`What ${heading} says`}
                                            options={[SHIPPED, ...options.map(fragment => ({
                                                id: fragment.name,
                                                label: fragment.name,
                                                note: fragment.summary,
                                            }))]}
                                            onPick={fragment => onPick(heading, fragment)} />
                                    </span>
                                    <span class="pb-template-summary">
                                        {picked?.summary ?? SHIPPED.note}
                                    </span>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </SidePanel>
    );
}
