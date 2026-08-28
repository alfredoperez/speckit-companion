/**
 * @jest-environment jsdom
 */
import { render } from 'preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { Inspector } from '../Inspector';
import type { PipelineGraph, PipelineNode, PipelineStep } from '../../../../src/protocol/pipeline';

function node(overrides: Partial<PipelineNode> = {}): PipelineNode {
    return {
        id: 'resolve-dir', name: 'Resolve the spec folder', kind: 'control',
        reads: [], writes: [], hooks: [], pinned: '',
        source: '/ext/nodes/specify/resolve-dir.md', replaced: false,
        ...overrides,
    };
}

const NO_CHANGES = {
    added: [], removed: [], reordered: false, hooks: 0, decisions: [], replaced: [],
    phases: [],
};

function step(overrides: Partial<PipelineStep> = {}): PipelineStep {
    return {
        name: 'specify',
        inSequence: true,
        stockHooks: [],
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

function graph(overrides: Partial<PipelineGraph> = {}): PipelineGraph {
    return {
        steps: [step()],
        workflows: { available: ['shipped'], active: '' },
        configured: false,
        customised: false,
        warnings: [],
        counts: { steps: 1, phases: 2, nodes: 2, hooks: 0, stockHooks: 0 },
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

function canvas(g: PipelineGraph = graph(), selected?: { command: string; nodeId: string }) {
    const opened: Calls = [], replaced: Calls = [], restored: Calls = [], added: Calls = [];
    const orders: Array<[string, string[]]> = [];
    const grouped: Array<[string, Array<{ name: string; nodes: string[] }>]> = [];
    const host = mount(
        <Canvas graph={g} selected={selected}
            onSetPhases={(c, phases) => grouped.push([c, phases])}
            onOpenNode={(c, n) => opened.push([c, n])}
            onReplaceNode={(c, n) => replaced.push([c, n])}
            onRestoreNode={(c, n) => restored.push([c, n])}
            onReorder={(c, order) => orders.push([c, order])}
            onAddHook={(c, anchor, when) => added.push([c, anchor, when])} />,
    );
    return { host, opened, replaced, restored, orders, added, grouped };
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

describe('the run reads left to right', () => {
    it('gives every step in the sequence a column, in order', () => {
        const four = graph({
            steps: ['specify', 'plan', 'tasks', 'implement'].map(name => step({ name })),
        });
        const { host } = canvas(four);

        const run = host.querySelector('.pb-run') as HTMLElement;
        expect(run.style.getPropertyValue('--pb-steps')).toBe('4');
        expect(Array.from(run.querySelectorAll('.pb-step-name')).map(el => el.textContent))
            .toEqual(['specify', 'plan', 'tasks', 'implement']);
    });

    it('numbers the steps by their place in the run', () => {
        const two = graph({ steps: [step({ name: 'specify' }), step({ name: 'plan' })] });
        const { host } = canvas(two);
        expect(Array.from(two.steps.length ? host.querySelectorAll('.pb-step-index') : [])
            .map(el => el.textContent)).toEqual(['1', '2']);
    });

    // `auto` runs the others. Drawn as a peer it reads as a fifth step.
    it('keeps a step outside the run out of the row', () => {
        const withAuto = graph({
            steps: [step({ name: 'specify' }), step({ name: 'auto', inSequence: false })],
        });
        const { host } = canvas(withAuto);

        expect(host.querySelectorAll('.pb-run .pb-step')).toHaveLength(1);
        const aside = host.querySelector('.pb-aside');
        expect(aside?.textContent).toContain('auto');
        expect(aside?.textContent).toContain('not a step of its own');
    });

    it('puts every phase inside its step, and every node inside its phase', () => {
        const { host } = canvas();
        const stepEl = host.querySelector('.pb-step')!;
        expect(stepEl.querySelectorAll('.pb-phase')).toHaveLength(2);
        expect(stepEl.querySelectorAll('.pb-phase')[0].querySelectorAll('.pb-node')).toHaveLength(1);
    });

    // "Resolve the spec folder" over "resolve-dir" said the same thing twice.
    // The id is a handle, and it belongs where you go to work on the node.
    it('shows a node by its name, and does not repeat it as a slug', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-node-name')?.textContent).toBe('Resolve the spec folder');
        expect(host.querySelector('.pb-node-id')).toBeNull();
    });

    it('keeps the meta line for what a node produces, and drops it otherwise', () => {
        const { host } = canvas();
        const cards = host.querySelectorAll('.pb-node');
        expect(cards[0].querySelector('.pb-node-meta')).toBeNull();
        expect(cards[1].querySelector('.pb-writes')?.textContent).toBe('spec.md');
    });
});

describe('a hook is drawn on the side it runs', () => {
    const hooked = () => graph({
        steps: [step({
            phases: [{
                name: 'wrap-up', hooks: [],
                nodes: [node({
                    id: 'complete', name: 'Mark the spec complete',
                    hooks: [
                        { when: 'before', type: 'command', summary: 'doctor.py --chat' },
                        { when: 'after', type: 'skill', summary: 'create-pr' },
                    ],
                })],
            }],
        })],
    });

    it('puts before above the node and after below it', () => {
        const { host } = canvas(hooked());
        const group = host.querySelector('.pb-node-group')!;
        const kinds = Array.from(group.children).map(el => el.className);

        expect(kinds[0]).toContain('pb-hooks--before');
        expect(kinds[1]).toContain('pb-node');
        expect(kinds[2]).toContain('pb-hooks--after');
    });

    it('separates the two sides, never mixing them into one list', () => {
        const { host } = canvas(hooked());
        expect(host.querySelector('.pb-hooks--before')?.textContent).toContain('doctor.py');
        expect(host.querySelector('.pb-hooks--before')?.textContent).not.toContain('create-pr');
        expect(host.querySelector('.pb-hooks--after')?.textContent).toContain('create-pr');
    });

    it('draws one connector per side, however many hooks share it', () => {
        const many = graph({
            steps: [step({
                phases: [{
                    name: 'wrap-up', hooks: [],
                    nodes: [node({
                        hooks: [
                            { when: 'after', type: 'prompt', summary: 'one' },
                            { when: 'after', type: 'prompt', summary: 'two' },
                            { when: 'after', type: 'skill', summary: 'create-pr' },
                        ],
                    })],
                }],
            })],
        });
        const { host } = canvas(many);
        expect(host.querySelectorAll('.pb-hooks-arm')).toHaveLength(1);
        expect(host.querySelectorAll('.pb-hook')).toHaveLength(3);
    });

    it('says what a hook does in a verb, not its type name', () => {
        const { host } = canvas(hooked());
        expect(host.querySelector('.pb-hooks--after .pb-hook-verb')?.textContent)
            .toBe('run the skill');
    });

    it('cuts a long hook at a word, and keeps the whole of it on the title', () => {
        const full = 'Read the doctor report above and act on it by this rule, fixing only bookkeeping';
        const long = graph({
            steps: [step({
                phases: [{
                    name: 'wrap-up', hooks: [],
                    nodes: [node({ hooks: [{ when: 'after', type: 'prompt', summary: full }] })],
                }],
            })],
        });
        const { host } = canvas(long);
        const chip = host.querySelector('.pb-hook')!;
        const shown = chip.querySelector('.pb-hook-text')!.textContent!.replace('…', '');

        expect(chip.getAttribute('title')).toBe(full);
        expect(full).toContain(shown);
        expect(shown.endsWith(' ')).toBe(false);
    });

    it('hangs a phase hook off the phase, not off a node', () => {
        const onPhase = graph({
            steps: [step({
                phases: [{
                    name: 'author',
                    hooks: [{ when: 'before', type: 'prompt', summary: 'read the steering docs' }],
                    nodes: [node()],
                }],
            })],
        });
        const { host } = canvas(onPhase);
        const phase = host.querySelector('.pb-phase')!;
        expect(phase.querySelector(':scope > .pb-hooks--before')?.textContent)
            .toContain('read the steering docs');
        expect(host.querySelector('.pb-node-group .pb-hooks')).toBeNull();
    });
});

describe('one hue marks everything the project owns', () => {
    it('marks a replaced node and says whose it is', () => {
        const ours = graph({
            steps: [step({
                phases: [{
                    name: 'author', hooks: [],
                    nodes: [node({ id: 'draft-spec', name: 'Draft the spec', replaced: true })],
                }],
            })],
        });
        const { host } = canvas(ours);
        expect(host.querySelector('.pb-node--yours')).not.toBeNull();
        expect(host.querySelector('.pb-yours')?.textContent).toBe('yours');
    });

    it('marks a template whose sections the project replaced', () => {
        const swapped = graph({
            steps: [step({ template: { file: 'spec-template.md', sections: ['Requirements'] } })],
        });
        const { host } = canvas(swapped);
        expect(host.querySelector('.pb-template--yours')).not.toBeNull();
        // The count is a chip in the lane head; the section names are the title,
        // since a lane is 300px and a heading can be any length.
        expect(host.querySelector('.pb-template .pb-yours')?.textContent).toBe('1 §');
        expect(host.querySelector('.pb-template')?.getAttribute('title'))
            .toContain('Requirements');
    });

    it('leaves a shipped node and a stock template unmarked', () => {
        const plain = graph({
            steps: [step({ template: { file: 'spec-template.md', sections: [] } })],
        });
        const { host } = canvas(plain);
        expect(host.querySelector('.pb-node--yours')).toBeNull();
        expect(host.querySelector('.pb-yours')).toBeNull();
    });
});

describe('a node says whether it can move, and why not', () => {
    const pinned = () => graph({
        steps: [step({
            phases: [{
                name: 'gather', hooks: [],
                nodes: [
                    node({ id: 'resolve-dir', pinned: 'load-living-specs has to run after it' }),
                    node({ id: 'load-living-specs', name: 'Load living specs' }),
                ],
            }],
        })],
    });

    it('offers a grip only on a node that is free to move', () => {
        const { host } = canvas(pinned());
        const nodes = host.querySelectorAll('.pb-node');
        expect(nodes[0].getAttribute('draggable')).toBe('false');
        expect(nodes[1].getAttribute('draggable')).toBe('true');
        expect(nodes[0].querySelector('.pb-grip--pinned')).not.toBeNull();
        expect(nodes[1].querySelector('.pb-grip--pinned')).toBeNull();
    });

    // A bare padlock read as "you may not touch this". It only stops reordering.
    it('says what the lock stops, and what it does not', () => {
        const { host } = canvas(pinned());
        const title = host.querySelector('.pb-grip')?.getAttribute('title') ?? '';

        expect(title).toContain('Cannot be reordered');
        expect(title).toContain('load-living-specs has to run after it');
        expect(title).toContain('rewrite it');
    });

    it('refuses to start a drag from a pinned node', () => {
        const { host, orders } = canvas(pinned());
        drag(host, 0, 1);
        expect(orders).toEqual([]);
    });

    it('sends the step\'s whole order when a free node is dragged', () => {
        const free = graph({
            steps: [step({
                phases: [{
                    name: 'wrap-up', hooks: [],
                    nodes: [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })],
                }],
            })],
        });
        const { host, orders } = canvas(free);
        drag(host, 2, 0);
        expect(orders).toEqual([['specify', ['c', 'a', 'b']]]);
    });
});

describe('what a step produces sits with its name', () => {
    it('counts the artifacts at the top and names them on hover', () => {
        const { host } = canvas();
        const chip = host.querySelector('.pb-step-produces .pb-produces');

        expect(chip?.textContent).toContain('1');
        expect(chip?.getAttribute('title')).toBe('produces spec.md');
        // It used to be a footer line below every node in the lane.
        expect(host.querySelector('.pb-artifacts')).toBeNull();
    });

    it('says nothing when a step produces no file', () => {
        const { host } = canvas(graph({ steps: [step({ artifacts: [] })] }));
        expect(host.querySelector('.pb-produces')).toBeNull();
    });
});

describe('phases are the project\'s to name and group', () => {
    it('renames a phase in place, and sends the whole grouping', () => {
        const { host, grouped } = canvas();
        const name = host.querySelector('.pb-phase-name') as HTMLElement;

        expect(name.getAttribute('contenteditable')).toBe('true');
        name.textContent = 'set up';
        name.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(grouped).toEqual([['specify', [
            { name: 'set up', nodes: ['resolve-dir'] },
            { name: 'author', nodes: ['draft-spec'] },
        ]]]);
    });

    it('says nothing when the name did not change', () => {
        const { host, grouped } = canvas();
        const name = host.querySelector('.pb-phase-name') as HTMLElement;
        name.dispatchEvent(new Event('blur', { bubbles: true }));
        expect(grouped).toEqual([]);
    });

    // Dropping across phases moves a node between them; the order and the
    // grouping have to change together or they contradict each other.
    it('moves a node to another phase when it is dropped there', () => {
        const { host, grouped, orders } = canvas();
        drag(host, 0, 1);

        expect(orders).toEqual([]);
        expect(grouped).toEqual([['specify', [
            { name: 'gather', nodes: [] },
            { name: 'author', nodes: ['resolve-dir', 'draft-spec'] },
        ]]]);
    });
});

describe('attaching work', () => {
    it('offers one add-hook per phase, not a pair on every block', () => {
        const { host } = canvas();   // two phases, one node each
        expect(host.querySelectorAll('.pb-attach')).toHaveLength(2);
    });

    // "Attach" read as "add a block". It adds a hook, and says so.
    it('says a hook is what it adds', () => {
        const { host } = canvas();
        const button = host.querySelector('.pb-attach')!;
        expect(button.textContent).toContain('Add hook');
        expect(button.getAttribute('title')).toContain('Add a hook in gather');
        expect(button.querySelector('svg')).not.toBeNull();
    });

    it('names the phase it would attach to', () => {
        const { host, added } = canvas();
        (host.querySelector('.pb-attach') as HTMLButtonElement).click();
        expect(added).toEqual([['specify', 'gather', 'before']]);
    });
});

describe('opening a node', () => {
    it('asks for the node someone clicked', () => {
        const { host, opened } = canvas();
        (host.querySelector('.pb-node-main') as HTMLButtonElement).click();
        expect(opened).toEqual([['specify', 'resolve-dir']]);
    });

    it('marks the open node so the canvas and the inspector agree', () => {
        const { host } = canvas(graph(), { command: 'specify', nodeId: 'draft-spec' });
        const open = host.querySelectorAll('.pb-node--open');
        expect(open).toHaveLength(1);
        expect(open[0].textContent).toContain('Draft the spec');
    });
});

describe('the inspector reads a node here', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onReplace: noop, onRestore: noop, onAttach: noop,
    };

    it('renders the instructions instead of the raw file', () => {
        const host = mount(
            <Inspector node={node({ name: 'Draft the spec' })} step="specify"
                body={'## Write it\n\n- Load `spec-template.md`\n- Keep every section'}
                parts={[]} {...actions} />,
        );
        expect(host.querySelector('.pb-doc-heading')?.textContent).toBe('Write it');
        expect(host.querySelectorAll('.pb-doc-list li')).toHaveLength(2);
        expect(host.querySelector('.pb-doc-inline')?.textContent).toBe('spec-template.md');
    });

    it('names the shared blocks rather than showing the fences', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="" parts={['timing', 'self-advance']}
                {...actions} />,
        );
        expect(host.querySelector('.pb-doc-parts')?.textContent).toContain('timing, self-advance');
        expect(host.textContent).toContain('no instructions of its own');
    });

    it('says why a node is held in place', () => {
        const host = mount(
            <Inspector node={node({ pinned: 'quality-checklist has to run after it' })}
                step="specify" body="x" parts={[]} {...actions} />,
        );
        expect(host.textContent).toContain('quality-checklist has to run after it');
    });

    it('offers to take a shipped node over, and to hand a replaced one back', () => {
        const shipped = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        expect(shipped.textContent).toContain('Make it mine');

        document.body.innerHTML = '';
        const ours = mount(
            <Inspector node={node({ replaced: true })} step="specify" body="x" parts={[]}
                {...actions} />);
        expect(ours.textContent).toContain('Use the shipped node');
    });

    it('waits visibly rather than showing an empty body', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body={null} parts={[]} {...actions} />);
        expect(host.querySelector('.pb-doc-waiting')?.textContent).toBe('Reading…');
    });
});

describe('the header says what this pipeline is', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    it('reads as the shipped default when nothing was changed', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('Shipped default');
    });

    it('expands to say what changed', async () => {
        const customised = graph({
            customised: true,
            steps: [step({ changes: { ...NO_CHANGES, removed: ['quality-checklist'], hooks: 2 } })],
        });
        const host = mount(
            <Header graph={customised} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-changes')).toBeNull();

        (host.querySelector('.builder-chip') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const listed = host.querySelector('.builder-changes')?.textContent ?? '';
        expect(listed).toContain('quality-checklist');
        expect(listed).toContain('2 hooks');
    });

    it('says plainly when the built commands are behind the configuration', () => {
        const host = mount(
            <Header graph={graph()} buildState="stale" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice')?.textContent)
            .toContain('still reading the old commands');
    });

    it('says nothing about staleness when the build is current', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice')).toBeNull();
    });

    it('disables the actions while a build is running', () => {
        const host = mount(<Header graph={graph()} buildState="current" busy {...HEAD} />);
        const primary = host.querySelector('.builder-action--primary') as HTMLButtonElement;
        expect(primary.disabled).toBe(true);
        expect(primary.textContent).toContain('Building');
    });

    it('surfaces a warning the build reported', () => {
        const host = mount(
            <Header graph={graph({ warnings: ['hook anchor nope not in active recipe — skipped'] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(host.textContent).toContain('not in active recipe');
    });
});

describe('switching workflows', () => {
    const noop = () => undefined;

    function header(g: PipelineGraph) {
        const picked: string[] = [];
        let created = 0;
        const host = mount(
            <Header graph={g} buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={name => picked.push(name)}
                onNewWorkflow={() => { created += 1; }} />,
        );
        return { host, picked, count: () => created };
    }

    it('names the workflow in force', () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: 'bugfix' },
        }));
        expect(host.querySelector('.builder-workflow-current')?.textContent).toContain('bugfix');
    });

    it('calls an unnamed configuration what it is, not blank', () => {
        const { host } = header(graph());
        expect(host.querySelector('.builder-workflow-current')?.textContent)
            .toContain('This project');
    });

    it('lists every workflow, with shipped explained', async () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix', 'client'], active: '' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const options = Array.from(host.querySelectorAll('.builder-workflow-option'));
        expect(options.map(el => el.textContent)).toEqual([
            'As it shipsCompanion with nothing changed', 'bugfix', 'client', 'New workflow…',
        ]);
    });

    it('reports the one someone picked', async () => {
        const { host, picked } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: '' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        (host.querySelectorAll('.builder-workflow-option')[1] as HTMLButtonElement).click();

        expect(picked).toEqual(['bugfix']);
    });

    it('offers to start a new one', async () => {
        const { host, count } = header(graph());
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const options = host.querySelectorAll('.builder-workflow-option');
        (options[options.length - 1] as HTMLButtonElement).click();

        expect(count()).toBe(1);
    });
});
