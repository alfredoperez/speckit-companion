/**
 * @jest-environment jsdom
 */
import { render } from 'preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { Inspector } from '../Inspector';
import { AttachForm, NewStepForm, NewWorkflowForm } from '../AttachForm';
import type { PipelineGraph, PipelineNode, PipelineStep } from '../../../../src/protocol/pipeline';

function node(overrides: Partial<PipelineNode> = {}): PipelineNode {
    return {
        id: 'resolve-dir', name: 'Resolve the spec folder', kind: 'control',
        reads: [], writes: [], mayWrite: [], hooks: [], variants: [], pinned: '',
        source: '/ext/nodes/specify/resolve-dir.md', replaced: false, shipped: true,
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

function graph(overrides: Partial<PipelineGraph> = {}): PipelineGraph {
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
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

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
    const edited: Calls = [];
    const addedNodes: Array<Record<string, unknown>> = [];
    const frames: string[] = [];
    const replacedSteps: string[] = [];
    const templates: string[] = [];
    let newSteps = 0;
    const host = mount(
        <Canvas graph={g} selected={selected}
            onNewStep={() => { newSteps += 1; }}
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
        frames, replacedSteps, templates, newSteps: () => newSteps };
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

describe('every place a hook can attach is drawn', () => {
    // The board used to show only what a project had already done, so the only
    // way to learn work could be attached somewhere was to hover it.
    //
    // One seam per gap, though: `after <a node>` and `before <the next>` are two
    // anchors for a single insertion point, and drawing both put a pair of
    // dashed lines at every join. A phase owns its two edges; each node after
    // the first owns the gap above it.
    it('marks an empty anchor with a slot naming it', () => {
        const { host } = canvas();
        const slots = Array.from(host.querySelectorAll('.pb-slot'))
            .map(el => el.textContent);
        expect(slots).toEqual([
            'before gather', 'after gather', 'before author', 'after author',
        ]);
    });

    it('draws one seam per gap rather than one per anchor', () => {
        // Three nodes in a phase: the phase's two edges plus the two joins
        // between its nodes — four, not eight.
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'gather', hooks: [],
                    nodes: [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })],
                }],
            })],
        }));
        const slots = Array.from(host.querySelectorAll('.pb-slot'))
            .map(el => el.textContent);
        expect(slots).toEqual(['before gather', 'before b', 'before c', 'after gather']);
    });

    it('adds a hook at the anchor whose slot was clicked', () => {
        const { host, added } = canvas();
        const slot = Array.from(host.querySelectorAll('.pb-slot'))
            .find(el => el.textContent === 'before author') as HTMLButtonElement;
        slot.click();
        expect(added).toEqual([['specify', 'author', 'before']]);
    });

    it('shows the hooks instead of a slot once an anchor has any', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'gather',
                    hooks: [{
                        when: 'before', type: 'prompt', summary: 'check the branch',
                        anchor: 'gather', index: 0, note: '',
                    }],
                    nodes: [node()],
                }],
            })],
        }));
        const slots = Array.from(host.querySelectorAll('.pb-slot')).map(el => el.textContent);
        expect(slots).not.toContain('before gather');
        expect(slots).toContain('after gather');
        expect(host.querySelector('.pb-hooks')).not.toBeNull();
    });
});

describe("hooks another extension registered run in the lane, not beneath it", () => {
    const stock = (when: 'before' | 'after') => ({
        when, extension: 'git', command: 'speckit.git.commit',
        description: 'Commit the work', optional: true, conditional: false,
    });

    it('draws them at the step edges, in the same shape as your own hooks', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('before'), stock('after')] })],
        }));
        // Not a separate labelled block at the foot of the lane any more.
        expect(host.querySelector('.pb-stock')).toBeNull();

        const chips = Array.from(host.querySelectorAll('.pb-hook--stock'));
        expect(chips).toHaveLength(2);
        expect(chips[0].textContent).toContain('speckit.git.commit');
        expect(chips[0].textContent).toContain('git');
    });

    it('says whose they are and that they are not edited here', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('after')] })],
        }));
        const chip = host.querySelector('.pb-hook--stock')!;
        expect(chip.getAttribute('title')).toContain('git');
        expect(chip.getAttribute('title')).toContain('not edited in this panel');
        // A click that cannot edit would be a worse lie than no click.
        expect(chip.tagName).toBe('SPAN');
    });

    it('lands the before ones on the first node and the after ones on the last', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('before'), stock('after')] })],
        }));
        const groups = Array.from(host.querySelectorAll('.pb-node-group'));
        expect(groups[0].querySelectorAll('.pb-hook--stock')).toHaveLength(1);
        expect(groups[groups.length - 1].querySelectorAll('.pb-hook--stock')).toHaveLength(1);
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
                        { when: 'before', type: 'command', summary: 'doctor.py --chat', anchor: '', index: 0, note: ''  },
                        { when: 'after', type: 'skill', summary: 'create-pr', anchor: '', index: 0, note: ''  },
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
                            { when: 'after', type: 'prompt', summary: 'one', anchor: '', index: 0, note: ''  },
                            { when: 'after', type: 'prompt', summary: 'two', anchor: '', index: 0, note: ''  },
                            { when: 'after', type: 'skill', summary: 'create-pr', anchor: '', index: 0, note: ''  },
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
                    nodes: [node({ hooks: [{
                        when: 'after', type: 'prompt', summary: full,
                        anchor: 'resolve-dir', index: 0, note: '',
                    }] })],
                }],
            })],
        });
        const { host } = canvas(long);
        const chip = host.querySelector('.pb-hook')!;
        const shown = chip.querySelector('.pb-hook-text')!.textContent!.replace('…', '');

        expect(chip.getAttribute('title')).toContain(full);
        expect(full).toContain(shown);
        expect(shown.endsWith(' ')).toBe(false);
    });

    it('hangs a phase hook off the phase, not off a node', () => {
        const onPhase = graph({
            steps: [step({
                phases: [{
                    name: 'author',
                    hooks: [{ when: 'before', type: 'prompt', summary: 'read the steering docs', anchor: '', index: 0, note: ''  }],
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
            steps: [step({ template: { file: 'spec-template.md', sections: ['Requirements'], sectionsAvailable: [], chosenBy: {} } })],
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
            steps: [step({ template: { file: 'spec-template.md', sections: [], sectionsAvailable: [], chosenBy: {} } })],
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
        const chip = host.querySelector('.pb-step-facts .pb-produces');

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
        // `gather` is gone: moving its only node out emptied it, and a phase
        // with nothing in it renders nothing and cannot be written. Writing it
        // empty produced a configuration the panel could not read back.
        expect(grouped).toEqual([['specify', [
            { name: 'author', nodes: ['resolve-dir', 'draft-spec'] },
        ]]]);
    });

    it('keeps a phase that still has something in it', () => {
        const two = graph({
            steps: [step({
                phases: [
                    { name: 'gather', hooks: [], nodes: [node({ id: 'a' }), node({ id: 'b' })] },
                    { name: 'author', hooks: [], nodes: [node({ id: 'c' })] },
                ],
            })],
        });
        const { host, grouped } = canvas(two);
        drag(host, 0, 2);

        expect(grouped).toEqual([['specify', [
            { name: 'gather', nodes: ['b'] },
            { name: 'author', nodes: ['a', 'c'] },
        ]]]);
    });
});

describe('a phase is a block a project owns', () => {
    /** Three phases, so moving and removing have somewhere to go. */
    function three() {
        return graph({
            steps: [step({
                dropped: ['branch', 'finalize'],
                phases: [
                    { name: 'gather', hooks: [], nodes: [node({ id: 'a' }), node({ id: 'b' })] },
                    { name: 'author', hooks: [], nodes: [node({ id: 'c' })] },
                    { name: 'wrap-up', hooks: [], nodes: [node({ id: 'd' })] },
                ],
            })],
        });
    }

    // The phase's own split/merge tools. `+ node` shares the class and is now a
    // button too, so it is excluded by name rather than by tag.
    const tools = (host: HTMLElement, phase: number) =>
        Array.from(host.querySelectorAll('.pb-phase')[phase]
            .querySelectorAll('button.pb-phase-tool:not(.pb-phase-add-node)'),
        ) as HTMLButtonElement[];

    it('does not offer to reorder phases', () => {
        // A phase is a contiguous run of the step, so moving one moves its
        // nodes — and across every step this pipeline ships, not one such move
        // survives the `reads:` dependencies: 0 of 18. The arrows that used to
        // sit here fired, were refused by the writer, and left the panel
        // redrawn unchanged, which reads as a button that does nothing.
        const { host } = canvas(three());
        const titles = tools(host, 1).map(button => button.title);
        expect(titles.some(title => /move/i.test(title))).toBe(false);
    });

    // A phase's nodes have to land somewhere; dropping them would drop work.
    it('folds a removed phase into the one above it', () => {
        const { host, grouped } = canvas(three());
        tools(host, 1)[1].click();
        expect(grouped[0][1]).toEqual([
            { name: 'gather', nodes: ['a', 'b', 'c'] },
            { name: 'wrap-up', nodes: ['d'] },
        ]);
    });

    it('folds the first phase into the one below it', () => {
        const { host, grouped } = canvas(three());
        tools(host, 0)[1].click();
        expect(grouped[0][1]).toEqual([
            { name: 'author', nodes: ['a', 'b', 'c'] },
            { name: 'wrap-up', nodes: ['d'] },
        ]);
    });

    it('will not remove the only phase a step has', () => {
        const { host } = canvas(graph({
            steps: [step({ phases: [{ name: 'only', hooks: [], nodes: [node()] }] })],
        }));
        expect(tools(host, 0)[1].disabled).toBe(true);
    });

    // A new phase is born empty, and an empty phase cannot be written — so it
    // takes a node from the phase it follows.
    it('adds a phase by splitting the one before it', () => {
        const { host, grouped } = canvas(three());
        tools(host, 0)[0].click();
        expect(grouped[0][1]).toEqual([
            { name: 'gather', nodes: ['a'] },
            { name: 'new phase', nodes: ['b'] },
            { name: 'author', nodes: ['c'] },
            { name: 'wrap-up', nodes: ['d'] },
        ]);
    });

    it('will not offer to split a phase that has only one node', () => {
        // Disabled rather than silently doing nothing: the split has to take a
        // node off the end, and a one-node phase has none to give.
        const { host, grouped } = canvas(three());
        expect(tools(host, 1)[0].disabled).toBe(true);
        tools(host, 1)[0].click();
        expect(grouped).toEqual([]);
    });
});

describe('a dropped node can be put back', () => {
    const withDropped = () => graph({
        steps: [step({
            dropped: ['branch', 'finalize'],
            phases: [{ name: 'gather', hooks: [], nodes: [node({ id: 'a' })] }],
        })],
    });

    it('offers only the nodes this step actually dropped', async () => {
        const { host } = canvas(withDropped());
        (host.querySelector('.pb-phase-add-node') as HTMLButtonElement).click();
        await flush();
        const options = Array.from(host.querySelectorAll('.pb-menu-label'))
            .map(el => el.textContent);
        expect(options).toEqual(['branch', 'finalize']);
    });

    it('still says where nodes come from when there are none to put back', () => {
        // Hiding the control left "how do I add a node here?" with no answer
        // anywhere on screen — the thing that would have explained itself was
        // the thing that was absent.
        const { host } = canvas();
        const control = host.querySelector('.pb-phase-add-node');
        expect(control).not.toBeNull();
        expect(control!.tagName).toBe('SPAN');
        expect(control!.getAttribute('title')).toMatch(/drag it in from another phase/);
        expect(control!.classList.contains('pb-menu-trigger--inert')).toBe(true);
    });

    // The order says when it runs and the phase says where it sits; one without
    // the other is a pipeline that contradicts itself.
    it('sends the order and the grouping together', async () => {
        const { host, addedNodes } = canvas(withDropped());
        (host.querySelector('.pb-phase-add-node') as HTMLButtonElement).click();
        await flush();
        (host.querySelectorAll('.pb-menu-option')[0] as HTMLButtonElement).click();

        expect(addedNodes).toEqual([{
            c: 'specify', id: 'branch', phase: 'gather',
            order: ['a', 'branch'],
            phases: [{ name: 'gather', nodes: ['a', 'branch'] }],
        }]);
    });
});

describe("a step has instructions of its own", () => {
    it('opens them from the step name', () => {
        const { host, frames } = canvas();
        (host.querySelector('.pb-step-open') as HTMLButtonElement).click();
        expect(frames).toEqual(['specify']);
    });

    // Rewriting each shipped node in place is the wrong shape for "use their
    // plan instead of ours" — you want one file to paste into.
    it('hands the whole step to one document of your own', () => {
        const { host, replacedSteps } = canvas();
        const button = host.querySelector('.pb-step-replace') as HTMLButtonElement;
        expect(button.textContent).toBe('Make it ours');
        button.click();
        expect(replacedSteps).toEqual(['specify']);
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

describe('a hook can be changed once it is there', () => {
    const hooked = () => graph({
        steps: [step({
            phases: [{
                name: 'wrap-up', hooks: [],
                nodes: [node({
                    id: 'complete',
                    hooks: [{
                        when: 'before', type: 'command', anchor: 'complete', index: 0, note: '',
                        summary: 'python3 .specify/extensions/companion/scripts/doctor.py --chat',
                    }],
                })],
            }],
        })],
    });

    // Every hook could be added and none could be touched again.
    it('opens the hook someone clicks, with its address', () => {
        const { host, edited } = canvas(hooked());
        (host.querySelector('.pb-hook') as HTMLButtonElement).click();
        expect(edited).toEqual([['specify', 'complete', '0']]);
    });

    // The path is where it lives; the script name is which command it is.
    it('shows a shell hook by its script, not its whole path', () => {
        const { host } = canvas(hooked());
        const shown = host.querySelector('.pb-hook-ref')?.textContent ?? '';
        expect(shown).toBe('doctor.py --chat');
        expect(host.querySelector('.pb-hook')?.getAttribute('title'))
            .toContain('.specify/extensions/companion/scripts/doctor.py');
    });

    it('offers what the project has, rather than asking you to remember', () => {
        const noop = () => undefined;
        const sheet = mount(
            <AttachForm step={step()} anchor="gather"
                choices={{ skills: ['create-pr', 'verify-code-review'], nodes: ['review'],
                    fragments: [], presets: [] }}
                onCancel={noop} onAttach={noop} />,
        );
        const options = Array.from(sheet.querySelectorAll('datalist option'))
            .map(el => el.getAttribute('value'));
        expect(options).toEqual(['create-pr', 'verify-code-review']);
        expect(sheet.querySelector('.pb-field-help')?.textContent).toContain('2 in this project');
    });

    it('fills the form from the hook it is editing, and offers to remove it', () => {
        const noop = () => undefined;
        const sheet = mount(
            <AttachForm step={step()} anchor="complete"
                choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
                editing={{
                    when: 'after', type: 'skill', summary: 'create-pr',
                    anchor: 'complete', index: 1, note: 'only on green',
                }}
                onCancel={noop} onAttach={noop} onRemove={noop} />,
        );
        expect(sheet.querySelector('.pb-side-title')?.textContent).toBe('Edit hook');
        expect((sheet.querySelector('.pb-input--mono') as HTMLInputElement).value)
            .toBe('create-pr');
        expect(sheet.querySelector('.pb-action--primary')?.textContent).toContain('Save hook');
        expect(sheet.querySelector('.pb-action--remove')).not.toBeNull();
    });

    it('says nothing about removing when it is a new hook', () => {
        const noop = () => undefined;
        const sheet = mount(
            <AttachForm step={step()} anchor="gather" choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
                onCancel={noop} onAttach={noop} />);
        expect(sheet.querySelector('.pb-action--remove')).toBeNull();
    });
});

describe('the changed mark says what changed', () => {
    it('names the change on the dot', () => {
        const { host } = canvas(graph({
            steps: [step({ changes: { ...NO_CHANGES, hooks: 2, replaced: ['draft-spec'] } })],
        }));
        const title = host.querySelector('.pb-changed-dot')?.getAttribute('title') ?? '';
        expect(title).toContain('2 hooks');
        expect(title).toContain('rewrote draft-spec');
    });

    it('shows no mark on a step the project left alone', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-changed-dot')).toBeNull();
    });

    // One fact, one mark: a CSS ::after and a real element both drew a dot, and
    // only the element carries the tooltip that says what changed.
    it('draws exactly one mark per changed step', () => {
        const { host } = canvas(graph({
            steps: [step({ changes: { ...NO_CHANGES, hooks: 1 } })],
        }));
        expect(host.querySelectorAll('.pb-changed-dot')).toHaveLength(1);
        const css = Array.from(document.styleSheets).length;
        void css;
    });
});

describe('one action keeps one name through the flow', () => {
    const noop = () => undefined;

    it('says "Add hook" on the phase, in the sheet, and on the confirm', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-attach')?.textContent).toContain('Add hook');

        document.body.innerHTML = '';
        const sheet = mount(
            <AttachForm step={step()} anchor="gather" choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
                onCancel={noop} onAttach={noop} />,
        );
        expect(sheet.querySelector('.pb-side-title')?.textContent).toBe('Add hook');
        expect(sheet.querySelector('.pb-action--primary')?.textContent).toContain('Add hook');
    });

    it('names the anchor field for where it goes, not what it is', () => {
        const sheet = mount(
            <AttachForm step={step()} anchor="gather" choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
                onCancel={noop} onAttach={noop} />);
        const labels = Array.from(sheet.querySelectorAll('.pb-field-label'))
            .map(el => el.textContent);
        expect(labels).toContain('Where');
        expect(labels).not.toContain('What');
    });
});

describe('the inspector reads a node here', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop,
        editable: 'the stored text',
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

    // Editing a node is what makes it yours, so there is no separate step to
    // press first. Only a node already yours offers the way back.
    it('offers to edit either node, and to hand a replaced one back', () => {
        const shipped = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        expect(shipped.textContent).toContain('Edit');
        expect(shipped.textContent).not.toContain('Make it mine');
        expect(shipped.textContent).not.toContain('Use the shipped node');

        document.body.innerHTML = '';
        const ours = mount(
            <Inspector node={node({ replaced: true })} step="specify" body="x" parts={[]}
                {...actions} />);
        expect(ours.textContent).toContain('Edit');
        expect(ours.textContent).toContain('Use the shipped node');
    });

    it('edits in place, and saves the stored text rather than the rendered text', async () => {
        const saved: string[] = [];
        const host = mount(
            <Inspector node={node()} step="specify"
                body={'Load `spec-template.md`'} parts={['timing']} {...actions}
                editable={'Load `spec-template.md`\n<!-- speckit-companion:part timing -->'}
                onSave={(text: string) => saved.push(text)} />);

        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit') as HTMLButtonElement).click();
        await flush();

        const box = host.querySelector('.pb-doc-edit') as HTMLTextAreaElement;
        // The fences come with it: they are where the shared blocks land, and
        // saving the rendered text back would delete every one of them.
        expect(box.value).toContain('speckit-companion:part timing');

        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Save') as HTMLButtonElement).click();
        expect(saved).toHaveLength(1);
        expect(saved[0]).toContain('speckit-companion:part timing');
    });

    it('says that saving a shipped node writes your own copy', async () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit') as HTMLButtonElement).click();
        await flush();
        expect(host.textContent).toContain('writes your own copy');
        expect(host.textContent).toContain('shipped one is left alone');
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

describe('giving a node back to the shipped one', () => {
    const noop = () => undefined;

    function inspect(over: Partial<PipelineNode>) {
        const host = mount(
            <Inspector node={node(over)} step="specify" body="Words." editable="Words."
                parts={[]} onClose={noop} onOpenFile={noop} onSave={noop}
                onRestore={noop} onAttach={noop} onUseVariant={noop} />,
        );
        return Array.from(host.querySelectorAll('.pb-inspector-action'))
            .map(el => el.textContent);
    }

    it('offers it for a node this project rewrote', () => {
        expect(inspect({ replaced: true, shipped: true })).toContain('Use the shipped node');
    });

    // The bug this exists for: a step handed to one document, or a node someone
    // wrote, is `replaced` and ships nowhere. Giving it "back" deleted the only
    // copy while the configuration still ordered it, and the pipeline read as
    // broken with no way out from inside the panel.
    it('does not offer it for a node that ships nowhere', () => {
        expect(inspect({ id: 'specify-ours', replaced: true, shipped: false }))
            .not.toContain('Use the shipped node');
    });

    it('does not offer it for a node the project never touched', () => {
        expect(inspect({ replaced: false, shipped: true })).not.toContain('Use the shipped node');
    });
});

describe('what the + node picker offers', () => {
    // A node the recipe took out and one the step ships but does not run read
    // identically as bare ids, so the list gave no clue which was which.
    it('says what picking one means, rather than gluing a suffix to its name', async () => {
        const { host } = canvas(graph({
            steps: [step({ dropped: ['branch', 'clarify'], addOns: ['clarify'] })],
        }));
        (host.querySelector('.pb-phase-add-node') as HTMLButtonElement).click();
        await flush();
        const rows = Array.from(host.querySelectorAll('.pb-menu-option')).map(el => ({
            label: el.querySelector('.pb-menu-label')?.textContent,
            note: el.querySelector('.pb-menu-note')?.textContent,
        }));
        expect(rows).toEqual([
            { label: 'branch', note: 'this project took it out' },
            { label: 'clarify', note: 'specify ships this and does not run it' },
        ]);
    });
});

describe('a step of the project\'s own', () => {
    const noop = () => undefined;

    it('offers to add one at the end of the run', () => {
        const { host } = canvas();
        const add = host.querySelector('.pb-add-step');
        expect(add).not.toBeNull();
        expect(add?.textContent).toContain('step');
    });

    it('reports the click rather than acting on it', () => {
        const { host, newSteps } = canvas();
        (host.querySelector('.pb-add-step') as HTMLButtonElement).click();
        expect(newSteps()).toBe(1);
    });

    // The invitation belongs after the last lane, not before the first.
    it('draws the invitation after every step in the run', () => {
        const { host } = canvas(graph({
            steps: [step({ name: 'specify' }), step({ name: 'plan' })],
        }));
        const run = host.querySelector('.pb-run') as HTMLElement;
        expect(run.lastElementChild?.classList.contains('pb-add-step')).toBe(true);
    });

    // `auto` is not a step; a project's own step outside the run is. They sit in
    // the same place and had the same sentence, which was true of only one.
    it('does not tell a project\'s own step it orchestrates the others', () => {
        const { host } = canvas(graph({
            steps: [
                step({ name: 'specify' }),
                step({ name: 'audit', inSequence: false, own: true }),
            ],
        }));
        const aside = host.querySelector('.pb-aside');
        expect(aside?.textContent).toContain('launched when you want it');
        expect(aside?.textContent).not.toContain('hands-off');
    });
});

describe('starting a workflow from something', () => {
    const noop = () => undefined;

    function form(presets = PRESETS, from = '') {
        const made: Array<[string, string]> = [];
        const host = mount(
            <NewWorkflowForm from={from} taken={['shipped']} presets={presets}
                onCancel={noop} onCreate={(name, seed) => made.push([name, seed])} />,
        );
        return { host, made };
    }

    const PRESETS = [
        { name: 'classic', label: 'Classic spec-kit', summary: 'Stock shapes.' },
        { name: 'brownfield', label: 'Brownfield', summary: 'For an existing system.' },
    ];

    const type = (host: HTMLElement, value: string) => {
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('offers every shipped preset by its label', () => {
        const { host } = form();
        const options = Array.from(host.querySelectorAll('optgroup option'));
        expect(options.map(el => el.textContent)).toEqual(['Classic spec-kit', 'Brownfield']);
    });

    // The default is what you are on. A picker that started at a preset would
    // quietly discard the configuration someone is already running.
    it('starts from the workflow in force', async () => {
        const { host, made } = form(PRESETS, 'bugfix');
        type(host, 'mine');
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made).toEqual([['mine', 'bugfix']]);
    });

    it('sends the preset someone picked, prefixed so it is not read as a workflow', async () => {
        const { host, made } = form();
        type(host, 'mine');
        const select = host.querySelector('select') as HTMLSelectElement;
        select.value = 'preset:brownfield';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made).toEqual([['mine', 'preset:brownfield']]);
    });

    it('says what a picked preset does before it is committed to', async () => {
        const { host } = form();
        const select = host.querySelector('select') as HTMLSelectElement;
        select.value = 'preset:classic';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-field-note')?.textContent).toBe('Stock shapes.');
    });

    it('shows no preset group when none ship', () => {
        const { host } = form([]);
        expect(host.querySelector('optgroup')).toBeNull();
    });
});

describe('naming a new step', () => {
    const noop = () => undefined;
    const SEQUENCE = ['specify', 'plan', 'tasks', 'implement'];

    function form() {
        const made: Array<Record<string, string>> = [];
        const host = mount(
            <NewStepForm sequence={SEQUENCE} taken={[...SEQUENCE, 'auto']}
                onCancel={noop} onCreate={step => made.push(step)} />,
        );
        return { host, made };
    }

    const type = (host: HTMLElement, value: string) => {
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const submit = (host: HTMLElement) =>
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    it('places it after the last step in the run by default', async () => {
        const { host, made } = form();
        type(host, 'review');
        await flush();
        submit(host);
        expect(made[0].after).toBe('implement');
    });

    it('offers to leave it out of the run', () => {
        const { host } = form();
        const options = Array.from(host.querySelectorAll('select option'));
        expect(options[options.length - 1].textContent).toContain('I launch it myself');
    });

    // The name becomes a command, so a space or a capital produces something
    // nobody can type.
    it('refuses a name that cannot be a command', async () => {
        const { host } = form();
        type(host, 'Review This');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('it becomes a command');
        expect((host.querySelector('.pb-action--primary') as HTMLButtonElement).disabled)
            .toBe(true);
    });

    it('refuses a name a step already has', async () => {
        const { host } = form();
        type(host, 'plan');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('already a step called plan');
    });

    it('says what it will write and what the assistant will be able to run', async () => {
        const { host } = form();
        type(host, 'review');
        await flush();
        const preview = host.querySelector('.pb-form-preview')?.textContent ?? '';
        expect(preview).toContain('.specify/companion/nodes/review/');
        expect(preview).toContain('/speckit.companion.review');
    });
});
