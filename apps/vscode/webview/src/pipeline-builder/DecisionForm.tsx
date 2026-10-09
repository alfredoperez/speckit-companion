/**
 * Where a verdict routes, as something you can change.
 *
 * The board has drawn this since the decision landed — `classify-size decides:
 * simple → skips plan, tasks` — and there was no way to disagree with it. The
 * mechanism to was already in the configuration: a `decisions:` block overrides
 * a verdict's routing, and nothing offered it, so the one real branch in the
 * pipeline was the one part of the pipeline the panel could only read.
 *
 * One row per verdict the deciding node can answer, because that is the whole
 * set — a verdict this step does not declare is one the build never reads, so
 * there is no "add a verdict" here that would do anything. What a project owns
 * is the two halves of each row: which steps the verdict skips, and what it
 * says before continuing.
 */

import { useState } from 'preact/hooks';
import { SidePanel } from './SidePanel';
import { PipelineDecision, PipelineStep, routeReads } from '../../../src/protocol/pipeline';

interface Props {
    step: PipelineStep;
    decision: PipelineDecision;
    /** Steps a verdict can skip — every step that takes a turn in the run. */
    skippable: string[];
    /** `node.verdict` for each verdict this project has already changed. */
    changed: string[];
    onCancel: () => void;
    onSave: (verdict: string, folds: string[], warns: string) => void;
    onRestore: (verdict: string) => void;
}

/** One verdict's row, with its own unsaved state so two rows cannot fight. */
function Verdict({ node, verdict, skippable, yours, onSave, onRestore }: {
    node: string;
    verdict: { name: string; folds: string[]; warns: string };
    skippable: string[];
    yours: boolean;
    onSave: (folds: string[], warns: string) => void;
    onRestore: () => void;
}) {
    const [folds, setFolds] = useState<string[]>(verdict.folds);
    const [warns, setWarns] = useState(verdict.warns);

    // From the state as it stands, not from the render's copy of it. Preact
    // batches, so two boxes ticked before the re-render both read the same
    // `folds` and the second write dropped the first one's answer.
    const toggle = (name: string) => setFolds(
        current => (current.includes(name)
            ? current.filter(f => f !== name) : [...current, name]));
    // Order matters in the written list only as something to read, so it is kept
    // in run order rather than in the order the boxes were ticked.
    const ordered = skippable.filter(name => folds.includes(name));
    const dirty = ordered.join(',') !== verdict.folds.join(',') || warns !== verdict.warns;

    return (
        <div class="pb-verdict-row">
            <div class="pb-verdict-head">
                <span class="pb-verdict">{verdict.name}</span>
                <span class="pb-verdict-arrow" aria-hidden="true">→</span>
                <span class="pb-verdict-route">{routeReads(ordered, warns)}</span>
                {yours && <span class="pb-yours">yours</span>}
            </div>

            <fieldset class="pb-field">
                <legend class="pb-field-label">Skips</legend>
                <div class="pb-verdict-skips">
                    {skippable.map(name => (
                        <label key={name}
                            class={`pb-choice pb-choice--inline ${
                                folds.includes(name) ? 'pb-choice--on' : ''}`}>
                            <input type="checkbox" checked={folds.includes(name)}
                                onChange={() => toggle(name)} />
                            <span class="pb-choice-label">{name}</span>
                        </label>
                    ))}
                </div>
                <span class="pb-field-help">
                    {ordered.length
                        ? `${node} = ${verdict.name} folds the run past `
                            + `${ordered.join(', ')}.`
                        : 'Nothing ticked runs every step.'}
                </span>
            </fieldset>

            <label class="pb-field">
                <span class="pb-field-label">Warns</span>
                <input class="pb-input" type="text" value={warns}
                    placeholder="Nothing — the run just continues"
                    onInput={e => setWarns((e.target as HTMLInputElement).value)} />
                <span class="pb-field-help">
                    Printed before the run continues. Leave it empty for no notice.
                </span>
            </label>

            <div class="pb-form-actions">
                <button class="pb-action pb-action--primary" type="button" disabled={!dirty}
                    onClick={() => onSave(ordered, warns)}>
                    Save routing
                </button>
                {yours && (
                    <button class="pb-action pb-action--remove" type="button"
                        onClick={onRestore}>Use the shipped routing</button>
                )}
            </div>
        </div>
    );
}

export function DecisionForm({
    step, decision, skippable, changed, onCancel, onSave, onRestore,
}: Props) {
    return (
        <SidePanel
            label="Decision"
            title={<>What {decision.node} decides</>}
            where={<>
                in <span class="pb-side-step">{step.name}</span> · one row per answer it can
                give. Changing one leaves the others alone.
            </>}
            onClose={onCancel}
            closeLabel="Cancel"
        >
            <div class="pb-form">
                <div class="pb-form-fields">
                    {decision.verdicts.map(verdict => (
                        <Verdict
                            // Keyed by the verdict so a save redraws that row
                            // from the file rather than keeping what was typed.
                            key={`${verdict.name}/${verdict.folds.join(',')}/${verdict.warns}`}
                            node={decision.node}
                            verdict={verdict}
                            skippable={skippable}
                            yours={changed.includes(`${decision.node}.${verdict.name}`)}
                            onSave={(folds, warns) => onSave(verdict.name, folds, warns)}
                            onRestore={() => onRestore(verdict.name)}
                        />
                    ))}
                    <p class="pb-form-preview">
                        Writes to <span class="pb-mono">companion.yml</span>. The answers
                        themselves come from <span class="pb-mono">{decision.node}</span>,
                        so this changes where each one goes and not what can be answered.
                    </p>
                </div>
            </div>
        </SidePanel>
    );
}
