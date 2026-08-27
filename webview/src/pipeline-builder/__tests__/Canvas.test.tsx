/**
 * @jest-environment jsdom
 */
import { render } from 'preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import type { PipelineGraph, PipelineNode, PipelineStep } from '../../../../src/protocol/pipeline';

function node(overrides: Partial<PipelineNode> = {}): PipelineNode {
    return {
        id: 'resolve-dir', name: 'Resolve the spec folder', kind: 'control',
        reads: [], writes: [], hooks: [],
        source: '/ext/nodes/specify/resolve-dir.md', replaced: false,
        ...overrides,
    };
}

const NO_CHANGES = {
    added: [], removed: [], reordered: false, hooks: 0, decisions: [], replaced: [],
};

function step(overrides: Partial<PipelineStep> = {}): PipelineStep {
    return {
        name: 'specify',
        phases: [
            { name: 'gather', hooks: [], nodes: [node()] },
            {
                name: 'author',
                hooks: [],
                nodes: [node({
                    id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                    reads: ['resolve-dir'], writes: ['spec.md'],
                    source: '/ext/nodes/specify/draft-spec.md',
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

function graph(overrides: Partial<PipelineGraph> = {}): PipelineGraph {
    return {
        steps: [step()],
        configured: false,
        customised: false,
        warnings: [],
        counts: { steps: 1, phases: 2, nodes: 2, hooks: 0 },
        ...overrides,
    };
}

function mount(child: preact.ComponentChild): HTMLElement {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(child as never, host);
    return host;
}

type Calls = string[][];

/** Mount the canvas and hand back the DOM plus what each node action recorded. */
function canvas(g: PipelineGraph = graph()) {
    const opened: Calls = [], replaced: Calls = [], restored: Calls = [];
    const orders: Array<[string, string[]]> = [];
    const host = mount(
        <Canvas graph={g}
            onOpenNode={(c, n) => opened.push([c, n])}
            onReplaceNode={(c, n) => replaced.push([c, n])}
            onRestoreNode={(c, n) => restored.push([c, n])}
            onReorder={(c, order) => orders.push([c, order])} />,
    );
    return { host, opened, replaced, restored, orders };
}

/** Drag the node at `from` onto the node at `to`, as the browser would. */
function drag(host: HTMLElement, from: number, to: number): void {
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

afterEach(() => { document.body.innerHTML = ''; });

describe('the canvas draws the three levels as containment', () => {
    it('puts every phase inside its step, and every node inside its phase', () => {
        const { host } = canvas(graph());

        const stepEl = host.querySelector('.pb-step');
        expect(stepEl).not.toBeNull();
        const phases = stepEl!.querySelectorAll('.pb-phase');
        expect(phases).toHaveLength(2);
        expect(phases[0].querySelectorAll('.pb-node')).toHaveLength(1);
    });

    it('shows a node by its human name, with the id as metadata', () => {
        const { host } = canvas(graph());

        expect(host.querySelector('.pb-node-name')?.textContent).toBe('Resolve the spec folder');
        expect(host.querySelector('.pb-node-id')?.textContent).toBe('resolve-dir');
    });

    it('names the artifact a node is declared to produce', () => {
        const { host } = canvas(graph());
        expect(host.textContent).toContain('spec.md');
    });

    it('links steps to each other, never a node to a step', () => {
        const two = graph({ steps: [step(), step({ name: 'plan' })] });
        const { host } = canvas(two);

        // One link, between the two step containers.
        expect(host.querySelectorAll('.pb-link')).toHaveLength(1);
        expect(host.querySelectorAll('.pb-node .pb-link')).toHaveLength(0);
    });

    it('states where a decision routes instead of drawing wires', () => {
        const withDecision = graph({
            steps: [step({
                decisions: [{
                    node: 'classify-size',
                    verdicts: [
                        { name: 'simple', folds: ['plan', 'tasks'], warns: '' },
                        { name: 'normal', folds: [], warns: '' },
                    ],
                }],
            })],
        });
        const { host } = canvas(withDecision);

        const text = host.querySelector('.pb-decisions')?.textContent ?? '';
        expect(text).toContain('classify-size decides');
        expect(text).toContain('skips plan, tasks');
        expect(text).toContain('runs everything');
    });

    it('shows a hook beside the block it attaches to', () => {
        const hooked = graph({
            steps: [step({
                phases: [{
                    name: 'author',
                    hooks: [{ when: 'after', type: 'command', summary: 'npm run lint-spec' }],
                    nodes: [node({
                        id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                        hooks: [{ when: 'before', type: 'prompt', summary: 'check the canvas' }],
                    })],
                }],
            })],
        });
        const { host } = canvas(hooked);

        const phaseHook = host.querySelector('.pb-phase-head .pb-hook');
        expect(phaseHook?.textContent).toContain('after');
        expect(phaseHook?.textContent).toContain('npm run lint-spec');

        const nodeHook = host.querySelector('.pb-node .pb-hook');
        expect(nodeHook?.textContent).toContain('before');
        expect(nodeHook?.textContent).toContain('check the canvas');
    });

    it('opens the node someone clicks', () => {
        const { host, opened } = canvas();
        (host.querySelector('.pb-node-main') as HTMLButtonElement).click();
        expect(opened).toEqual([['specify', 'resolve-dir']]);
    });

    it('marks only the steps this project changed', () => {
        const mixed = graph({
            steps: [
                step({ changes: { ...NO_CHANGES, removed: ['quality-checklist'], hooks: 0 } }),
                step({ name: 'plan' }),
            ],
        });
        const { host } = canvas(mixed);
        expect(host.querySelectorAll('.pb-step--changed')).toHaveLength(1);
    });
});

describe('dragging a node reorders the step', () => {
    /** One phase holding three nodes, so a drag has somewhere to land. */
    function threeInAPhase() {
        return graph({
            steps: [step({
                phases: [{
                    name: 'wrap-up',
                    hooks: [],
                    nodes: [
                        node({ id: 'branch', name: 'Create the branch' }),
                        node({ id: 'finalize', name: 'Finalize' }),
                        node({ id: 'handoff', name: 'Hand off' }),
                    ],
                }],
            })],
        });
    }

    it('sends the step\'s whole order, with the dragged node in its new place', () => {
        const { host, orders } = canvas(threeInAPhase());
        drag(host, 2, 0);   // handoff, dropped onto branch
        expect(orders).toEqual([['specify', ['handoff', 'branch', 'finalize']]]);
    });

    it('sends nothing when a node is dropped on itself', () => {
        const { host, orders } = canvas(threeInAPhase());
        drag(host, 1, 1);
        expect(orders).toEqual([]);
    });

    it('carries the nodes of every phase, since the file stores one flat list', () => {
        const { host, orders } = canvas();   // two phases, one node each
        drag(host, 1, 0);
        expect(orders).toEqual([['specify', ['draft-spec', 'resolve-dir']]]);
    });

    it('marks every node draggable', () => {
        const { host } = canvas(threeInAPhase());
        const nodes = Array.from(host.querySelectorAll('.pb-node'));
        expect(nodes.every(n => n.getAttribute('draggable') !== null)).toBe(true);
    });
});

describe('a project can take a node over', () => {
    /** A graph whose one node is the project's own copy. */
    function owned() {
        return graph({
            steps: [step({
                phases: [{
                    name: 'author',
                    hooks: [],
                    nodes: [node({
                        id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                        source: '/proj/.specify/companion/nodes/specify/draft-spec.md',
                        replaced: true,
                    })],
                }],
                changes: { ...NO_CHANGES, replaced: ['draft-spec'] },
            })],
        });
    }

    it('offers to replace a node that is still the shipped one', () => {
        const { host, replaced } = canvas();
        const action = host.querySelector('.pb-node-action') as HTMLButtonElement;

        expect(action.textContent).toBe('Replace');
        action.click();
        expect(replaced).toEqual([['specify', 'resolve-dir']]);
    });

    it('marks a node the project owns, and offers the shipped one back', () => {
        const { host, restored } = canvas(owned());

        expect(host.querySelector('.pb-node--replaced')).not.toBeNull();
        expect(host.querySelector('.pb-own')?.textContent).toBe('YOURS');

        const action = host.querySelector('.pb-node-action') as HTMLButtonElement;
        expect(action.textContent).toBe('Use shipped');
        action.click();
        expect(restored).toEqual([['specify', 'draft-spec']]);
    });

    it('counts a replaced node as a change to its step', () => {
        const { host } = canvas(owned());
        expect(host.querySelectorAll('.pb-step--changed')).toHaveLength(1);
    });
});

describe('the header says what this pipeline is', () => {
    const noop = () => undefined;

    it('reads as the shipped default when nothing was changed', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop} />,
        );
        expect(host.querySelector('.builder-chip')?.textContent).toContain('Shipped default');
    });

    it('expands to say what changed', async () => {
        const customised = graph({
            customised: true,
            steps: [step({
                changes: { ...NO_CHANGES, removed: ['quality-checklist'], hooks: 2 },
            })],
        });
        const host = mount(
            <Header graph={customised} buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop} />,
        );
        expect(host.querySelector('.builder-changes')).toBeNull();

        (host.querySelector('.builder-chip') as HTMLButtonElement).click();
        // Preact re-renders on a microtask; read the DOM after it has flushed.
        await new Promise(resolve => setTimeout(resolve, 0));
        const listed = host.querySelector('.builder-changes')?.textContent ?? '';
        expect(listed).toContain('quality-checklist');
        expect(listed).toContain('2 hooks');
    });

    it('says plainly when the built commands are behind the configuration', () => {
        const host = mount(
            <Header graph={graph()} buildState="stale" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop} />,
        );
        expect(host.querySelector('.builder-notice')?.textContent)
            .toContain('still reading the old commands');
    });

    it('says nothing about staleness when the build is current', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop} />,
        );
        expect(host.querySelector('.builder-notice')).toBeNull();
    });

    it('disables the actions while a build is running', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy
                onBuild={noop} onPreview={noop} onOpenConfig={noop} />,
        );
        const primary = host.querySelector('.builder-action--primary') as HTMLButtonElement;
        expect(primary.disabled).toBe(true);
        expect(primary.textContent).toContain('Building');
    });

    it('surfaces a warning the build reported', () => {
        const host = mount(
            <Header graph={graph({ warnings: ['hook anchor nope not in active recipe — skipped'] })}
                buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop} />,
        );
        expect(host.textContent).toContain('not in active recipe');
    });
});
