/**
 * @jest-environment jsdom
 */
import { flush, graph, node, step } from './support';

const posted: Array<Record<string, unknown>> = [];
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: (message: Record<string, unknown>) => { posted.push(message); },
});

let root: HTMLElement;
let unmount: () => void = () => {};

const IMPLEMENT = step({
    name: 'implement',
    dropped: ['review-gaps'], addOns: ['review-gaps'],
    offers: { 'review-gaps': { name: 'Review the gaps', summary: '' } },
    phases: [
        { name: 'execute', hooks: [], nodes: [node({ id: 'execute', name: 'Execute' })] },
        { name: 'wrap-up', hooks: [], nodes: [node({ id: 'handoff', name: 'Hand off', pinned: 'it hands off' })] },
    ],
});
const AUTO = step({ name: 'auto', inSequence: false, phases: [] });

const deliver = async (data: unknown) => {
    window.dispatchEvent(new MessageEvent('message', { data }));
    await flush();
};

const modal = () => root.querySelector<HTMLElement>('.pb-modal');

async function choose(label: string) {
    Array.from(modal()!.querySelectorAll<HTMLButtonElement>('.pb-modal-mode'))
        .find(b => b.textContent === label)!.click();
    await flush();
}

const submit = async () => {
    modal()!.querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
};

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
    await deliver({ type: 'graph', graph: graph({ steps: [IMPLEMENT, AUTO] }), buildState: 'built' });
});

afterEach(() => {
    unmount();
    document.body.innerHTML = '';
});

describe('adding from a lane', () => {
    it('opens the modal for the lane, and marks the lane while it is open', async () => {
        root.querySelector<HTMLButtonElement>('.pb-lane-add')!.click();
        await flush();
        expect(modal()?.querySelector('.pb-modal-title')?.textContent).toBe('Add to implement');
        expect(root.querySelector('.pb-lane-add')?.getAttribute('aria-expanded')).toBe('true');
    });

    it('adds a node on offer at the end of a phase, with the order and the grouping', async () => {
        root.querySelector<HTMLButtonElement>('.pb-lane-add')!.click();
        await flush();
        await choose('Node');
        modal()!.querySelector<HTMLElement>('.pb-modal-row')!.click();
        await submit();
        expect(posted.at(-1)).toEqual({
            type: 'addNode', command: 'implement', nodeId: 'review-gaps', phase: 'execute',
            order: ['execute', 'review-gaps', 'handoff'],
            phases: [
                { name: 'execute', nodes: ['execute', 'review-gaps'] },
                { name: 'wrap-up', nodes: ['handoff'] },
            ],
        });
        expect(modal()).toBeNull();
    });

    it('adds a step behind the lane, warning that auto will not run it', async () => {
        root.querySelector<HTMLButtonElement>('.pb-lane-add')!.click();
        await flush();
        await choose('Step');
        expect(modal()!.querySelector('.pb-modal-warning')?.textContent)
            .toContain('Auto runs implement through implement.');
        const name = modal()!.querySelector<HTMLInputElement>('.pb-modal-fields input')!;
        name.value = 'review';
        name.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        await submit();
        expect(posted.at(-1)).toEqual({
            type: 'newStep', name: 'review', label: '', after: 'implement', writes: '',
        });
    });
});

describe('the + step control at the end of the lanes', () => {
    it('opens the same modal on Step alone', async () => {
        root.querySelector<HTMLButtonElement>('.pb-add-step')!.click();
        await flush();
        expect(modal()?.querySelector('.pb-modal-title')?.textContent).toBe('Add a step');
        expect(modal()?.querySelector('.pb-modal-modes')).toBeNull();
        expect(modal()?.querySelector('.pb-action--primary')?.textContent).toBe('Add step');
    });

    it('restores focus to the control when it closes', async () => {
        const plus = root.querySelector<HTMLButtonElement>('.pb-add-step')!;
        plus.focus();
        plus.click();
        await flush();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(modal()).toBeNull();
        expect(document.activeElement).toBe(plus);
    });
});
