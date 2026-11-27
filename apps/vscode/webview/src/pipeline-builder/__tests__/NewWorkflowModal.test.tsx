/**
 * @jest-environment jsdom
 */
import { NewWorkflowModal } from '../NewWorkflowModal';
import type { PipelinePreset } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const PRESETS: PipelinePreset[] = [
    { name: 'brownfield', label: 'Brownfield', summary: 'For a system that already exists.' },
];

function open(more: { hasProject?: boolean; active?: string } = {}) {
    const created: Array<[string, string]> = [];
    let cancelled = 0;
    const host = mount(
        <NewWorkflowModal taken={['shipped', '', 'bugfix']} hasProject={more.hasProject ?? true}
            active={more.active ?? ''} presets={PRESETS}
            onCancel={() => { cancelled += 1; }}
            onCreate={(name, from) => created.push([name, from])} />,
    );
    const input = host.querySelector<HTMLInputElement>('.pb-nw-input')!;
    const create = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent === 'Create')!;
    const type = async (value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
    };
    return { host, input, create, type, created, cancelled: () => cancelled };
}

const starts = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.pb-nw-start-label')).map(el => el.textContent);

describe('a new workflow (FR-010)', () => {
    it('starts from shipped, this project, or a preset the host offers', () => {
        const { host } = open();
        expect(starts(host)).toEqual(['Shipped', 'This project', 'Brownfield']);
    });

    it('leaves This project out when the project has no configuration of its own', () => {
        const { host } = open({ hasProject: false });
        expect(starts(host)).toEqual(['Shipped', 'Brownfield']);
    });

    it('offers the saved workflow in force, and starts there', () => {
        const { host } = open({ active: 'bugfix' });
        expect(starts(host)).toContain('bugfix');
        expect(host.querySelector<HTMLInputElement>('input[value="bugfix"]')!.checked).toBe(true);
    });

    it('holds Create until the name is a free filename, and says why', async () => {
        const { host, create, type } = open();
        expect(create().disabled).toBe(true);
        await type('Bad Name');
        expect(create().disabled).toBe(true);
        expect(host.querySelector('.pb-field-problem')?.textContent).toContain('Lowercase');
        await type('bugfix');
        expect(host.querySelector('.pb-field-problem')?.textContent).toBe('There is already a workflow called bugfix.');
        await type('tight');
        expect(create().disabled).toBe(false);
    });

    it('asks the host to create it from the start picked', async () => {
        const { host, create, type, created } = open();
        await type('tight');
        host.querySelector<HTMLInputElement>('input[value="preset:brownfield"]')!.click();
        await flush();
        create().click();
        expect(created).toEqual([['tight', 'preset:brownfield']]);
    });

    it('closes on Escape and takes the keyboard to the name first', () => {
        const { input, cancelled } = open();
        expect(document.activeElement).toBe(input);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(cancelled()).toBe(1);
    });
});
