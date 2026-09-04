/**
 * What the builder's tests are built from.
 *
 * The panel's tests were one 1,270-line file covering the board, the header and
 * every side pane at once, so a change to any surface touched the same file as
 * a change to all the others. The factories and the mounting helpers live here
 * now; each surface has its own test file beside this one.
 *
 * Not a test file: the name does not match jest's pattern, so it is imported
 * rather than run.
 */
import { render } from 'preact';
import { Canvas } from '../Canvas';
import type { PipelineGraph, PipelineNode, PipelineStep } from '../../../../src/protocol/pipeline';

export function node(overrides: Partial<PipelineNode> = {}): PipelineNode {
    return {
        id: 'resolve-dir', name: 'Resolve the spec folder', kind: 'control',
        reads: [], writes: [], mayWrite: [], hooks: [], variants: [], pinned: '',
        source: '/ext/nodes/specify/resolve-dir.md', replaced: false, shipped: true,
        ...overrides,
    };
}

export const NO_CHANGES = {
    added: [], removed: [], reordered: false, hooks: 0, decisions: [], replaced: [],
    phases: [],
};

export function step(overrides: Partial<PipelineStep> = {}): PipelineStep {
    return {
        name: 'specify',
        inSequence: true,
        own: false,
        after: '',
        stockHooks: [],
        hooks: [],
        dropped: [],
        addOns: [],
        offers: {},
        frame: { source: '/ext/nodes/specify/_frame.md', replaced: false },
        phases: [
            { name: 'gather', hooks: [], nodes: [node()] },
            {
                name: 'author',
                hooks: [],
                nodes: [node({
                    id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                    writes: ['spec.md'], source: '/ext/nodes/specify/draft-spec.md',
                })],
            },
        ],
        decisions: [],
        artifacts: ['spec.md'],
        template: null,
        changes: { ...NO_CHANGES },
        ...overrides,
    };
}

export function graph(overrides: Partial<PipelineGraph> = {}): PipelineGraph {
    return {
        steps: [step()],
        workflows: { available: ['shipped'], active: '' },
        choices: { skills: [], nodes: [], fragments: [], presets: [] },
        configured: false,
        customised: false,
        warnings: [],
        counts: { steps: 1, phases: 2, nodes: 2, hooks: 0, stockHooks: 0 },
        ...overrides,
    };
}


/** Preact batches state updates, so a click's re-render lands on the next tick. */
export const flush = () => new Promise(resolve => setTimeout(resolve, 0));

export function mount(child: preact.ComponentChild): HTMLElement {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(child as never, host);
    return host;
}


export type Calls = string[][];

export function canvas(g: PipelineGraph = graph(), selected?: { command: string; nodeId: string }) {
    const opened: Calls = [], replaced: Calls = [], restored: Calls = [], added: Calls = [];
    const orders: Array<[string, string[]]> = [];
    const grouped: Array<[string, Array<{ name: string; nodes: string[] }>]> = [];
    const edited: Calls = [];
    const addedNodes: Array<Record<string, unknown>> = [];
    const removedNodes: Array<Record<string, unknown>> = [];
    const movedNodes: Array<Record<string, unknown>> = [];
    const frames: string[] = [];
    const replacedSteps: string[] = [];
    const templates: string[] = [];
    let newSteps = 0;
    /** The step each request named to run behind, or `undefined` for the tail. */
    const newStepAfter: Array<string | undefined> = [];
    const host = mount(
        <Canvas graph={g} selected={selected}
            onNewStep={after => { newSteps += 1; newStepAfter.push(after); }}
            onRemoveNode={(c, n, order, phases) => removedNodes.push({ c, n, order, phases })}
            onMoveNode={(c, n, order, phases) => movedNodes.push({ c, n, order, phases })}
            onSetPhases={(c, phases) => grouped.push([c, phases])}
            onEditHook={(c, h) => edited.push([c, h.anchor, String(h.index)])}
            onAddNode={(c, id, phase, order, phases) => addedNodes.push({ c, id, phase, order, phases })}
            onOpenFrame={c => frames.push(c)}
            onReplaceStep={c => replacedSteps.push(c)}
            onOpenTemplate={c => templates.push(c)}
            onOpenNode={(c, n) => opened.push([c, n])}
            onRestoreNode={(c, n) => restored.push([c, n])}
            onReorder={(c, order) => orders.push([c, order])}
            onAddHook={(c, anchor, when) => added.push([c, anchor, when])} />,
    );
    return { host, opened, replaced, restored, orders, added, grouped, edited, addedNodes,
        removedNodes, movedNodes,
        frames, replacedSteps, templates, newStepAfter, newSteps: () => newSteps };
}


export function drag(host: HTMLElement, from: number, to: number): void {
    const nodes = host.querySelectorAll('.pb-node');
    const carried = new Map<string, string>();
    const dataTransfer = {
        setData: (k: string, v: string) => { carried.set(k, v); },
        getData: (k: string) => carried.get(k) ?? '',
        effectAllowed: '', dropEffect: '',
    };
    const fire = (el: Element, type: string) => {
        const event = new Event(type, { bubbles: true }) as DragEvent;
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        el.dispatchEvent(event);
    };
    fire(nodes[from], 'dragstart');
    fire(nodes[to], 'drop');
}

