// Every template a stock project writes from, and which layer of it a run uses.
import { useRef, useState } from 'preact/hooks';
import {
    StockTemplate, StockTemplateLayer, StockTemplateLayerKind, StockWorkflowView,
} from '../../../src/protocol/pipeline';
import { FileIcon } from './stockParts';
import { useModal } from './useModal';

interface Props {
    templates: StockTemplate[];
    constitution: StockWorkflowView['constitution'];
    /** The template open first, by file name. */
    open?: string;
    onOpenFile: (path: string) => void;
    onRevise: () => void;
    onClose: () => void;
}

/** The word for where the template in force comes from, as the list shows it. */
export function inForceWord(template: StockTemplate): string {
    const top = template.layers?.[0];
    if (!template.inForce) { return ''; }
    if (template.inForce === 'override') { return 'yours'; }
    if (template.inForce === 'core') { return 'core'; }
    return top?.source || template.inForce;
}

const KIND_NAMES: Record<StockTemplateLayerKind, string> = {
    override: 'Your override',
    preset: 'preset',
    extension: 'extension',
    core: 'Core, as Spec Kit ships it',
};

const HOW: Record<StockTemplateLayer['strategy'], string> = {
    replace: 'replaces it',
    prepend: 'adds to the start',
    append: 'adds to the end',
    wrap: 'wraps it',
    'replace-section': 'replaces a section',
};

function layerName(layer: StockTemplateLayer): string {
    if (layer.kind === 'override' || layer.kind === 'core') { return KIND_NAMES[layer.kind]; }
    return `${layer.source || 'An unnamed'} ${KIND_NAMES[layer.kind]}`;
}

/**
 * Whether a layer under the top one still counts: a layer that replaces outright
 * hides everything under it; the others build on what is below them.
 */
export function layerState(layers: StockTemplateLayer[], at: number): 'in-use' | 'combined' | 'hidden' {
    if (at === 0) { return 'in-use'; }
    const hiddenBy = layers.slice(0, at).find(layer => layer.strategy === 'replace');
    return hiddenBy ? 'hidden' : 'combined';
}

const STATE_WORDS = { 'in-use': 'In use', combined: 'Part of it', hidden: 'Hidden' };

function Detail({ template, onOpenFile }: { template: StockTemplate; onOpenFile: Props['onOpenFile'] }) {
    const layers = template.layers ?? [];
    return (
        <section class="pb-sd-detail" aria-labelledby="pb-sd-file">
            <h3 class="pb-sd-file" id="pb-sd-file">{template.file}</h3>
            <p class="pb-sd-note">
                {template.note}{template.command && <> <span class="pb-mono">/{template.command}</span></>}.
                {layers.length > 1 && ` ${layers.length} layers; the top one wins.`}
            </p>
            {layers.length > 0 && (
                <ol class="pb-sd-layers">
                    {layers.map((layer, at) => {
                        const state = layerState(layers, at);
                        const how = at > 0 || layers.length > 1 ? HOW[layer.strategy] : '';
                        return (
                            <li key={`${layer.kind}-${layer.path}`}
                                class={`pb-sd-layer pb-sd-layer--${state}`}>
                                <span class="pb-sd-layer-text">
                                    <span class="pb-sd-layer-name">
                                        {layerName(layer)}
                                        {how && layer.kind !== 'core' && ` · ${how}`}
                                    </span>
                                    <span class="pb-sd-layer-path" title={layer.path}>
                                        {layer.path.replace(/^\.specify\//, '')}
                                    </span>
                                </span>
                                <span class="pb-sd-layer-state">{STATE_WORDS[state]}</span>
                            </li>
                        );
                    })}
                </ol>
            )}
            <div class="pb-sd-actions">
                {layers.length > 1 ? layers.map((layer, at) => (
                    <button key={`${layer.kind}-${layer.path}`} type="button"
                        class={`pb-pop-button pb-sd-layer-open${at === 0 ? ' pb-sd-layer-open--top' : ''}`}
                        aria-label={`Open ${layer.path}`}
                        onClick={() => onOpenFile(layer.path)}>
                        {at === 0 ? 'Open' : `Open ${layer.kind === 'core' ? 'core' : layer.source || KIND_NAMES[layer.kind]}`}
                    </button>
                )) : (
                    <button type="button" class="pb-pop-button pb-sd-layer-open"
                        aria-label={`Open ${layers[0]?.path ?? template.path}`}
                        onClick={() => onOpenFile(layers[0]?.path ?? template.path)}>
                        Open
                    </button>
                )}
            </div>
        </section>
    );
}

export function StockDocuments({ templates, constitution, open, onOpenFile, onRevise, onClose }: Props) {
    const box = useRef<HTMLDivElement>(null);
    const [picked, setPicked] = useState(open ?? templates[0]?.file ?? '');
    useModal(box, onClose, '.pb-sd-pick--on');
    const template = templates.find(t => t.file === picked) ?? templates[0];

    return (
        <div class="pb-modal-layer">
            <div class="pb-modal-scrim" aria-hidden="true" onClick={onClose} />
            <div ref={box} class="pb-modal pb-sd" role="dialog" aria-modal="true"
                aria-labelledby="pb-sd-title">
                <span class="pb-sheet-grip pb-modal-grip" aria-hidden="true" />
                <header class="pb-modal-head pb-dm-head">
                    <div class="pb-modal-heading">
                        <h2 class="pb-modal-title" id="pb-sd-title">Documents</h2>
                        <p class="pb-modal-where">Which version of each template Spec Kit uses in this project</p>
                    </div>
                    <button type="button" class="pb-modal-close" aria-label="Close" onClick={onClose}>
                        <kbd class="pb-modal-esc" aria-hidden="true">Esc</kbd>
                        <span class="pb-modal-close-word" aria-hidden="true">Close</span>
                    </button>
                </header>
                <div class="pb-sd-body">
                    <nav class="pb-sd-list" aria-label="Templates">
                        <ul class="pb-sd-picks">
                            {templates.map(t => (
                                <li key={t.path}>
                                    <button type="button" aria-current={t === template ? 'true' : undefined}
                                        class={`pb-sd-pick${t === template ? ' pb-sd-pick--on' : ''}`}
                                        onClick={() => setPicked(t.file)}>
                                        <FileIcon />
                                        <span class="pb-sd-pick-file">{t.file}</span>
                                        <span class={`pb-sd-pick-force${t.inForce === 'override'
                                            ? ' pb-sd-pick-force--yours' : ''}`}>{inForceWord(t)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        {constitution && (
                            <>
                                <p class="pb-dm-label">Project memory</p>
                                <div class="pb-sd-memory">
                                    <FileIcon />
                                    <span class="pb-sd-pick-file">constitution.md</span>
                                    {constitution.path && (
                                        <button type="button" class="pb-sd-revise"
                                            aria-label={`Open ${constitution.path}`}
                                            onClick={() => onOpenFile(constitution.path!)}>Open</button>
                                    )}
                                    <button type="button" class="pb-sd-revise" onClick={onRevise}
                                        title={`Sends /${constitution.command} to your assistant`}>
                                        {constitution.written ? 'Revise' : 'Write it'}
                                    </button>
                                </div>
                            </>
                        )}
                    </nav>
                    {template
                        ? <Detail template={template} onOpenFile={onOpenFile} />
                        : <p class="pb-sd-detail pb-pop-empty">No templates in this project yet.</p>}
                </div>
                <footer class="pb-modal-foot">
                    <p class="pb-dm-foot-note">A template opens in an editor. Spec Kit reads it on the next run.</p>
                    <button type="button" class="pb-action pb-action--primary" onClick={onClose}>Done</button>
                </footer>
            </div>
        </div>
    );
}
