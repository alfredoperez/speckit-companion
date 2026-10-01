/**
 * @jest-environment jsdom
 */
import { Canvas } from '../Canvas';
import { HookAddress, HookMove } from '../hookMoves';
import type { PipelineGraph, PipelineHook, StockHook } from '../../../../src/protocol/pipeline';
import { graph, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

function hook(anchor: string, when: 'before' | 'after', index: number, summary: string,
    extra: Partial<PipelineHook> = {}): PipelineHook {
    return { anchor, when, index, summary, type: 'skill', note: '', ...extra };
}

const STOCK: StockHook = {
    when: 'before', extension: 'git', command: 'speckit.git.feature', description: '',
    optional: false, conditional: false,
};

/** specify: gather [resolve-dir], author [draft-spec, quality-checklist]. */
function board(hooks: { draft?: PipelineHook[]; resolve?: PipelineHook[] } = {}, extra = {}) {
    return graph({
        steps: [
            step({
                stockHooks: [STOCK],
                phases: [
                    { name: 'gather', hooks: [], nodes: [node({ hooks: hooks.resolve ?? [] })] },
                    {
                        name: 'author', hooks: [], nodes: [
                            node({ id: 'draft-spec', name: 'Draft the spec', hooks: hooks.draft ?? [] }),
                            node({ id: 'quality-checklist', name: 'Check the spec' }),
                        ],
                    },
                ],
            }),
            step({ name: 'plan', phases: [{ name: 'shape', hooks: [], nodes: [node({ id: 'plan-doc' })] }] }),
        ],
        ...extra,
    });
}

function render(g: PipelineGraph) {
    const moved: Array<[string, HookAddress, HookMove]> = [];
    const refused: string[] = [];
    const reordered: string[][] = [];
    const host = mount(
        <Canvas graph={g}
            onOpenNode={() => {}} onReorder={(_c, order) => reordered.push(order)}
            onAddHook={() => {}} onEditHook={() => {}} onAddNode={() => {}}
            onOpenFrame={() => {}} onOpenTemplate={() => {}} onNewStep={() => {}}
            onRemoveNode={() => {}} onSetPhases={() => {}}
            onMoveHook={(c, from, to) => moved.push([c, from, to])}
            onRefuse={reason => refused.push(reason)} />,
    );
    return { host, moved, refused, reordered };
}

/** A drag carried the way a browser carries one: typed entries, readable on drop. */
function carrier() {
    const store = new Map<string, string>();
    return {
        get types() { return Array.from(store.keys()); },
        setData: (k: string, v: string) => { store.set(k, v); },
        getData: (k: string) => store.get(k) ?? '',
        effectAllowed: '', dropEffect: '',
    };
}

function fire(el: Element, type: string, data: ReturnType<typeof carrier>, clientY = 0) {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: data });
    Object.defineProperty(event, 'clientY', { value: clientY });
    el.dispatchEvent(event);
    return event;
}

/** Give an element a 40px box at the top of the page, so a half can be picked. */
function boxed(el: Element): Element {
    (el as HTMLElement).getBoundingClientRect = () => ({ top: 0, height: 40 }) as DOMRect;
    return el;
}

function dragOnto(source: Element, target: Element, half: 'upper' | 'lower' = 'upper') {
    const data = carrier();
    const start = fire(source, 'dragstart', data);
    fire(boxed(target), 'dragover', data, half === 'upper' ? 5 : 35);
    fire(target, 'drop', data, half === 'upper' ? 5 : 35);
    return start;
}

const rows = (host: HTMLElement) => Array.from(host.querySelectorAll('button.pb-hook'));
const card = (host: HTMLElement, id: string) =>
    Array.from(host.querySelectorAll('.pb-node'))
        .find(el => el.querySelector('.pb-node-name')?.textContent === id)!;

describe('dragging a hook to another anchor', () => {
    it('runs it before a card dropped on in its upper half', () => {
        const { host, moved } = render(board({ draft: [hook('draft-spec', 'after', 0, 'one')] }));
        dragOnto(rows(host)[0], card(host, 'Check the spec'), 'upper');
        expect(moved).toEqual([['specify',
            { command: 'specify', when: 'after', anchor: 'draft-spec', index: 0, boundary: 'node' },
            { when: 'before', anchor: 'quality-checklist', boundary: 'node' }]]);
    });

    it('runs it after a card dropped on in its lower half', () => {
        const { host, moved } = render(board({ draft: [hook('draft-spec', 'after', 0, 'one')] }));
        dragOnto(rows(host)[0], card(host, 'Resolve the spec folder'), 'lower');
        expect(moved[0][2]).toEqual({ when: 'after', anchor: 'resolve-dir', boundary: 'node' });
    });

    it('puts it last at a seam it is dropped on', () => {
        const { host, moved } = render(board({ draft: [hook('draft-spec', 'after', 0, 'one')] }));
        const seam = host.querySelector('.pb-slot--before')!;
        dragOnto(rows(host)[0], seam);
        expect(moved[0][2]).toEqual({ when: 'before', anchor: 'quality-checklist', boundary: 'node' });
    });

    it('takes a phase heading as before that phase', () => {
        const { host, moved } = render(board({ draft: [hook('draft-spec', 'after', 0, 'one')] }));
        dragOnto(rows(host)[0], host.querySelectorAll('.pb-phase-head')[0]);
        expect(moved[0][2]).toEqual({ when: 'before', anchor: 'gather', boundary: 'phase' });
    });

    it('leaves a node drag to the nodes, and a hook drag out of the node order', () => {
        const { host, moved, reordered } = render(
            board({ draft: [hook('draft-spec', 'after', 0, 'one')] }));
        dragOnto(rows(host)[0], card(host, 'Draft the spec'));
        expect(reordered).toEqual([]);
        expect(moved).toHaveLength(1);
    });
});

describe('reordering hooks at one anchor', () => {
    const three = () => board({
        draft: [0, 1, 2].map(i => hook('draft-spec', 'after', i, `h${i}`)),
    });

    it('puts a later hook above the one it is dropped on the upper half of', () => {
        const { host, moved } = render(three());
        dragOnto(rows(host)[2], rows(host)[0], 'upper');
        expect(moved[0][2]).toEqual(
            { when: 'after', anchor: 'draft-spec', index: 0, boundary: 'node' });
    });

    it('puts an earlier hook below the one it is dropped on the lower half of', () => {
        const { host, moved } = render(three());
        dragOnto(rows(host)[0], rows(host)[2], 'lower');
        expect(moved[0][2]).toEqual(
            { when: 'after', anchor: 'draft-spec', index: 2, boundary: 'node' });
    });

    it('sends nothing when a hook is dropped back on itself', () => {
        const { host, moved } = render(three());
        dragOnto(rows(host)[1], rows(host)[1], 'lower');
        expect(moved).toEqual([]);
    });
});

describe('what a hook drag refuses', () => {
    it('will not start on an extension hook, and says who registered it', () => {
        const { host, refused, moved } = render(board());
        const stock = host.querySelector('.pb-hook--stock')!;
        const start = dragOnto(stock, card(host, 'Check the spec'));
        expect(start.defaultPrevented).toBe(true);
        expect(refused).toEqual([expect.stringContaining('Registered by the git extension')]);
        expect(refused[0]).toContain('not moved');
        expect(moved).toEqual([]);
    });

    it('takes no drop on an extension hook', () => {
        const { host, moved } = render(board({ resolve: [hook('resolve-dir', 'before', 0, 'mine')] }));
        const data = carrier();
        fire(rows(host)[0], 'dragstart', data);
        const over = fire(host.querySelector('.pb-hook--stock')!, 'dragover', data);
        expect(over.defaultPrevented).toBe(false);
        expect(moved).toEqual([]);
    });

    it('will not start on a parked hook, and says why', () => {
        const { host, refused } = render(board(
            { draft: [hook('draft-spec', 'after', 0, 'one', { parked: true })] },
            { workflows: { available: ['shipped'], active: 'shipped' } }));
        dragOnto(host.querySelector('.pb-hook--parked')!, card(host, 'Check the spec'));
        expect(refused).toEqual([expect.stringContaining('parked')]);
    });

    it('refuses a drop in another step before anything is written', () => {
        const { host, moved, refused } = render(
            board({ draft: [hook('draft-spec', 'after', 0, 'one')] }));
        const planCard = Array.from(host.querySelectorAll('.pb-step'))
            .find(el => (el as HTMLElement).dataset.step === 'plan')!.querySelector('.pb-node')!;
        dragOnto(rows(host)[0], planCard);
        expect(moved).toEqual([]);
        expect(refused).toEqual([expect.stringContaining('within its own step')]);
    });
});
