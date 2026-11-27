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
const IDLE = { onViewFile: noop, onOverride: noop, onRemoveOverride: noop };

const LAYERED: StockTemplate = {
    file: 'spec-template.md', path: '.specify/templates/spec-template.md', label: 'Spec',
    note: 'The shape of spec.md, filled in by', command: 'speckit-specify', inForce: 'override',
    layers: [
        { kind: 'override', source: '', path: '.specify/templates/overrides/spec-template.md', strategy: 'replace' },
        { kind: 'preset', source: 'house-style', path: '.specify/presets/house-style/templates/spec-template.md', strategy: 'append' },
        { kind: 'core', source: '', path: '.specify/templates/spec-template.md', strategy: 'replace' },
    ],
};

const NO_OVERRIDE: StockTemplate = {
    file: 'plan-template.md', path: '.specify/templates/plan-template.md', label: 'Plan',
    note: 'The shape of plan.md, filled in by', command: 'speckit-plan', inForce: 'preset',
    layers: [
        { kind: 'preset', source: 'house-style', path: '.specify/presets/house-style/templates/plan-template.md', strategy: 'replace' },
        { kind: 'core', source: '', path: '.specify/templates/plan-template.md', strategy: 'replace' },
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
            onOpenFile={noop} {...IDLE} onRevise={noop} onClose={noop} />);

        const layers = Array.from(host.querySelectorAll('.pb-sd-layer'));
        expect(layers.map(l => l.querySelector('.pb-sd-layer-state')!.textContent))
            .toEqual(['In use', 'Hidden', 'Hidden']);
        expect(layers[0].textContent).toContain('Your override');
        expect(layers[1].textContent).toContain('house-style preset');
        expect(host.querySelector('.pb-sd-note')!.textContent).toContain('3 layers; the top one wins.');
    });

    it('offers Open, View for each lower layer and Remove override on an override', () => {
        const opened: string[] = [];
        const viewed: string[] = [];
        const removed: string[] = [];
        const host = mount(<StockDocuments templates={[LAYERED]} constitution={null}
            onOpenFile={p => opened.push(p)} onViewFile={p => viewed.push(p)}
            onOverride={noop} onRemoveOverride={p => removed.push(p)}
            onRevise={noop} onClose={noop} />);

        const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-sd-actions button'));
        expect(buttons.map(b => b.textContent)).toEqual(['Open', 'View house-style', 'View core', 'Remove override']);
        buttons.forEach(b => b.click());
        expect(opened).toEqual(['.specify/templates/overrides/spec-template.md']);
        expect(viewed).toEqual([
            '.specify/presets/house-style/templates/spec-template.md', '.specify/templates/spec-template.md']);
        expect(removed).toEqual(['.specify/templates/overrides/spec-template.md']);
    });

    it('offers Override in this project on a template with no override, and sends the file in use', () => {
        const overridden: string[] = [];
        const host = mount(<StockDocuments templates={[NO_OVERRIDE]} constitution={null}
            onOpenFile={noop} onViewFile={noop} onOverride={p => overridden.push(p)}
            onRemoveOverride={noop} onRevise={noop} onClose={noop} />);

        const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-sd-actions button'));
        expect(buttons.map(b => b.textContent)).toEqual(['Override in this project', 'View core']);
        buttons[0].click();
        expect(overridden).toEqual(['.specify/presets/house-style/templates/plan-template.md']);
    });

    it('says where the copy lives and that Spec Kit files open read-only', () => {
        const host = mount(<StockDocuments templates={[LAYERED]} constitution={null}
            onOpenFile={noop} {...IDLE} onRevise={noop} onClose={noop} />);
        expect(host.querySelector('.pb-dm-foot-note')!.textContent)
            .toBe("Your copy lives in templates/overrides/. Spec Kit's own files open read-only.");
    });

    it('shows a template without layer data with Open only', async () => {
        const opened: string[] = [];
        const host = mount(<StockDocuments templates={[LAYERED, BARE]} constitution={null} open="agent-file-template.md"
            onOpenFile={p => opened.push(p)} {...IDLE} onRevise={noop} onClose={noop} />);
        await flush();

        expect(host.querySelector('.pb-sd-layers')).toBeNull();
        (host.querySelector('.pb-sd-actions button') as HTMLButtonElement).click();
        expect(opened).toEqual(['.specify/templates/agent-file-template.md']);
    });

    it('opens the constitution and runs its command from Revise (FR-012)', () => {
        let revised = 0;
        const opened: string[] = [];
        const host = mount(<StockDocuments templates={[LAYERED]}
            constitution={{ command: 'speckit-constitution', written: true, path: '.specify/memory/constitution.md' }}
            onOpenFile={p => opened.push(p)} {...IDLE} onRevise={() => { revised += 1; }} onClose={noop} />);

        const [open, revise] = Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-sd-memory button'));
        open.click();
        revise.click();
        expect(opened).toEqual(['.specify/memory/constitution.md']);
        expect(revised).toBe(1);
    });

    it('offers no Open for a constitution not written yet', () => {
        const host = mount(<StockDocuments templates={[LAYERED]}
            constitution={{ command: 'speckit-constitution', written: false }}
            onOpenFile={noop} {...IDLE} onRevise={noop} onClose={noop} />);

        expect(Array.from(host.querySelectorAll('.pb-sd-memory button')).map(b => b.textContent))
            .toEqual(['Write it']);
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
