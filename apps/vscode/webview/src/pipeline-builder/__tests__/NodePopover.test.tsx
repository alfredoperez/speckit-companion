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

const places = () => Array.from(popover()?.querySelectorAll<HTMLButtonElement>('.pb-move-place') ?? []);

async function moveList() {
    Array.from(popover()!.querySelectorAll<HTMLButtonElement>('.pb-pop-button'))
        .find(el => el.textContent?.startsWith('Move'))!.click();
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
        expect(root.querySelector('.pb-modal')).not.toBeNull();

        await open();
        Array.from(popover()!.querySelectorAll<HTMLButtonElement>('.pb-pop-button'))
            .find(el => el.textContent?.includes('Edit node'))!.click();
        await flush();
        expect(popover()).toBeNull();
        expect(root.querySelector('.pb-inspector')).not.toBeNull();
        expect(posted.at(-1)).toEqual({ type: 'readNode', command: 'specify', nodeId: 'draft-spec' });
    });

    it('keeps every other action under More', async () => {
        await open();
        (await more('Open the file')).click();
        expect(posted.at(-1)).toEqual({ type: 'openNode', command: 'specify', nodeId: 'draft-spec' });

        (await more('Use the shipped node')).click();
        expect(posted.at(-1)).toEqual({ type: 'restoreNode', command: 'specify', nodeId: 'draft-spec' });

        (await more('Replace with Lean draft')).click();
        expect(posted.at(-1)).toMatchObject({ type: 'useVariant', replaces: 'draft-spec', variant: 'draft-lean' });

        await open('Quality checklist');
        (await more('Add hook')).click();
        await flush();
        expect(root.querySelector('.pb-modal')).not.toBeNull();
    });

    it('moves the node through Move…, by place', async () => {
        await open();
        await moveList();
        const labels = places().map(p => p.querySelector('.pb-move-label')?.textContent);
        expect(labels).toEqual(['Down, below Quality checklist', 'To phase gather, last']);
        places()[0].click();
        expect(posted.at(-1)).toMatchObject({ type: 'moveNode', nodeId: 'draft-spec' });
        expect(posted.at(-1)!.phase).toBeUndefined();

        places()[1].click();
        expect(posted.at(-1)).toMatchObject({ type: 'moveNode', nodeId: 'draft-spec', phase: 'gather' });
    });

    it('takes the keyboard to the first place it can go', async () => {
        await open();
        await moveList();
        expect(document.activeElement).toBe(places()[0]);
    });

    it('removes the node from the run, with the shape to write, and leaves a struck row with Undo', async () => {
        await open();
        popover()!.querySelector<HTMLButtonElement>('.pb-pop-remove')!.click();
        await flush();
        expect(posted.at(-1)).toEqual({
            type: 'removeNode', command: 'specify', nodeId: 'draft-spec',
            order: ['resolve-dir', 'checklist'],
            phases: [{ name: 'gather', nodes: ['resolve-dir'] }, { name: 'author', nodes: ['checklist'] }],
        });
        expect(popover()).toBeNull();

        const without = { ...HOOKED, phases: HOOKED.phases.map(p => ({
            ...p, nodes: p.nodes.filter(n => n.id !== 'draft-spec'),
        })) };
        await deliver({ type: 'graph', graph: graph({ steps: [without] }), buildState: 'stale' });
        expect(root.querySelector('.pb-removed')).toBeNull();
        await deliver({ type: 'status', status: {
            tone: 'done', text: 'draft-spec no longer runs in specify',
            undo: { token: 'remove:specify:draft-spec' },
        } });
        const row = root.querySelector('.pb-removed')!;
        expect(row.textContent).toContain('Draft the spec');
        expect(row.previousElementSibling).toBeNull();

        row.querySelector<HTMLButtonElement>('.pb-removed-undo')!.click();
        await flush();
        expect(posted.at(-1)).toEqual({ type: 'undo', token: 'remove:specify:draft-spec' });
        expect(root.querySelector('.pb-removed')).toBeNull();
    });

    it('drops the struck row once the status moves on', async () => {
        await open();
        popover()!.querySelector<HTMLButtonElement>('.pb-pop-remove')!.click();
        await deliver({ type: 'status', status: {
            tone: 'done', text: 'gone', undo: { token: 'remove:specify:draft-spec' },
        } });
        expect(root.querySelector('.pb-removed')).not.toBeNull();
        await deliver({ type: 'status', status: { tone: 'done', text: 'Hook added' } });
        expect(root.querySelector('.pb-removed')).toBeNull();
    });

    it('closes when a rebuild takes its node away', async () => {
        await open();
        const without = { ...HOOKED, phases: HOOKED.phases.map(p => ({
            ...p, nodes: p.nodes.filter(n => n.id !== 'draft-spec'),
        })) };
        await deliver({ type: 'graph', graph: graph({ steps: [without] }), buildState: 'stale' });
        await deliver({ type: 'graph', graph: graph({ steps: [HOOKED] }), buildState: 'stale' });
        expect(popover()).toBeNull();
    });

    it('greys a place the writer would refuse, and says why', async () => {
        await deliver({ type: 'graph', graph: graph({ steps: [step({
            phases: [{ name: 'author', hooks: [], nodes: [
                node({ id: 'write-plan', name: 'Write the plan' }),
                node({ id: 'pick', name: 'Pick the blocks', reads: ['write-plan'] }),
            ] }],
        })] }), buildState: 'built' });
        await open('Pick the blocks');
        await moveList();
        const into = places()[0];
        expect(into.querySelector('.pb-move-label')?.textContent).toBe('Up, above Write the plan');
        expect(into.getAttribute('aria-disabled')).toBe('true');
        expect(into.querySelector('.pb-move-reason')?.textContent)
            .toBe('It reads Write the plan, so it cannot run before it.');
        const before = posted.length;
        into.click();
        expect(posted.length).toBe(before);
    });

    it('cannot remove the last node a step has, and says why', async () => {
        await deliver({ type: 'graph', graph: graph({ steps: [step({
            phases: [{ name: 'only', hooks: [], nodes: [node({ id: 'one', name: 'The one' })] }],
        })] }), buildState: 'built' });
        await open('The one');
        const remove = popover()!.querySelector<HTMLButtonElement>('.pb-pop-remove')!;
        expect(remove.getAttribute('aria-disabled')).toBe('true');
        expect(remove.textContent).toContain('a step needs at least one');
        const before = posted.length;
        remove.click();
        expect(posted.length).toBe(before);
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
