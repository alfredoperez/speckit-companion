/**
 * @jest-environment jsdom
 */
import { render } from 'preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import type { PipelineGraph, PipelineStep } from '../../../../src/protocol/pipeline';

function step(overrides: Partial<PipelineStep> = {}): PipelineStep {
    return {
        name: 'specify',
        phases: [
            {
                name: 'gather',
                hooks: [],
                nodes: [{
                    id: 'resolve-dir', name: 'Resolve the spec folder', kind: 'control',
                    reads: [], writes: [], hooks: [],
                }],
            },
            {
                name: 'author',
                hooks: [],
                nodes: [{
                    id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                    reads: ['resolve-dir'], writes: ['spec.md'], hooks: [],
                }],
            },
        ],
        decisions: [],
        artifacts: ['spec.md'],
        template: null,
        changes: { added: [], removed: [], reordered: false, hooks: 0, decisions: [] },
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

function mount(node: preact.ComponentChild): HTMLElement {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(node as never, host);
    return host;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('the canvas draws the three levels as containment', () => {
    it('puts every phase inside its step, and every node inside its phase', () => {
        const host = mount(<Canvas graph={graph()} onOpenNode={() => undefined} />);

        const stepEl = host.querySelector('.pb-step');
        expect(stepEl).not.toBeNull();
        const phases = stepEl!.querySelectorAll('.pb-phase');
        expect(phases).toHaveLength(2);
        expect(phases[0].querySelectorAll('.pb-node')).toHaveLength(1);
    });

    it('shows a node by its human name, with the id as metadata', () => {
        const host = mount(<Canvas graph={graph()} onOpenNode={() => undefined} />);

        expect(host.querySelector('.pb-node-name')?.textContent).toBe('Resolve the spec folder');
        expect(host.querySelector('.pb-node-id')?.textContent).toBe('resolve-dir');
    });

    it('names the artifact a node is declared to produce', () => {
        const host = mount(<Canvas graph={graph()} onOpenNode={() => undefined} />);
        expect(host.textContent).toContain('spec.md');
    });

    it('links steps to each other, never a node to a step', () => {
        const two = graph({ steps: [step(), step({ name: 'plan' })] });
        const host = mount(<Canvas graph={two} onOpenNode={() => undefined} />);

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
        const host = mount(<Canvas graph={withDecision} onOpenNode={() => undefined} />);

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
                    nodes: [{
                        id: 'draft-spec', name: 'Draft the spec', kind: 'author',
                        reads: [], writes: [],
                        hooks: [{ when: 'before', type: 'prompt', summary: 'check the canvas' }],
                    }],
                }],
            })],
        });
        const host = mount(<Canvas graph={hooked} onOpenNode={() => undefined} />);

        const phaseHook = host.querySelector('.pb-phase-head .pb-hook');
        expect(phaseHook?.textContent).toContain('after');
        expect(phaseHook?.textContent).toContain('npm run lint-spec');

        const nodeHook = host.querySelector('.pb-node .pb-hook');
        expect(nodeHook?.textContent).toContain('before');
        expect(nodeHook?.textContent).toContain('check the canvas');
    });

    it('opens the node someone clicks', () => {
        const opened: string[][] = [];
        const host = mount(
            <Canvas graph={graph()} onOpenNode={(c, n) => opened.push([c, n])} />,
        );
        (host.querySelector('.pb-node-main') as HTMLButtonElement).click();
        expect(opened).toEqual([['specify', 'resolve-dir']]);
    });

    it('marks only the steps this project changed', () => {
        const mixed = graph({
            steps: [
                step({ changes: { added: [], removed: ['quality-checklist'], reordered: false, hooks: 0, decisions: [] } }),
                step({ name: 'plan' }),
            ],
        });
        const host = mount(<Canvas graph={mixed} onOpenNode={() => undefined} />);
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
                changes: { added: [], removed: ['quality-checklist'], reordered: false, hooks: 2, decisions: [] },
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
