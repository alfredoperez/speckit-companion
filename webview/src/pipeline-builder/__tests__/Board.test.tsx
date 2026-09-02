/**
 * @jest-environment jsdom
 */
import { AttachForm } from '../AttachForm';
import { NO_CHANGES, canvas, drag, flush, graph, mount, node, step } from './support';

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

    // `auto` runs the others. Drawn as a peer it reads as a fifth step — but it
    // used to be a full-width band across the TOP of the board, which is the
    // most prominent place on screen for the one thing outside the sequence.
    it('keeps a step outside the run out of the row, at the end of it', () => {
        const withAuto = graph({
            steps: [step({ name: 'specify' }), step({ name: 'auto', inSequence: false })],
        });
        const { host } = canvas(withAuto);

        expect(host.querySelectorAll('.pb-run .pb-step')).toHaveLength(1);
        const run = host.querySelector('.pb-run') as HTMLElement;
        expect(run.lastElementChild?.className).toContain('pb-outside');
        const aside = host.querySelector('.pb-aside');
        expect(aside?.textContent).toContain('auto');
        expect(host.querySelector('.pb-outside-head')?.textContent).toBe('Outside the run');
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

describe('where work can be attached', () => {
    // A seam per gap between two nodes. The phase's own edges lost theirs: the
    // phase header carries an explicit "Add hook", which answers "how do I
    // attach work here" better than a dashed line ever did.
    it('marks each gap between two nodes', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'gather', hooks: [],
                    nodes: [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })],
                }],
            })],
        }));
        expect(Array.from(host.querySelectorAll('.pb-slot')).map(el => el.textContent))
            .toEqual(['before b', 'before c']);
    });

    it('adds a hook at the anchor whose seam was clicked', () => {
        const { host, added } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'gather', hooks: [],
                    nodes: [node({ id: 'a' }), node({ id: 'b' })],
                }],
            })],
        }));
        (host.querySelector('.pb-slot') as HTMLButtonElement).click();
        expect(added).toEqual([['specify', 'b', 'before']]);
    });

    it('offers Add hook on every phase, which is the discoverable way in', () => {
        const { host } = canvas();
        expect(host.querySelectorAll('.pb-attach')).toHaveLength(2);
    });
});

describe('everything attached to one anchor sits in one block', () => {
    const hooked = () => graph({
        steps: [step({
            phases: [{
                name: 'wrap-up', hooks: [],
                nodes: [node({
                    id: 'complete', name: 'Mark the spec complete',
                    hooks: [
                        { when: 'before', type: 'command', summary: 'doctor.py --chat', anchor: '', index: 0, note: '' },
                        { when: 'after', type: 'skill', summary: 'create-pr', anchor: '', index: 0, note: '' },
                    ],
                })],
            }],
        })],
    });

    // Two boxes with two connector arms used to straddle a node with work on
    // both sides, repeating its name four times. Position was carrying the
    // before/after meaning and was not carrying it.
    it('is one block, under the node, however many sides have work', () => {
        const { host } = canvas(hooked());
        const group = host.querySelector('.pb-node-group')!;
        expect(group.querySelectorAll('.pb-attached')).toHaveLength(1);
        expect(Array.from(group.children).map(el => el.className)[0]).toContain('pb-node');
    });

    it('names the two sides in words rather than by where they sit', () => {
        const { host } = canvas(hooked());
        expect(Array.from(host.querySelectorAll('.pb-attached-when')).map(el => el.textContent))
            .toEqual(['before', 'after']);
    });

    it('keeps each side to its own list', () => {
        const { host } = canvas(hooked());
        const sides = Array.from(host.querySelectorAll('.pb-attached-side'));
        expect(sides[0].textContent).toContain('doctor.py');
        expect(sides[0].textContent).not.toContain('create-pr');
        expect(sides[1].textContent).toContain('create-pr');
    });

    it('draws nothing at all for an anchor with no work', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-attached')).toBeNull();
    });

    it('says what a hook does in a verb, not its type name', () => {
        const { host } = canvas(hooked());
        const after = host.querySelectorAll('.pb-attached-side')[1];
        expect(after.querySelector('.pb-hook-verb')?.textContent).toBe('run the skill');
    });

    it('cuts a long hook at a word, and keeps the whole of it on the title', () => {
        const full = 'Read the doctor report above and act on it by this rule, fixing only bookkeeping';
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'wrap-up', hooks: [],
                    nodes: [node({ hooks: [{
                        when: 'after', type: 'prompt', summary: full,
                        anchor: 'resolve-dir', index: 0, note: '',
                    }] })],
                }],
            })],
        }));
        const chip = host.querySelector('.pb-hook')!;
        const shown = chip.querySelector('.pb-hook-text')!.textContent!.replace('\u2026', '');
        expect(chip.getAttribute('title')).toContain(full);
        expect(full).toContain(shown);
        expect(shown.endsWith(' ')).toBe(false);
    });

    it('hangs a phase hook off the phase, not off a node', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'author',
                    hooks: [{ when: 'before', type: 'prompt', summary: 'read the steering docs', anchor: '', index: 0, note: '' }],
                    nodes: [node()],
                }],
            })],
        }));
        const phase = host.querySelector('.pb-phase')!;
        expect(phase.querySelector(':scope > .pb-attached')?.textContent)
            .toContain('read the steering docs');
        expect(host.querySelector('.pb-node-group .pb-attached')).toBeNull();
    });
});

describe("hooks another extension registered run in the lane, not beneath it", () => {
    const stock = (when: 'before' | 'after') => ({
        when, extension: 'git', command: 'speckit.git.commit',
        description: 'Commit the work', optional: true, conditional: false,
    });

    it('draws them in the same block and the same shape as your own', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('before'), stock('after')] })],
        }));
        expect(host.querySelector('.pb-stock')).toBeNull();
        const chips = Array.from(host.querySelectorAll('.pb-hook--stock'));
        expect(chips).toHaveLength(2);
        expect(chips[0].textContent).toContain('speckit.git.commit');
    });

    // The extension's name was printed on every one of these. The hue already
    // says whose it is, and it was the most repeated word on the board.
    it('does not repeat whose it is on every row', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('after')] })],
        }));
        expect(host.querySelector('.pb-hook-from')).toBeNull();
        expect(host.querySelector('.pb-hook--stock')!.getAttribute('title')).toContain('git');
    });

    it('says it is not edited here, and is still readable', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('after')] })],
        }));
        const chip = host.querySelector('.pb-hook--stock')!;
        expect(chip.getAttribute('title')).toContain('not edited in this panel');
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

    // The invitation belongs after the last lane, beside the other things that
    // do not take a turn in the run.
    it('draws the invitation after every step in the run', () => {
        const { host } = canvas(graph({
            steps: [step({ name: 'specify' }), step({ name: 'plan' })],
        }));
        const run = host.querySelector('.pb-run') as HTMLElement;
        const tail = run.lastElementChild!;
        expect(tail.classList.contains('pb-outside')).toBe(true);
        expect(tail.querySelector('.pb-add-step')).not.toBeNull();
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
