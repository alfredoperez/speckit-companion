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
