/**
 * @jest-environment jsdom
 */
import { flush, graph, node, step } from './support';

const posted: Array<Record<string, unknown>> = [];
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: (message: Record<string, unknown>) => { posted.push(message); },
});

const root = document.createElement('div');
root.id = 'app-root';
document.body.appendChild(root);

const SPECIFY = step({
    phases: [
        { name: 'gather', hooks: [], nodes: [node({ id: 'resolve-dir' })] },
        { name: 'classify', hooks: [], nodes: [node({ id: 'classify-size', name: 'Classify' })] },
        { name: 'wrap-up', hooks: [], nodes: [
            node({ id: 'branch', name: 'Create the feature branch' }), node({ id: 'handoff' }),
        ] },
    ],
});

const deliver = async (data: unknown) => {
    window.dispatchEvent(new MessageEvent('message', { data }));
    await flush();
};

const live = () => root.querySelector('.pb-live')?.textContent;

async function moveTo(phase: string) {
    const trigger = Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-order-move'))
        .find(el => el.textContent?.startsWith('Move to phase'))!;
    trigger.click();
    await flush();
    Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
        .find(row => row.querySelector('.pb-menu-label')?.textContent === phase)!.click();
    await flush();
}

beforeAll(async () => {
    await import('../index');
    // Preact runs the listener's effect after the first paint, which jsdom times to a frame.
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    await deliver({ type: 'graph', graph: graph({ steps: [SPECIFY] }), buildState: 'built' });
    Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-node-main'))
        .find(el => el.textContent?.includes('Create the feature branch'))!.click();
    await flush();
});

describe('a move is announced by what its write said', () => {
    it('says nothing when the move is only asked for', async () => {
        await moveTo('classify');
        expect(posted.at(-1)).toMatchObject({ type: 'moveNode', nodeId: 'branch', phase: 'classify' });
        expect(live()).toBe('');
    });

    it('announces the status line once the write succeeds', async () => {
        await deliver({ type: 'graph', graph: graph({ steps: [SPECIFY] }), buildState: 'stale' });
        expect(live()).toBe('');
        await deliver({
            type: 'status',
            status: { tone: 'done', text: 'branch moved to classify in specify', detail: 'Build to apply' },
        });
        expect(live()).toBe('branch moved to classify in specify');
    });

    it('announces the refusal reason, and never the move, when the write is refused', async () => {
        await moveTo('gather');
        expect(live()).toBe('');
        const reason = "specify: 'branch' reads 'classify-size', so it cannot run before it.";
        await deliver({ type: 'notice', text: reason });
        expect(live()).toBe(reason);
        expect(live()).not.toContain('moved');
    });

    it('does not announce a status that answers something other than a move', async () => {
        await deliver({ type: 'status', status: { tone: 'done', text: 'Built' } });
        expect(live()).not.toBe('Built');
    });
});

describe('a hook moved from its form is announced by what its write said', () => {
    const hook = (summary: string, index: number) => ({
        when: 'after' as const, type: 'skill' as const, summary, anchor: 'handoff', index, note: '',
    });
    const HOOKED = step({
        phases: [
            { name: 'gather', hooks: [], nodes: [node({ id: 'resolve-dir' })] },
            { name: 'wrap-up', hooks: [], nodes: [node({
                id: 'handoff', name: 'Hand off',
                hooks: [hook('create-pr', 0), hook('notify', 1)],
            })] },
        ],
    });

    const formLive = () => root.querySelector('.pb-form .pb-live')?.textContent;
    const order = () => Array.from(root.querySelectorAll('.pb-form .pb-field-label'))
        .find(el => el.textContent === 'Order')?.parentElement?.textContent ?? '';
    const press = async (label: string) => {
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-form .pb-order-move'))
            .find(el => el.textContent === label)!.click();
        await flush();
    };
    const sent = (type: string) => posted.filter(m => m.type === type).length;

    beforeAll(async () => {
        await deliver({ type: 'graph', graph: graph({ steps: [HOOKED] }), buildState: 'built' });
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-hook'))
            .find(el => el.textContent?.includes('notify'))!.click();
        await flush();
    });

    it('posts one move for Move up and says nothing until the write answers', async () => {
        expect(order()).toContain('2 of 2 after Hand off');
        const before = sent('moveHook');
        await press('Move up');
        expect(sent('moveHook')).toBe(before + 1);
        expect(posted.at(-1)).toMatchObject({
            type: 'moveHook', command: 'specify',
            from: { when: 'after', anchor: 'handoff', index: 1 },
            to: { when: 'after', anchor: 'handoff', index: 0, boundary: 'node' },
        });
        expect(order()).toContain('1 of 2 after Hand off');
        expect(formLive()).toBe('');

        await deliver({ type: 'status', status: { tone: 'done', text: 'Hook moved up after Hand off' } });
        expect(formLive()).toBe('Hook moved up after Hand off');
    });

    it('reads the reason on a refusal and puts the form back on the hook\'s place', async () => {
        await press('Move down');
        expect(order()).toContain('2 of 2 after Hand off');
        expect(formLive()).toBe('');

        const reason = 'specify: that hook is not in companion.yml any more.';
        await deliver({ type: 'notice', text: reason });
        expect(formLive()).toBe(reason);
        expect(order()).toContain('1 of 2 after Hand off');
    });

    it('saves a change of place as one move, leaving an unedited entry as written', async () => {
        const counts = { add: sent('addHook'), remove: sent('removeHook'), move: sent('moveHook') };
        (root.querySelectorAll('.pb-form .pb-runs .pb-menu-trigger')[1] as HTMLButtonElement).click();
        await flush();
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-form .pb-menu-option'))
            .find(el => el.querySelector('.pb-menu-label')?.textContent === 'the gather phase')!
            .click();
        await flush();
        (root.querySelector('.pb-form .pb-action--primary') as HTMLButtonElement).click();
        await flush();

        expect(sent('moveHook')).toBe(counts.move + 1);
        expect(sent('addHook')).toBe(counts.add);
        expect(sent('removeHook')).toBe(counts.remove);
        expect(posted.at(-1)).toMatchObject({
            type: 'moveHook',
            from: { when: 'after', anchor: 'handoff', index: 0 },
            to: { when: 'after', anchor: 'gather', boundary: 'phase' },
        });
        expect(posted.at(-1)!.hook).toBeUndefined();
        expect((posted.at(-1)!.to as Record<string, unknown>).index).toBeUndefined();
    });
});
