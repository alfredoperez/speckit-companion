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

const HOOKED = step({
    phases: [
        { name: 'gather', hooks: [], nodes: [node({ id: 'resolve-dir' })] },
        {
            name: 'author', hooks: [], nodes: [node({
                id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                writes: ['spec.md'], reads: ['resolve-dir'],
                replaced: true, shipped: true,
                variants: [{ id: 'draft-lean', name: 'Lean draft', summary: 'A shorter spec' }],
                hooks: [
                    { when: 'before', type: 'prompt', summary: 'Ask before adding a dependency', anchor: 'draft-spec', index: 0, note: '' },
                    { when: 'after', type: 'command', summary: 'npm run lint', anchor: 'draft-spec', index: 0, note: '' },
                ],
            }), node({ id: 'checklist', name: 'Quality checklist' })],
        },
    ],
});

const deliver = async (data: unknown) => {
    window.dispatchEvent(new MessageEvent('message', { data }));
    await flush();
};

const popover = () => root.querySelector<HTMLElement>('.pb-popover');

async function open(name = 'Draft the spec') {
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-node-main'))
        .find(el => el.textContent?.includes(name))!;
    button.focus();
    button.click();
    await flush();
    return button;
}

async function more(label: string) {
    await flush();
    popover()!.querySelector<HTMLButtonElement>('.pb-pop-more')!.click();
    await flush();
    const row = Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
        .find(el => el.querySelector('.pb-menu-label')?.textContent === label);
    if (!row) { throw new Error(`no "${label}" under More`); }
    return row;
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
    await deliver({ type: 'graph', graph: graph({ steps: [HOOKED] }), buildState: 'built' });
});

afterEach(() => {
    unmount();
    document.body.innerHTML = '';
});

describe('the builder asks whether each hook ran', () => {
    it('asks for the run record with every graph, and draws what comes back', async () => {
        expect(posted.some(m => m.type === 'readHookRuns')).toBe(true);
        await deliver({
            type: 'hookRuns',
            answer: {
                spec: { name: '684-x', path: '/s' }, runAt: '2026-11-20T10:00:00Z',
                runs: [{
                    key: 'specify/before/draft-spec/0', step: 'specify', when: 'before',
                    anchor: 'draft-spec', index: 0, type: 'prompt', ref: '',
                    outcome: 'skipped', reason: 'The assistant read it and chose not to.',
                    at: '2026-11-20T10:00:00Z',
                }],
            },
        });
        expect(Array.from(root.querySelectorAll('.pb-card .pb-hook-status'))
            .map(el => el.textContent)).toEqual(['skipped', 'not seen']);
    });
});

describe("a node's popover", () => {
    it('opens beside the node it was clicked on, and takes the keyboard', async () => {
        await open();
        const dialog = popover()!;
        expect(dialog.getAttribute('role')).toBe('dialog');
        expect(dialog.querySelector('.pb-pop-title')?.textContent).toBe('Draft the spec');
        expect(dialog.querySelector('.pb-pop-source')?.textContent).toBe('Yours');
        expect(document.activeElement).toBe(dialog);
        expect(root.querySelector('.pb-card--open .pb-node-name')?.textContent).toBe('Draft the spec');
        expect(root.querySelector('.pb-inspector')).toBeNull();
    });

    it('says what the node writes and needs', async () => {
        await open();
        const facts = popover()!.querySelector('.pb-pop-facts')!.textContent;
        expect(facts).toContain('spec.md');
        expect(facts).toContain('resolve-dir');
    });

    it('closes on Escape and hands the keyboard back to the node', async () => {
        const button = await open();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(popover()).toBeNull();
        expect(document.activeElement).toBe(button);
    });

    it('closes from its own close button', async () => {
        await open();
        popover()!.querySelector<HTMLButtonElement>('.pb-pop-close')!.click();
        await flush();
        expect(popover()).toBeNull();
    });

    it('lists its hooks, before first, each with whose it is and Edit and Remove', async () => {
        await open();
        const hooks = Array.from(popover()!.querySelectorAll('.pb-pop-hook'));
        expect(hooks.map(h => h.querySelector('.pb-pop-hook-when')?.textContent)).toEqual(['Before', 'After']);
        expect(hooks[1].querySelector('.pb-pop-hook-name')?.textContent).toBe('npm run lint');
        expect(hooks[0].textContent).toContain('Yours, in companion.yml');

        hooks[1].querySelector<HTMLButtonElement>('[aria-label="Remove npm run lint"]')!.click();
        await flush();
        expect(posted.at(-1)).toEqual({
            type: 'removeHook', command: 'specify', anchor: 'draft-spec', when: 'after', index: 0,
        });
    });

    it('opens the hook form for Edit, and the instructions pane for Edit node', async () => {
        await open();
        popover()!.querySelector<HTMLButtonElement>('[aria-label="Edit npm run lint"]')!.click();
        await flush();
        expect(popover()).toBeNull();
        expect(root.querySelector('.pb-form')).not.toBeNull();

        await open();
        Array.from(popover()!.querySelectorAll<HTMLButtonElement>('.pb-pop-button'))
            .find(el => el.textContent?.includes('Edit node'))!.click();
        await flush();
        expect(popover()).toBeNull();
        expect(root.querySelector('.pb-inspector')).not.toBeNull();
        expect(posted.at(-1)).toEqual({ type: 'readNode', command: 'specify', nodeId: 'draft-spec' });
    });

    it('keeps every action the side pane had under More', async () => {
        await open();
        (await more('Open the file')).click();
        expect(posted.at(-1)).toEqual({ type: 'openNode', command: 'specify', nodeId: 'draft-spec' });

        (await more('Move down')).click();
        expect(posted.at(-1)).toMatchObject({ type: 'moveNode', nodeId: 'draft-spec' });

        (await more('Move to gather')).click();
        expect(posted.at(-1)).toMatchObject({ type: 'moveNode', nodeId: 'draft-spec', phase: 'gather' });

        (await more('Use the shipped node')).click();
        expect(posted.at(-1)).toEqual({ type: 'restoreNode', command: 'specify', nodeId: 'draft-spec' });

        (await more('Replace with Lean draft')).click();
        expect(posted.at(-1)).toMatchObject({ type: 'useVariant', replaces: 'draft-spec', variant: 'draft-lean' });
    });

    it('removes the node from the run, with the shape to write', async () => {
        await open();
        (await more('Remove from the run')).click();
        await flush();
        expect(posted.at(-1)).toEqual({
            type: 'removeNode', command: 'specify', nodeId: 'draft-spec',
            order: ['resolve-dir', 'checklist'],
            phases: [{ name: 'gather', nodes: ['resolve-dir'] }, { name: 'author', nodes: ['checklist'] }],
        });
        expect(popover()).toBeNull();
    });

    it('says why the first node cannot move up, rather than offering it', async () => {
        await open('Resolve the spec folder');
        const up = await more('Move up');
        expect(up.getAttribute('aria-disabled')).toBe('true');
    });
});

describe('the sheet, when the builder is narrow', () => {
    beforeEach(async () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 380 });
        window.dispatchEvent(new Event('resize'));
        await flush();
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    });

    it('opens from the bottom and keeps Tab inside until it closes', async () => {
        await open();
        const sheet = popover()!;
        expect(sheet.className).toContain('pb-popover--sheet');
        expect(sheet.getAttribute('aria-modal')).toBe('true');

        const stops = Array.from(sheet.querySelectorAll<HTMLElement>('button:not([disabled])'));
        stops[stops.length - 1].focus();
        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        document.dispatchEvent(tab);
        expect(tab.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[0]);
    });
});
