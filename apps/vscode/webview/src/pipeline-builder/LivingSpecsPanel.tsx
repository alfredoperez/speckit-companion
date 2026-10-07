/**
 * The living-specs half of what a Companion run reads.
 *
 * It had no route from the panel at all. A project could be running living
 * specs or not, keeping its specs central or beside the code, carrying a dozen
 * registered capabilities — and the builder drew the same board either way,
 * which made the board a partial answer to "what does this project run".
 *
 * Two settings are a choice someone makes, so they are controls. The rest is a
 * registry that adoption and the capability commands write, so it is shown and
 * not editable: a second writer for that file is how two tools come to disagree
 * about what a project has adopted, and the line above it says where it is.
 */

import { SidePanel } from './SidePanel';
import { LivingSpecsLayout, PipelineLivingSpecs } from '../../../src/protocol/pipeline';

interface Props {
    living: PipelineLivingSpecs;
    onCancel: () => void;
    onSet: (change: { enabled?: boolean; layout?: LivingSpecsLayout }) => void;
}

const LAYOUTS: Array<{ id: LivingSpecsLayout; label: string; help: string }> = [
    {
        id: 'central',
        label: 'Central',
        help: 'Every spec under capabilities/, one folder per capability.',
    },
    {
        id: 'colocated',
        label: 'Beside the code',
        help: 'Each spec sits in the folder it describes.',
    },
];

/** Where the settings are read from, said plainly rather than implied. */
function Origin({ living }: { living: PipelineLivingSpecs }) {
    if (living.origin === 'none') {
        return <>Nothing adopted yet · turning this on writes <span
            class="pb-mono">living-specs.yml</span></>;
    }
    if (living.origin === 'legacy') {
        return <>read from the <span class="pb-mono">livingSpecs</span> block in <span
            class="pb-mono">{living.path}</span></>;
    }
    return <>read from <span class="pb-mono">{living.path}</span></>;
}

export function LivingSpecsPanel({ living, onCancel, onSet }: Props) {
    const caps = living.capabilities;
    const rules = Object.entries(living.rules).filter(([, lines]) => lines.length);

    return (
        <SidePanel
            label="Living specs"
            title="Living specs"
            where={<Origin living={living} />}
            onClose={onCancel}
        >
            <div class="pb-form">
                <div class="pb-form-fields">
                    {living.warnings.map(warning => (
                        <p class="pb-field-problem" key={warning}>{warning}</p>
                    ))}

                    <div class="pb-field pb-field--labelled">
                        <span class="pb-field-label">Runs</span>
                        <div class="pb-living-toggle">
                            <label class={`pb-choice pb-choice--inline ${
                                living.enabled ? 'pb-choice--on' : ''}`}>
                                <input type="checkbox" checked={living.enabled}
                                    onChange={() => onSet({ enabled: !living.enabled })} />
                                <span class="pb-choice-label">
                                    {living.enabled ? 'On' : 'Off'}
                                </span>
                            </label>
                            <span class="pb-field-help">
                                {living.enabled
                                    ? 'Steps load the specs that cover what they touch.'
                                    : 'Turning it off keeps the registry — nothing is deleted.'}
                            </span>
                        </div>
                    </div>

                    <fieldset class="pb-field">
                        <legend class="pb-field-label">Specs live</legend>
                        {LAYOUTS.map(layout => (
                            <label key={layout.id}
                                class={`pb-choice ${
                                    living.layout === layout.id ? 'pb-choice--on' : ''}`}>
                                <input type="radio" name="living-layout" value={layout.id}
                                    checked={living.layout === layout.id}
                                    onChange={() => onSet({ layout: layout.id })} />
                                <span class="pb-choice-body">
                                    <span class="pb-choice-label">{layout.label}</span>
                                    <span class="pb-choice-help">{layout.help}</span>
                                </span>
                            </label>
                        ))}
                        <span class="pb-field-help">
                            Chosen once, so adoption stops asking. Specs already written
                            stay where they are.
                        </span>
                    </fieldset>

                    <div class="pb-field pb-field--labelled">
                        <span class="pb-field-label">Capabilities</span>
                        <div class="pb-living-caps">
                            {caps.length === 0 ? (
                                <p class="pb-living-empty">
                                    None registered. Adoption writes them — run
                                    <span class="pb-mono"> /speckit-companion-living-adopt</span>.
                                </p>
                            ) : caps.map(cap => (
                                <div class="pb-living-cap" key={cap.name}>
                                    <span class="pb-living-cap-name">{cap.name}</span>
                                    {cap.retire && <span class="pb-living-tag">retired</span>}
                                    <span class="pb-living-cap-spec pb-mono">{cap.spec}</span>
                                    <span class="pb-living-cap-match">
                                        {cap.match.join(' · ') || 'nothing matched'}
                                        {cap.exclude.length
                                            ? ` · not ${cap.exclude.join(' · ')}` : ''}
                                    </span>
                                </div>
                            ))}
                            <span class="pb-field-help">
                                Registered by adoption and the capability commands, not here.
                            </span>
                        </div>
                    </div>

                    <div class="pb-field pb-field--labelled">
                        <span class="pb-field-label">Exempt</span>
                        <div class="pb-living-caps">
                            <p class="pb-living-note pb-mono">{living.exempt.join(' · ')}</p>
                            <span class="pb-field-help">
                                Paths drift never flags. Edit them in the file.
                            </span>
                        </div>
                    </div>

                    <div class="pb-field pb-field--labelled">
                        <span class="pb-field-label">Rules</span>
                        <div class="pb-living-caps">
                            {rules.length === 0 ? (
                                <p class="pb-living-empty">None authored.</p>
                            ) : rules.map(([step, lines]) => (
                                <div class="pb-living-cap" key={step}>
                                    <span class="pb-living-cap-name">{step}</span>
                                    {lines.map(line => (
                                        <span class="pb-living-rule" key={line}>{line}</span>
                                    ))}
                                </div>
                            ))}
                            <span class="pb-field-help">
                                Guidance each step carries. Edit it in the file.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </SidePanel>
    );
}
