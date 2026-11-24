/**
 * @jest-environment jsdom
 */
import type { PipelineGraph } from '../../../../src/protocol/pipeline';
import { flush, graph, node, step } from './support';

const posted: Array<Record<string, unknown>> = [];
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: (message: Record<string, unknown>) => { posted.push(message); },
});

let root: HTMLElement;
let unmount: () => void = () => {};

const SPEC = step({
    phases: [{
        name: 'author', hooks: [], nodes: [
            node({ id: 'resolve-dir', name: 'Resolve the spec folder' }),
            node({ id: 'draft-spec', name: 'Draft the spec', kind: 'author', writes: ['spec.md'] }),
        ],
    }],
    template: {
        file: 'spec-template.md', sections: [],
        sectionsAvailable: ['Requirements', 'Success Criteria'], chosenBy: {},
    },
});

function withChoices(g: PipelineGraph): PipelineGraph {
    g.choices.fragments = [{ name: 'ears', section: 'Requirements', for: 'specify', summary: 'WHEN / THEN' }];
    g.workflows = { available: ['shipped', '', 'lean'], active: '' };
    g.configured = true;
    return g;
}

const deliver = async (data: unknown) => {
    window.dispatchEvent(new MessageEvent('message', { data }));
    await flush();
};

async function openNode(name: string) {
    Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-node-main'))
        .find(el => el.textContent?.includes(name))!.click();
    await flush();
}

beforeEach(async () => {
    posted.length = 0;
    document.body.innerHTML = '';
    root = document.createElement('div');
    root.id = 'app-root';
    document.body.appendChild(root);
    jest.resetModules();
    await import('../index');
    const { render } = await import('preact');
    unmount = () => render(null, root);
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    await deliver({ type: 'graph', graph: withChoices(graph({ steps: [SPEC] })), buildState: 'current' });
});

afterEach(() => {
    unmount();
    document.body.innerHTML = '';
});

describe('the document opens from the node that writes it (FR-001, FR-004)', () => {
    it('puts the Document row on the writing node only', async () => {
        await openNode('Resolve the spec folder');
        expect(root.querySelector('.pb-pop-doc')).toBeNull();
        await openNode('Draft the spec');
        expect(root.querySelector('.pb-pop-doc')?.textContent).toBe('Document: spec.md2 sections');
    });

    it('writes each changed section on Done, and nothing on Cancel', async () => {
        await openNode('Draft the spec');
        root.querySelector<HTMLButtonElement>('.pb-pop-doc')!.click();
        await flush();
        expect(root.querySelector('.pb-popover')).toBeNull();
        const modal = root.querySelector('.pb-dm')!;
        modal.querySelector<HTMLButtonElement>('.pb-dm-row-head')!.click();
        await flush();
        root.querySelector<HTMLButtonElement>('.pb-dm-option')!.click();
        await flush();
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-dm button'))
            .find(b => b.textContent === 'Cancel')!.click();
        await flush();
        expect(root.querySelector('.pb-dm')).toBeNull();
        expect(posted.some(m => m.type === 'setTemplateSection')).toBe(false);

        await openNode('Draft the spec');
        root.querySelector<HTMLButtonElement>('.pb-pop-doc')!.click();
        await flush();
        root.querySelector<HTMLButtonElement>('.pb-dm-row-head')!.click();
        await flush();
        root.querySelector<HTMLButtonElement>('.pb-dm-option')!.click();
        await flush();
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-dm button'))
            .find(b => b.textContent === 'Done')!.click();
        await flush();
        expect(posted.filter(m => m.type === 'setTemplateSection')).toEqual([
            { type: 'setTemplateSection', command: 'specify', heading: 'Requirements', fragment: 'ears' },
        ]);
    });
});

describe('switching and creating workflows (FR-009, FR-010)', () => {
    async function pick(label: string) {
        root.querySelector<HTMLButtonElement>('.builder-workflow-current')!.click();
        await flush();
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.querySelector('.pb-menu-label')?.textContent?.trim() === label)!.click();
        await flush();
    }

    it('says Selected, not built after a switch, until the build is current', async () => {
        await pick('lean');
        expect(posted).toContainEqual({ type: 'selectWorkflow', name: 'lean' });
        const switched = withChoices(graph({ steps: [SPEC] }));
        switched.workflows.active = 'lean';
        await deliver({ type: 'graph', graph: switched, buildState: 'stale' });
        expect(root.querySelector('.builder-state--selected')?.textContent).toBe('Selected, not built');
        await deliver({ type: 'graph', graph: switched, buildState: 'current' });
        expect(root.querySelector('.builder-state--selected')).toBeNull();
        await deliver({ type: 'graph', graph: switched, buildState: 'stale' });
        expect(root.querySelector('.builder-state--selected')).toBeNull();
    });

    it('opens New workflow as a modal and sends what it starts from', async () => {
        await pick('New workflow…');
        const input = root.querySelector<HTMLInputElement>('.pb-nw-input')!;
        expect(document.activeElement).toBe(input);
        input.value = 'tight';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        root.querySelector<HTMLInputElement>('input[value="shipped"]')!.click();
        await flush();
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-nw button'))
            .find(b => b.textContent === 'Create')!.click();
        await flush();
        expect(posted).toContainEqual({ type: 'newWorkflow', from: 'shipped', name: 'tight' });
        expect(root.querySelector('.pb-nw')).toBeNull();
    });
});
