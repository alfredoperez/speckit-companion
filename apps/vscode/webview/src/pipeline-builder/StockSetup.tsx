// The workflows installed in a stock project, and the Spec Kit presets applied to it.
import { useRef } from 'preact/hooks';
import { SpecPreset, StockWorkflowView } from '../../../src/protocol/pipeline';
import { PresetsPanel, PresetsPanelProps } from './PresetsPanel';
import { useModal } from './useModal';

interface Props {
    view: StockWorkflowView;
    presets: SpecPreset[];
    presetActions: Omit<PresetsPanelProps, 'presets'>;
    onSelectWorkflow: (id: string) => void;
    onOpenFile: (path: string) => void;
    onClose: () => void;
}

export function StockSetup({ view, presets, presetActions, onSelectWorkflow, onOpenFile, onClose }: Props) {
    const box = useRef<HTMLDivElement>(null);
    useModal(box, onClose);

    return (
        <div class="pb-modal-layer">
            <div class="pb-modal-scrim" aria-hidden="true" onClick={onClose} />
            <div ref={box} class="pb-modal pb-ss" role="dialog" aria-modal="true"
                aria-labelledby="pb-ss-title">
                <span class="pb-sheet-grip pb-modal-grip" aria-hidden="true" />
                <header class="pb-modal-head pb-dm-head">
                    <div class="pb-modal-heading">
                        <h2 class="pb-modal-title" id="pb-ss-title">Workflows and presets</h2>
                        <p class="pb-modal-where">What is installed in this project, and the run plan Spec Kit follows</p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Close" onClick={onClose}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>
                <div class="pb-ss-body">
                    <section class="pb-ss-section" aria-labelledby="pb-ss-workflows">
                        <h3 class="pb-dm-label" id="pb-ss-workflows">{`Workflows · ${view.workflows.length}`}</h3>
                        {view.workflows.length === 0 ? (
                            <p class="pb-pop-empty">
                                No workflow file here, so the board draws the installed commands.
                            </p>
                        ) : (
                            <ul class="pb-ss-rows">
                                {view.workflows.map(choice => (
                                    <li key={choice.id} class={`pb-ss-row${choice.drawn ? ' pb-ss-row--drawn' : ''}`}>
                                        <span class="pb-ss-row-text">
                                            <span class="pb-ss-row-name">
                                                {choice.name}
                                                <span class="pb-mono pb-ss-row-id">{choice.id}</span>
                                            </span>
                                            {choice.description && <span class="pb-ss-row-note">{choice.description}</span>}
                                        </span>
                                        {choice.drawn ? (
                                            <span class="pb-ss-row-drawn">On the board</span>
                                        ) : (
                                            <button type="button" class="pb-pop-button"
                                                aria-label={`Draw ${choice.name} on the board`}
                                                onClick={() => onSelectWorkflow(choice.id)}>Draw</button>
                                        )}
                                        <button type="button" class="pb-pop-button"
                                            aria-label={`Open ${choice.path}`}
                                            onClick={() => onOpenFile(choice.path)}>Open</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p class="pb-pop-empty">
                            A run picks its workflow when it starts, with <span class="pb-mono">specify workflow run &lt;id&gt;</span>, so drawing one here changes no file.
                        </p>
                        {view.registry && (
                            <button type="button" class="pb-pop-button pb-ss-registry"
                                onClick={() => onOpenFile(view.registry!.path)}>
                                Open extensions.yml
                            </button>
                        )}
                    </section>
                    <section class="pb-ss-section" aria-labelledby="pb-ss-presets">
                        <h3 class="pb-dm-label" id="pb-ss-presets">Spec Kit presets</h3>
                        <PresetsPanel presets={presets} {...presetActions} />
                    </section>
                </div>
                <footer class="pb-modal-foot">
                    <p class="pb-dm-foot-note">Hook switches and your own hooks change the project at once.</p>
                    <button type="button" class="pb-action pb-modal-cancel" onClick={onClose}>Done</button>
                </footer>
            </div>
        </div>
    );
}
