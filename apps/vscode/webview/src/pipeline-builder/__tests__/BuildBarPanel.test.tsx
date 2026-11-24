/**
 * @jest-environment jsdom
 */
import type { PipelineHook } from '../../../../src/protocol/pipeline';
import { NO_CHANGES, flush, graph, node, step } from './support';

const posted: Array<Record<string, unknown>> = [];
(globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: (message: Record<string, unknown>) => { posted.push(message); },
});

let root: HTMLElement;
let unmount: () => void = () => {};

const missing: PipelineHook = {
    when: 'before', type: 'skill', summary: 'house-check', anchor: 'resolve-dir',
    index: 0, note: '', problem: 'No skill named house-check',
};

const CHANGED = graph({
    steps: [step({
        changes: { ...NO_CHANGES, hooks: 1 },
        phases: [{ name: 'gather', hooks: [], nodes: [node({ hooks: [missing] })] }],
    })],
});

const deliver = async (data: unknown) => {
    window.dispatchEvent(new MessageEvent('message', { data }));
    await flush();
};

const button = (name: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(el => el.textContent?.trim() === name);

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
});

afterEach(() => {
    unmount();
    document.body.innerHTML = '';
});

describe('the panel carries Build in the bar', () => {
    it('shows the bar when stale and builds from it', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'stale' });
        expect(root.querySelector('.builder-header')?.textContent).not.toContain('Build');
        button('Build')!.click();
        expect(posted.at(-1)).toEqual({ type: 'build' });
    });

    it('shows no bar, and says so in the header, when the build is current', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'current' });
        expect(root.querySelector('.builder-bar')).toBeNull();
        expect(root.querySelector('.builder-state')?.textContent).toBe('Built, up to date');
    });

    it('says the last write in the bar while it is up, not on the foot line (FR-012)', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'stale' });
        await deliver({ type: 'status', status: {
            tone: 'done', text: 'Hook added before resolve-dir', detail: 'Build to apply',
            undo: { token: 'add:1' },
        } });
        expect(root.querySelector('.builder-status')).toBeNull();
        expect(root.querySelector('.builder-bar-status')?.textContent)
            .toContain('Hook added before resolve-dir');
        button('Undo')!.click();
        expect(posted.at(-1)).toEqual({ type: 'undo', token: 'add:1' });
    });

    it('keeps a write on the foot line when there is no bar', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'current' });
        await deliver({ type: 'status', status: { tone: 'done', text: 'Saved' } });
        expect(root.querySelector('.builder-status')?.textContent).toContain('Saved');
    });

    it('fixes a problem hook from the review: Remove sends the removal (FR-006)', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'stale' });
        button('Review')!.click();
        await flush();
        expect(posted.at(-1)).toEqual({ type: 'preview' });
        button('Remove hook')!.click();
        expect(posted.at(-1)).toEqual({
            type: 'removeHook', command: 'specify', anchor: 'resolve-dir', when: 'before', index: 0,
        });
    });

    it('steps aside while a side pane is open, at any width', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'stale' });
        expect(root.querySelector('.builder-bar')).not.toBeNull();
        root.querySelector<HTMLButtonElement>('.pb-node-main')!.click();
        await flush();
        button('Edit node')!.click();
        await flush();
        expect(root.querySelector('.builder-bar')).toBeNull();
    });

    it('builds again from the menu when the build is current', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'current' });
        root.querySelector<HTMLButtonElement>('.builder-more')!.click();
        await flush();
        Array.from(root.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.textContent === 'Build again')!.click();
        expect(posted.at(-1)).toEqual({ type: 'build' });
    });

    it('steps aside while the hook modal is open (FR-011)', async () => {
        await deliver({ type: 'graph', graph: CHANGED, buildState: 'stale' });
        button('Review')!.click();
        await flush();
        button('Edit hook')!.click();
        await flush();
        expect(root.querySelector('.builder-bar')).toBeNull();
    });
});
