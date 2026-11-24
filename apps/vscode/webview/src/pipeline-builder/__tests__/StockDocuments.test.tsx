/**
 * @jest-environment jsdom
 *
 * Which layer of each template a stock run uses: the layers top first, the one
 * in force marked, the ones a replacement hides said to be hidden.
 */
import { StockDocuments, inForceWord, layerState } from '../StockDocuments';
import type { StockTemplate } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

const noop = () => undefined;

const LAYERED: StockTemplate = {
    file: 'spec-template.md', path: '.specify/templates/spec-template.md', label: 'Spec',
    note: 'The shape of spec.md, filled in by', command: 'speckit-specify', inForce: 'override',
    layers: [
        { kind: 'override', source: '', path: '.specify/templates/overrides/spec-template.md', strategy: 'replace' },
        { kind: 'preset', source: 'house-style', path: '.specify/presets/house-style/templates/spec-template.md', strategy: 'append' },
        { kind: 'core', source: '', path: '.specify/templates/spec-template.md', strategy: 'replace' },
    ],
};

const BARE: StockTemplate = {
    file: 'agent-file-template.md', path: '.specify/templates/agent-file-template.md',
    label: 'Agent context', note: 'The context file a plan writes for your assistant', command: '',
};

describe('the documents modal', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('lists the layers top first and marks the one in force (FR-012)', () => {
        const host = mount(<StockDocuments templates={[LAYERED, BARE]} constitution={null}
            onOpenFile={noop} onRevise={noop} onClose={noop} />);

        const layers = Array.from(host.querySelectorAll('.pb-sd-layer'));
        expect(layers.map(l => l.querySelector('.pb-sd-layer-state')!.textContent))
            .toEqual(['In use', 'Hidden', 'Hidden']);
        expect(layers[0].textContent).toContain('Your override');
        expect(layers[1].textContent).toContain('house-style preset');
        expect(host.querySelector('.pb-sd-note')!.textContent).toContain('3 layers; the top one wins.');
    });

    it('opens a layer by its own path', () => {
        const opened: string[] = [];
        const host = mount(<StockDocuments templates={[LAYERED]} constitution={null}
            onOpenFile={p => opened.push(p)} onRevise={noop} onClose={noop} />);

        (host.querySelectorAll('.pb-sd-layer-open')[1] as HTMLButtonElement).click();
        expect(opened).toEqual(['.specify/presets/house-style/templates/spec-template.md']);
    });

    it('shows a template without layer data with Open only', async () => {
        const opened: string[] = [];
        const host = mount(<StockDocuments templates={[LAYERED, BARE]} constitution={null} open="agent-file-template.md"
            onOpenFile={p => opened.push(p)} onRevise={noop} onClose={noop} />);
        await flush();

        expect(host.querySelector('.pb-sd-layers')).toBeNull();
        (host.querySelector('.pb-sd-actions button') as HTMLButtonElement).click();
        expect(opened).toEqual(['.specify/templates/agent-file-template.md']);
    });

    it('runs the constitution command from Revise', () => {
        let revised = 0;
        const host = mount(<StockDocuments templates={[LAYERED]}
            constitution={{ command: 'speckit-constitution', written: true }}
            onOpenFile={noop} onRevise={() => { revised += 1; }} onClose={noop} />);

        (host.querySelector('.pb-sd-revise') as HTMLButtonElement).click();
        expect(revised).toBe(1);
    });
});

describe('which layer counts', () => {
    it('keeps layers under a prepend or append, and hides those under a replacement', () => {
        const composed = [
            { ...LAYERED.layers![1] },
            { ...LAYERED.layers![2] },
        ];
        expect(layerState(composed, 1)).toBe('combined');
        expect(layerState(LAYERED.layers!, 1)).toBe('hidden');
    });

    it('names where the template in force comes from', () => {
        expect(inForceWord(LAYERED)).toBe('yours');
        expect(inForceWord({ ...LAYERED, inForce: 'preset', layers: LAYERED.layers!.slice(1) })).toBe('house-style');
        expect(inForceWord(BARE)).toBe('');
    });
});
