/**
 * @jest-environment jsdom
 */
import { AttachForm } from '../AttachForm';
import { NO_CHANGES, canvas, drag, flush, graph, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

/** Open a phase's one resting control and read back what it offers. */
async function phaseMenu(host: HTMLElement, at = 0) {
    const phase = host.querySelectorAll('.pb-phase')[at];
    (phase.querySelector('.pb-phase-add') as HTMLButtonElement).click();
    await flush();
    return Array.from(phase.querySelectorAll('.pb-menu-option')) as HTMLButtonElement[];
}

/** Open it and take the entry with this label. */
async function fromPhaseMenu(host: HTMLElement, at: number, label: string) {
    const options = await phaseMenu(host, at);
    const hit = options.find(o => o.querySelector('.pb-menu-label')?.textContent === label);
    if (!hit) { throw new Error(`no "${label}" in the phase menu`); }
    hit.click();
    await flush();
}

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

    it('offers Add hook on every phase, which is the discoverable way in', async () => {
        const { host } = canvas();
        expect(host.querySelectorAll('.pb-phase-add')).toHaveLength(2);
        const options = await phaseMenu(host);
        expect(options[0].querySelector('.pb-menu-label')?.textContent).toBe('Add hook');
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

    it('says what kind of hook it is, on the one line the row has', () => {
        const { host } = canvas(hooked());
        const after = host.querySelectorAll('.pb-attached-side')[1];
        expect(after.querySelector('.pb-hook-kind')?.textContent).toBe('skill');
    });

    // A heading above rows one line tall was a third of the block's height, for
    // a word the purple rule and `before`/`after` were already saying.
    it('carries no HOOKS heading and no connector arms', () => {
        const { host } = canvas(hooked());
        expect(host.querySelector('.pb-attached-head')).toBeNull();
        expect(host.querySelectorAll('.pb-attached-side')).toHaveLength(2);
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

    // Hue alone is not a cue: it separates these from your own for anyone who
    // can see the difference, and for nobody else.
    it('marks the minority with a word, and leaves your own unmarked', () => {
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [stock('after')],
                phases: [{
                    name: 'gather', hooks: [],
                    nodes: [node({ hooks: [{
                        when: 'after', type: 'skill', summary: 'create-pr',
                        anchor: 'resolve-dir', index: 0, note: '',
                    }] })],
                }],
            })],
        }));
        const marked = Array.from(host.querySelectorAll('.pb-hook-ext'));
        expect(marked).toHaveLength(1);
        expect(marked[0].textContent).toBe('ext');
        expect(marked[0].closest('.pb-hook')?.className).toContain('pb-hook--stock');
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
        // since a lane is 300px and a heading can be any length. `§` on its own
        // named nothing a reader could read.
        expect(host.querySelector('.pb-template .pb-yours')?.textContent)
            .toBe('template · 1');
        expect(host.querySelector('.pb-template')?.getAttribute('title'))
            .toContain('Requirements');
    });

    it('says the word when nothing in the template was replaced', () => {
        const { host } = canvas(graph({
            steps: [step({ template: { file: 'spec-template.md', sections: [], sectionsAvailable: ['Requirements'], chosenBy: {} } })],
        }));
        expect(host.querySelector('.pb-template')?.textContent).toBe('template');
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
    // A green pill holding a bare `1` said neither what it counted nor why it
    // was green. The facts line speaks in one voice now: `2 nodes · 1 file`.
    it('counts the artifacts in words, and names them on hover', () => {
        const { host } = canvas();
        const chip = host.querySelector('.pb-step-facts .pb-produces');

        expect(chip?.textContent).toBe('1 file');
        expect(chip?.getAttribute('title')).toBe('produces spec.md');
        // It used to be a footer line below every node in the lane.
        expect(host.querySelector('.pb-artifacts')).toBeNull();
    });

    // `file`/`files` agreed on this line while `nodes` never did.
    it('agrees the node count with its noun, as the file count does', () => {
        const { host } = canvas(graph({
            steps: [step({
                artifacts: ['spec.md'],
                phases: [{ name: 'gather', hooks: [], nodes: [node()] }],
            })],
        }));
        // The spacing between them is the flex gap, not text.
        expect(host.querySelector('.pb-step-facts')?.textContent).toBe('1 node·1 file');
    });

    it('says "files" once there is more than one', () => {
        const { host } = canvas(graph({
            steps: [step({ artifacts: ['spec.md', 'checklists/requirements.md'] })],
        }));
        expect(host.querySelector('.pb-produces')?.textContent).toBe('2 files');
    });

    it('says nothing when a step produces no file', () => {
        const { host } = canvas(graph({ steps: [step({ artifacts: [] })] }));
        expect(host.querySelector('.pb-produces')).toBeNull();
    });
});

describe('phases are the project\'s to name and group', () => {
    // contentEditable with no role and no label reads to a screen reader as a
    // heading, which is what it also looks like.
    it('says the name is a field, and what field it is', () => {
        const { host } = canvas();
        const name = host.querySelector('.pb-phase-name') as HTMLElement;
        expect(name.getAttribute('role')).toBe('textbox');
        expect(name.getAttribute('aria-label')).toBe('Phase name');
    });

    // Hovering a heading to discover it can be typed into is not discovery.
    it('puts the caret in the name from the phase menu', async () => {
        const { host } = canvas();
        await fromPhaseMenu(host, 0, 'Rename phase');
        expect(document.activeElement)
            .toBe(host.querySelectorAll('.pb-phase-name')[0]);
    });

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

    // Five buttons at `opacity: 0` became one that is always there. Everything
    // a phase can do is said in words inside it.
    it('says everything a phase can do, in one resting control', async () => {
        const { host } = canvas(three());
        const labels = (await phaseMenu(host, 0))
            .map(o => o.querySelector('.pb-menu-label')?.textContent);
        expect(labels).toEqual([
            'Add hook', 'Add node', 'Rename phase', 'Split phase',
            'Merge into the phase below',
        ]);
    });

    // `Menu` has no per-option disabled state, so a row that cannot run would
    // be a live row that silently does nothing.
    // The same five words every time, whatever this phase happens to allow —
    // the note on an inert row is what teaches the capability.
    it('says the same five things, marking the ones that cannot run here', async () => {
        const { host } = canvas(graph({
            steps: [step({
                dropped: [],
                phases: [{ name: 'only', hooks: [], nodes: [node()] }],
            })],
        }));
        const rows = await phaseMenu(host, 0);
        expect(rows.map(o => o.querySelector('.pb-menu-label')?.textContent)).toEqual([
            'Add hook', 'Add node', 'Rename phase', 'Split phase',
            'Merge into the phase above',
        ]);
        expect(rows.map(o => o.getAttribute('aria-disabled'))).toEqual([
            null, 'true', null, 'true', 'true',
        ]);
    });

    // The first phase has nothing above it, and the write merges downward.
    it('names the direction a merge actually goes', async () => {
        const { host } = canvas(three());
        const first = (await phaseMenu(host, 0))
            .map(o => o.querySelector('.pb-menu-label')?.textContent);
        const middle = (await phaseMenu(host, 1))
            .map(o => o.querySelector('.pb-menu-label')?.textContent);
        expect(first).toContain('Merge into the phase below');
        expect(middle).toContain('Merge into the phase above');
    });

    it('does not offer to reorder phases', async () => {
        // A phase is a contiguous run of the step, so moving one moves its
        // nodes — and across every step this pipeline ships, not one such move
        // survives the `reads:` dependencies: 0 of 18. The arrows that used to
        // sit here fired, were refused by the writer, and left the panel
        // redrawn unchanged, which reads as a button that does nothing.
        const { host } = canvas(three());
        const labels = (await phaseMenu(host, 1))
            .map(o => o.textContent ?? '');
        expect(labels.some(label => /move/i.test(label))).toBe(false);
    });

    // A phase's nodes have to land somewhere; dropping them would drop work.
    it('folds a removed phase into the one above it', async () => {
        const { host, grouped } = canvas(three());
        await fromPhaseMenu(host, 1, 'Merge into the phase above');
        expect(grouped[0][1]).toEqual([
            { name: 'gather', nodes: ['a', 'b', 'c'] },
            { name: 'wrap-up', nodes: ['d'] },
        ]);
    });

    it('folds the first phase into the one below it', async () => {
        const { host, grouped } = canvas(three());
        await fromPhaseMenu(host, 0, 'Merge into the phase below');
        expect(grouped[0][1]).toEqual([
            { name: 'author', nodes: ['a', 'b', 'c'] },
            { name: 'wrap-up', nodes: ['d'] },
        ]);
    });

    it('will not remove the only phase a step has, and says why', async () => {
        const { host, grouped } = canvas(graph({
            steps: [step({ phases: [{ name: 'only', hooks: [], nodes: [node()] }] })],
        }));
        const merge = (await phaseMenu(host, 0))[4];
        expect(merge.getAttribute('aria-disabled')).toBe('true');
        expect(merge.querySelector('.pb-menu-note')?.textContent)
            .toBe('a step needs at least one phase');
        merge.click();
        expect(grouped).toEqual([]);
    });

    // A new phase is born empty, and an empty phase cannot be written — so it
    // takes a node from the phase it follows.
    it('adds a phase by splitting the one before it', async () => {
        const { host, grouped } = canvas(three());
        await fromPhaseMenu(host, 0, 'Split phase');
        expect(grouped[0][1]).toEqual([
            { name: 'gather', nodes: ['a'] },
            { name: 'new phase', nodes: ['b'] },
            { name: 'author', nodes: ['c'] },
            { name: 'wrap-up', nodes: ['d'] },
        ]);
    });

    it('will not split a one-node phase, and teaches the split saying so', async () => {
        // The split has to take a node off the end, and a one-node phase has
        // none to give. The row stays, because its note is where someone finds
        // out a phase can be split at all.
        const { host, grouped } = canvas(three());
        const one = (await phaseMenu(host, 1))[3];
        expect(one.getAttribute('aria-disabled')).toBe('true');
        expect(one.querySelector('.pb-menu-note')?.textContent)
            .toBe('one node here, so there is nothing to split off');
        one.click();
        expect(grouped).toEqual([]);

        const two = (await phaseMenu(host, 0))[3];
        expect(two.getAttribute('aria-disabled')).toBeNull();
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
        await fromPhaseMenu(host, 0, 'Add node');
        const options = Array.from(host.querySelectorAll('.pb-menu-label'))
            .map(el => el.textContent);
        expect(options).toEqual(['branch', 'finalize']);
    });

    it('says how many are on offer, and why there are none when there are none', async () => {
        const { host } = canvas(withDropped());
        const offered = await phaseMenu(host, 0);
        expect(offered[1].querySelector('.pb-menu-label')?.textContent).toBe('Add node');
        expect(offered[1].querySelector('.pb-menu-note')?.textContent).toBe('2 on offer');

        document.body.innerHTML = '';
        const bare = canvas();
        const none = (await phaseMenu(bare.host, 0))[1];
        expect(none.getAttribute('aria-disabled')).toBe('true');
        expect(none.querySelector('.pb-menu-note')?.textContent)
            .toMatch(/drag one in\s+from another/);
    });

    // The order says when it runs and the phase says where it sits; one without
    // the other is a pipeline that contradicts itself.
    it('sends the order and the grouping together', async () => {
        const { host, addedNodes } = canvas(withDropped());
        await fromPhaseMenu(host, 0, 'Add node');
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

    // Handing a whole step to one document of your own is a rare and
    // consequential action, and it reads as one in the side column. On the
    // board it was a hover-only button and a fourth word for ownership.
    it('carries no step-level action on the board', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-step-replace')).toBeNull();
        expect(host.querySelector('.pb-step-head')?.textContent)
            .not.toContain('Make it ours');
    });
});

describe('attaching work', () => {
    it('offers one add-hook per phase, not a pair on every block', () => {
        const { host } = canvas();   // two phases, one node each
        expect(host.querySelectorAll('.pb-phase-add')).toHaveLength(2);
    });

    // "Attach" read as "add a block". It adds a hook, and says so.
    it('says a hook is what it adds', async () => {
        const { host } = canvas();
        const options = await phaseMenu(host, 0);
        expect(options[0].querySelector('.pb-menu-label')?.textContent).toBe('Add hook');
        expect(options[0].querySelector('.pb-menu-note')?.textContent)
            .toBe('a skill, an instruction or a command');
    });

    it('names the phase it would attach to', async () => {
        const { host, added } = canvas();
        await fromPhaseMenu(host, 0, 'Add hook');
        expect(added).toEqual([['specify', 'gather', 'before']]);
    });

    // The one control on a phase is there without a pointer, and says whose
    // phase it belongs to.
    it('is reachable at rest, and named', () => {
        const { host } = canvas();
        const control = host.querySelector('.pb-phase-add') as HTMLElement;
        expect(control.tagName).toBe('BUTTON');
        expect(control.getAttribute('aria-label')).toBe('Add or change gather');
        expect(control.getAttribute('aria-haspopup')).toBe('menu');
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
    // A 6px dot with no role said nothing without a hover, and there is no
    // hover on a touch screen.
    it('says the word, and names the change on it', () => {
        const { host } = canvas(graph({
            steps: [step({ changes: { ...NO_CHANGES, hooks: 2, replaced: ['draft-spec'] } })],
        }));
        const mark = host.querySelector('.pb-changed');
        expect(mark?.textContent).toBe('changed');
        const title = mark?.getAttribute('title') ?? '';
        expect(title).toContain('2 hooks');
        expect(title).toContain('rewrote draft-spec');
    });

    it('shows no mark on a step the project left alone', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-changed')).toBeNull();
    });

    // One fact, one mark: a CSS ::after and a real element both drew a dot, and
    // only the element carries the tooltip that says what changed.
    it('draws exactly one mark per changed step', () => {
        const { host } = canvas(graph({
            steps: [step({ changes: { ...NO_CHANGES, hooks: 1 } })],
        }));
        expect(host.querySelectorAll('.pb-changed')).toHaveLength(1);
    });

    // `§` is not a word. The chip says what it is and how much of it is yours.
    it('names the template rather than marking it with a glyph', () => {
        const { host } = canvas(graph({
            steps: [step({
                changes: { ...NO_CHANGES },
                template: { file: 'spec-template.md', sections: ['Requirements'], sectionsAvailable: [], chosenBy: {} },
            })],
        }));
        expect(host.querySelector('.pb-step-facts')?.textContent).not.toContain('§');
        expect(host.querySelector('.pb-changed')?.getAttribute('title'))
            .toContain('template sections Requirements');
    });
});

describe('a node card says what its node does, and can be taken out of the run', () => {
    const kinds = () => graph({
        steps: [step({
            phases: [{
                name: 'gather', hooks: [],
                nodes: [
                    node({ id: 'gather-context', kind: 'investigate' }),
                    node({ id: 'draft-spec', kind: 'author' }),
                    node({ id: 'constitution-check', kind: 'gate' }),
                    node({ id: 'resolve-dir', kind: 'control' }),
                ],
            }],
        })],
    });

    it('carries its kind on the card, not only in the pane you have to open', () => {
        const { host } = canvas(kinds());
        expect(Array.from(host.querySelectorAll('.pb-node'))
            .map(el => el.className.match(/pb-node--(\w+)/)?.[1])).toEqual([
            'investigate', 'author', 'gate', 'control',
        ]);
    });

    // Every hue this panel has left already means something else, and a gate is
    // the one kind whose consequence a reader has to know about.
    it('says a gate can stop the run in a word, on the gate alone', () => {
        const { host } = canvas(kinds());
        const marked = Array.from(host.querySelectorAll('.pb-node-gate'));
        expect(marked).toHaveLength(1);
        expect(marked[0].textContent).toBe('gate');
        expect(marked[0].closest('.pb-node')?.className).toContain('pb-node--gate');
    });

    it('marks a gate that produces nothing, which has no other meta to carry', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'check', hooks: [],
                    nodes: [node({ id: 'review-gaps', kind: 'gate' })],
                }],
            })],
        }));
        expect(host.querySelector('.pb-node-gate')?.textContent).toBe('gate');
    });

    // The refusal at the writer named an action the panel could not perform.
    it('sends the order and the grouping the drag handler would', () => {
        const { host, removedNodes } = canvas(graph({
            steps: [step({
                phases: [
                    { name: 'gather', hooks: [], nodes: [node({ id: 'a' }), node({ id: 'b' })] },
                    { name: 'author', hooks: [], nodes: [node({ id: 'c' })] },
                ],
            })],
        }));
        (host.querySelectorAll('.pb-node-drop')[1] as HTMLButtonElement).click();

        expect(removedNodes).toEqual([{
            c: 'specify', n: 'b',
            order: ['a', 'c'],
            phases: [{ name: 'gather', nodes: ['a'] }, { name: 'author', nodes: ['c'] }],
        }]);
    });

    it('drops a phase the removal emptied', () => {
        const { host, removedNodes } = canvas();
        (host.querySelectorAll('.pb-node-drop')[0] as HTMLButtonElement).click();
        expect(removedNodes[0].phases)
            .toEqual([{ name: 'author', nodes: ['draft-spec'] }]);
    });

    // "Undo" on a node card deleted the project's copy with no notice, and is
    // not what undo means anywhere else in this panel. Going back to the
    // shipped node lives in the side column now.
    it('carries one action, and it is not called Undo', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [
                    { name: 'author', hooks: [], nodes: [node({ id: 'draft-spec', replaced: true })] },
                    { name: 'wrap-up', hooks: [], nodes: [node({ id: 'handoff' })] },
                ],
            })],
        }));
        const card = host.querySelector('.pb-node')!;
        expect(card.textContent).not.toContain('Undo');
        expect(card.querySelectorAll('button')).toHaveLength(2);
        expect(card.querySelector('.pb-node-drop')?.getAttribute('aria-label'))
            .toBe('Stop running Resolve the spec folder');
    });

    // The write would leave a step with no phases, which cannot be written — so
    // the writer refuses it and the panel redraws unchanged. A step added
    // through "Add step" ships with exactly one node, so this is the first
    // thing a person meets.
    it('offers no way out of the run for the last node a step has', () => {
        const { host, removedNodes } = canvas(graph({
            steps: [step({
                phases: [{ name: 'only', hooks: [], nodes: [node({ id: 'a' })] }],
            })],
        }));
        expect(host.querySelector('.pb-node-drop')).toBeNull();
        expect(removedNodes).toEqual([]);
    });

    it('offers it again as soon as something would survive the removal', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'only', hooks: [],
                    nodes: [node({ id: 'a' }), node({ id: 'b' })],
                }],
            })],
        }));
        expect(host.querySelectorAll('.pb-node-drop')).toHaveLength(2);
    });
});

describe('what the Add node picker offers', () => {
    // A node the recipe took out and one the step ships but does not run read
    // identically as bare ids, so the list gave no clue which was which. And a
    // summary the offer already carries was being thrown away for one of them.
    it('says what the node is AND where it went, rather than one or the other', async () => {
        const { host } = canvas(graph({
            steps: [step({
                dropped: ['branch', 'review-gaps'], addOns: ['review-gaps'],
                offers: {
                    branch: { name: 'Create the feature branch', summary: 'Creates the feature branch' },
                    'review-gaps': { name: 'Review the task list for gaps', summary: 'Attacks the task list for gaps before it runs' },
                },
            })],
        }));
        await fromPhaseMenu(host, 0, 'Add node');
        const rows = Array.from(host.querySelectorAll('.pb-menu-option')).map(el => ({
            label: el.querySelector('.pb-menu-label')?.textContent,
            note: el.querySelector('.pb-menu-note')?.textContent,
        }));
        expect(rows).toEqual([
            {
                label: 'Create the feature branch',
                note: 'Creates the feature branch · removed from this run',
            },
            {
                label: 'Review the task list for gaps',
                note: 'Attacks the task list for gaps before it runs · '
                    + 'specify ships this and does not run it',
            },
        ]);
    });

    it('falls back to where it went when the offer carries no summary', async () => {
        const { host } = canvas(graph({
            steps: [step({ dropped: ['branch', 'clarify'], addOns: ['clarify'] })],
        }));
        await fromPhaseMenu(host, 0, 'Add node');
        const rows = Array.from(host.querySelectorAll('.pb-menu-option')).map(el => ({
            label: el.querySelector('.pb-menu-label')?.textContent,
            note: el.querySelector('.pb-menu-note')?.textContent,
        }));
        expect(rows).toEqual([
            { label: 'branch', note: 'removed from this run' },
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
