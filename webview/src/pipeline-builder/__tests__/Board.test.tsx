/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'fs';
import { join } from 'path';
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

    // The argument for hiding the seam's `+` was a field of twenty-odd marks.
    // A node draws only the seam above it, so a board carries as many seams as
    // it has nodes, less one per phase — eight on this repository's pipeline.
    it('draws one seam per gap: as many as nodes, less one per phase', () => {
        const sizes = [[2, 3], [1, 2]];
        const { host } = canvas(graph({
            steps: sizes.map((phases, s) => step({
                name: `step-${s}`,
                phases: phases.map((n, p) => ({
                    name: `phase-${p}`, hooks: [],
                    nodes: Array.from({ length: n }, (_, i) => node({ id: `n${s}${p}${i}` })),
                })),
            })),
        }));
        const nodes = sizes.flat().reduce((a, b) => a + b, 0);
        const phases = sizes.flat().length;
        expect(host.querySelectorAll('.pb-slot')).toHaveLength(nodes - phases);
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
    // both sides, repeating its name four times — so it became one block under
    // the card, with the sides named in words. The words are headings now, and
    // a heading is an ordering claim: BEFORE cannot sit under the card it runs
    // before, with the phase's own BEFORE above it.
    it('puts what runs before the node above it, and what runs after below', () => {
        const { host } = canvas(hooked());
        const group = host.querySelector('.pb-node-group')!;
        const order = Array.from(group.children).map(el => el.className.split(' ')[0]);

        expect(order).toEqual(['pb-attached', 'pb-node', 'pb-attached']);
        expect(group.children[0].textContent).toContain('before');
        expect(group.children[0].textContent).toContain('doctor.py');
        expect(group.children[2].textContent).toContain('after');
        expect(group.children[2].textContent).toContain('create-pr');
    });

    it('draws only the side that has work, on a node with one', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'wrap-up', hooks: [],
                    nodes: [node({ hooks: [{
                        when: 'after', type: 'skill', summary: 'create-pr',
                        anchor: 'resolve-dir', index: 0, note: '',
                    }] })],
                }],
            })],
        }));
        const group = host.querySelector('.pb-node-group')!;
        expect(Array.from(group.children).map(el => el.className.split(' ')[0]))
            .toEqual(['pb-node', 'pb-attached']);
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

    // The kind was a lowercase word beside a dot beside the reference, in one
    // purple run — three registers for two facts.
    it('badges the kind in the reader\'s words, and then the name alone', () => {
        const { host } = canvas(hooked());
        const after = host.querySelectorAll('.pb-attached-side')[1];
        expect(after.querySelector('.pb-hook-kind')?.textContent).toBe('Skill');
        expect(after.querySelector('.pb-hook-name')?.textContent).toBe('create-pr');
        expect(host.querySelector('.pb-hook-dot')).toBeNull();
    });

    // The word sat in a 3.6rem column beside the rows, which is a fifth of a
    // lane spent on a label said once.
    it('heads each side with its word rather than guttering it', () => {
        const { host } = canvas(hooked());
        const side = host.querySelector('.pb-attached-side')!;
        expect(side.firstElementChild?.className).toBe('pb-attached-when');
        expect(side.lastElementChild?.className).toBe('pb-hook-group');
    });

    it("leads your own group with Companion's mark", () => {
        const { host } = canvas(hooked());
        expect(host.querySelector('.pb-hook-source .pb-mark')?.getAttribute('class'))
            .toContain('pb-mark--moss');
    });

    it('heads your own rows with the file they are written in', () => {
        const { host } = canvas(hooked());
        const source = host.querySelector('.pb-hook-source')!;
        expect(source.querySelector('.pb-hook-source-name')?.textContent)
            .toBe('companion.yml');
        expect(source.nextElementSibling?.className).toBe('pb-attached-list');
    });

    // A project on a named workflow keeps every hook in that workflow's file;
    // companion.yml only says which one is active, and holds none of them.
    it('names the workflow file when the project is on a named workflow', () => {
        const { host } = canvas({
            ...hooked(),
            workflows: { available: ['shipped', 'client'], active: 'client' },
        });
        const source = host.querySelector('.pb-hook-source')!;
        expect(source.querySelector('.pb-hook-source-name')?.textContent).toBe('client.yml');
        expect(source.getAttribute('title'))
            .toContain('.specify/companion/workflows/client.yml');
    });

    // `shipped` bypasses companion.yml rather than emptying it, so the hooks
    // under this heading are the ones that file still holds and is not running.
    it('names the file the hooks are parked in on the pipeline as it ships', () => {
        const { host } = canvas({
            ...hooked(),
            workflows: { available: ['', 'shipped'], active: 'shipped' },
        });
        const source = host.querySelector('.pb-hook-source')!;
        expect(source.querySelector('.pb-hook-source-name')?.textContent)
            .toBe('companion.yml · parked');
        expect(source.getAttribute('title')).toContain('is still there');
    });

    const parked = () => {
        const g = hooked();
        const node = g.steps[0].phases[0].nodes[0];
        node.hooks = node.hooks.map(hook => ({ ...hook, parked: true }));
        return {
            ...g,
            workflows: {
                available: ['', 'shipped'], active: 'shipped',
                parked: { file: '.specify/companion.yml', hooks: 2 },
            },
        };
    };

    it('draws a parked hook where it would attach rather than dropping it', () => {
        const { host } = canvas(parked());
        expect(host.querySelectorAll('.pb-hook--parked')).toHaveLength(2);
        expect(host.textContent).toContain('doctor.py --chat');
    });

    // A shade of grey in a column of grey is not a state. The word is on the
    // row, so it is read by a screen reader and by anyone who cannot tell the
    // two greys apart.
    it('says parked in a word, not only in a colour', () => {
        const { host } = canvas(parked());
        expect(Array.from(host.querySelectorAll('.pb-hook-parked'))
            .map(el => el.textContent)).toEqual(['parked', 'parked']);
    });

    it('offers no edit on a hook that has no file to edit', () => {
        const { host, edited } = canvas(parked());
        (host.querySelector('.pb-hook--parked') as HTMLElement).click();
        expect(host.querySelectorAll('button.pb-hook')).toHaveLength(0);
        expect(edited).toEqual([]);
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
        const shown = chip.querySelector('.pb-hook-name')!.textContent!.replace('\u2026', '');
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

    // The same claim one level up: a phase's `after` hooks run after its nodes,
    // and drawing them above the nodes made the heading contradict the layout.
    it('puts a phase\'s own sides either side of its nodes', () => {
        const { host } = canvas(graph({
            steps: [step({
                phases: [{
                    name: 'author',
                    hooks: [
                        { when: 'before', type: 'prompt', summary: 'read the steering docs', anchor: '', index: 0, note: '' },
                        { when: 'after', type: 'skill', summary: 'code-review', anchor: '', index: 1, note: '' },
                    ],
                    nodes: [node()],
                }],
            })],
        }));
        const phase = host.querySelector('.pb-phase')!;
        expect(Array.from(phase.children).map(el => el.className.split(' ')[0]))
            .toEqual(['pb-phase-head', 'pb-attached', 'pb-phase-nodes', 'pb-attached']);
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
        expect(chips[0].textContent).toContain('commit');
    });

    // `speckit.git.feature` cut to a lane read `spe…`, which is the part every
    // one of them shares.
    it("leads a spec-kit extension's group with the GitHub mark", () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('after')] })],
        }));
        expect(host.querySelector('.pb-hook-source .pb-mark')?.getAttribute('class'))
            .toContain('pb-mark--github');
    });

    // Companion registers a spec-kit extension of its own, and it is Companion's
    // whichever file it arrives through.
    it("leaves Companion's own extension under Companion's mark", () => {
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [{ ...stock('after'), extension: 'companion' }],
            })],
        }));
        expect(host.querySelector('.pb-hook-source .pb-mark')?.getAttribute('class'))
            .toContain('pb-mark--moss');
    });

    // `description` is optional in extensions.yml, and the row used to fall back
    // to the command for the summary line and then print the command again.
    it('does not print the command twice when it carries no description', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [{ ...stock('after'), description: '' }] })],
        }));
        const title = host.querySelector('.pb-hook--stock')!.getAttribute('title')!;
        expect(title.match(/speckit\.git\.commit/g)).toHaveLength(1);
    });

    // The tail of a path is its file extension, which names nothing.
    it('leaves a command that is a path alone rather than cutting it to sh', () => {
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [{ ...stock('after'), command: 'scripts/sync.sh --all' }],
            })],
        }));
        expect(host.querySelector('.pb-hook--stock .pb-hook-name')?.textContent)
            .toBe('sync.sh --all');
    });

    // A dotted filename with no directory is still a filename: it is the tail
    // that gives it away, not the separators.
    it('leaves a dotted script filename alone even with no directory on it', () => {
        const named = (command: string) => {
            const { host } = canvas(graph({
                steps: [step({ stockHooks: [{ ...stock('after'), command }] })],
            }));
            return host.querySelector('.pb-hook--stock .pb-hook-name')?.textContent;
        };
        expect(named('build.deploy.sh')).toBe('build.deploy.sh');
        expect(named('tools.sync.py')).toBe('tools.sync.py');
        expect(named('release.notes.js')).toBe('release.notes.js');
        expect(named('speckit.git.commit')).toBe('commit');
    });

    it('names a command by its tail, never by the prefix they all carry', () => {
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [{ ...stock('after'), command: 'speckit.companion.after-specify' }],
            })],
        }));
        const name = host.querySelector('.pb-hook--stock .pb-hook-name')!;
        expect(name.textContent).toBe('after-specify');
        expect(host.querySelector('.pb-hook--stock')!.getAttribute('title'))
            .toContain('speckit.companion.after-specify');
    });

    // The extension's name was printed on every one of these, at the tail of the
    // row, so identity was the last thing read on every line.
    it('names the extension once above its rows, not on each of them', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('before'), stock('after')] })],
        }));
        const named = Array.from(host.querySelectorAll('.pb-hook-source-name'));
        expect(named.map(el => el.textContent)).toEqual(['via git', 'via git']);
        expect(host.querySelectorAll('.pb-hook--stock')).toHaveLength(2);
    });

    // Hooks run top to bottom in the order the registry declares them, so
    // collecting an extension's into one group draws an order that is not real.
    it('keeps an interleaved registry in the order it declares', () => {
        const at = (extension: string, command: string) => ({
            ...stock('after'), extension, command, optional: false,
        });
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [
                    at('git', 'speckit.git.commit'),
                    at('companion', 'speckit.companion.after-specify'),
                    at('git', 'speckit.git.validate'),
                ],
            })],
        }));
        expect(Array.from(host.querySelectorAll('.pb-hook-source-name'))
            .map(el => el.textContent)).toEqual(['via git', 'via companion', 'via git']);
        expect(Array.from(host.querySelectorAll('.pb-hook--stock .pb-hook-name'))
            .map(el => el.textContent)).toEqual(['commit', 'after-specify', 'validate']);
    });

    // Companion registers a spec-kit extension of its own, so an anchor can
    // carry two Companion-marked groups: one this panel writes, one it does not.
    // An extension's before-hooks run before every node in the step, so before
    // every hook of yours hanging off one; its after-hooks run once the step's
    // own work is reported. The block reads top to bottom, so the halves swap.
    it('puts an extension ahead of you before, and behind you after', () => {
        const ourHook = (when: 'before' | 'after') => ({
            when, type: 'skill' as const, summary: 'create-pr',
            anchor: 'resolve-dir', index: 0, note: '',
        });
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [stock('before'), stock('after')],
                phases: [{
                    name: 'gather', hooks: [],
                    nodes: [node({ hooks: [ourHook('before'), ourHook('after')] })],
                }],
            })],
        }));
        const sides = Array.from(host.querySelectorAll('.pb-attached-side'));
        const named = (side: Element) => Array.from(
            side.querySelectorAll('.pb-hook-source-name')).map(el => el.textContent);

        expect(sides[0].querySelector('.pb-attached-when')?.textContent).toBe('before');
        expect(named(sides[0])).toEqual(['via git', 'companion.yml']);
        expect(sides[1].querySelector('.pb-attached-when')?.textContent).toBe('after');
        expect(named(sides[1])).toEqual(['companion.yml', 'via git']);
    });

    it("tells your own file from Companion's extension beside it", () => {
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [{ ...stock('after'), extension: 'companion' }],
                phases: [{
                    name: 'gather', hooks: [],
                    nodes: [node({ hooks: [{
                        when: 'after', type: 'skill', summary: 'create-pr',
                        anchor: 'resolve-dir', index: 0, note: '',
                    }] })],
                }],
            })],
        }));
        expect(Array.from(host.querySelectorAll('.pb-hook-source-name'))
            .map(el => el.textContent)).toEqual(['companion.yml', 'via companion']);
    });

    // A third party's extension is not published by GitHub, and their logo on
    // it would say it is.
    it("gives a third party's extension a neutral mark, not GitHub's", () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [{ ...stock('after'), extension: 'acme' }] })],
        }));
        expect(host.querySelector('.pb-hook-source .pb-mark')?.getAttribute('class'))
            .toContain('pb-mark--extension');
    });

    // The kind badge used to fill the row, so a commandless entry was blank —
    // and a blank command reads as empty as a missing one.
    it('says so rather than rendering an empty row for an entry with no command', () => {
        for (const command of ['', '   ']) {
            const { host } = canvas(graph({
                steps: [step({ stockHooks: [{ ...stock('after'), command, description: '' }] })],
            }));
            const row = host.querySelector('.pb-hook--stock')!;
            expect(row.querySelector('.pb-hook-name')?.textContent).toBe('no command');
            expect(row.getAttribute('title')).toContain('names no command to run');
        }
    });

    // build-pipeline.py writes the words "an extension" when an entry names
    // none, so the sentence around it cannot assume there is a name.
    it('does not call an unnamed extension "the an extension extension"', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [{ ...stock('after'), extension: 'an extension' }] })],
        }));
        const title = host.querySelector('.pb-hook-source')!.getAttribute('title')!;
        expect(title).toContain('Registered by an extension in');
        expect(title).not.toContain('extension extension');
    });

    // Hue alone is not a cue: it separates these from your own for anyone who
    // can see the difference, and for nobody else.
    it('splits the two sources into their own groups, yours first', () => {
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
        const groups = Array.from(host.querySelectorAll('.pb-hook-group'));
        expect(groups.map(el => el.querySelector('.pb-hook-source-name')?.textContent))
            .toEqual(['companion.yml', 'via git']);
        expect(groups[0].querySelector('.pb-hook--stock')).toBeNull();
        expect(groups[1].querySelectorAll('.pb-hook--stock')).toHaveLength(1);
    });

    // A hook that stops and asks is the one fact on the row with a consequence.
    // It briefly lived in the title, which is where this round took every other
    // mark out of.
    it('says on the row that a hook will stop and ask', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('after')] })],
        }));
        const asks = host.querySelectorAll('.pb-hook-asks');
        expect(asks).toHaveLength(1);
        expect(asks[0].textContent).toBe('asks first');
    });

    it('leaves the word off a hook that just runs', () => {
        const { host } = canvas(graph({
            steps: [step({
                stockHooks: [{ ...stock('after'), optional: false }],
            })],
        }));
        expect(host.querySelector('.pb-hook-asks')).toBeNull();
    });

    it('says it is not edited here, and is still readable', () => {
        const { host } = canvas(graph({
            steps: [step({ stockHooks: [stock('after')] })],
        }));
        const chip = host.querySelector('.pb-hook--stock')!;
        expect(host.querySelector('.pb-hook-source')!.getAttribute('title'))
            .toContain('not edited in this panel');
        expect(chip.getAttribute('title')).toContain('Commit the work');
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

    // `template` was a grey mono word set exactly like `4 nodes` beside it, and
    // it is the only way into the whole document-shape panel.
    it('names the document shape as a chip, and counts what is yours in it', () => {
        const swapped = graph({
            steps: [step({ template: { file: 'spec-template.md', sections: ['Requirements'], sectionsAvailable: [], chosenBy: {} } })],
        });
        const { host } = canvas(swapped);
        const chip = host.querySelector('.pb-template')!;
        expect(chip.querySelector('.pb-template-name')?.textContent).toBe('Document shape');
        // The separator is neither the offer nor the change, so it stays out of
        // the ink that means "this is yours".
        expect(chip.querySelector('.pb-template-count')?.textContent).toBe('1');
        expect(chip.querySelector('.pb-fact-dot')?.textContent).toBe('·');
        // The section names are the title, since a lane is 300px and a heading
        // can be any length. `§` on its own named nothing a reader could read.
        expect(chip.getAttribute('title')).toContain('Requirements');
    });

    it('offers the shape with no count when nothing in it was replaced', () => {
        const { host } = canvas(graph({
            steps: [step({ template: { file: 'spec-template.md', sections: [], sectionsAvailable: ['Requirements'], chosenBy: {} } })],
        }));
        const chip = host.querySelector('.pb-template')!;
        expect(chip.querySelector('.pb-template-name')?.textContent).toBe('Document shape');
        expect(chip.querySelector('.pb-template-count')).toBeNull();
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

    // A bare padlock read as "you may not touch this". It only stops reordering,
    // so the card says `held` in the meta row and the grip stays a grip.
    it('says held in a word, and what held does not stop', () => {
        const { host } = canvas(pinned());
        const cards = host.querySelectorAll('.pb-node');
        const held = cards[0].querySelector('.pb-held');
        const title = held?.getAttribute('title') ?? '';

        expect(held?.textContent).toBe('held');
        expect(cards[1].querySelector('.pb-held')).toBeNull();
        expect(title).toContain('Cannot be reordered');
        expect(title).toContain('load-living-specs has to run after it');
        expect(title).toContain('rewrite it');
    });

    it('draws the same grip on a held node as on one that moves', () => {
        const { host } = canvas(pinned());
        const grips = Array.from(host.querySelectorAll('.pb-grip svg'))
            .map(el => el.innerHTML);
        expect(grips[0]).toBe(grips[1]);
        expect(host.querySelector('.pb-grip--pinned')?.getAttribute('title')).toBeNull();
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
        const shown = host.querySelector('.pb-hook-name')?.textContent ?? '';
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
    // A 6px dot with no role said nothing without a hover; the word that
    // replaced it kept its facts in a `title`, which a touch screen cannot
    // reach and a reader does not open.
    it('says the word, and opens what changed under it', async () => {
        const { host } = canvas(graph({
            steps: [step({ changes: { ...NO_CHANGES, hooks: 2, replaced: ['draft-spec'] } })],
        }));
        const mark = host.querySelector('.pb-changed') as HTMLButtonElement;
        expect(mark.tagName).toBe('BUTTON');
        expect(mark.textContent).toContain('changed');
        expect(mark.getAttribute('title')).toBeNull();
        expect(mark.getAttribute('aria-expanded')).toBe('false');
        expect(host.querySelector('.pb-changed-line')).toBeNull();

        mark.click();
        await flush();

        // Named, not just toggled: without it a reader hears a control that
        // expands and never learns what it expanded.
        const opened = host.querySelector('.pb-changed-line')!;
        expect(mark.getAttribute('aria-controls')).toBe(opened.id);
        const line = opened.textContent ?? '';
        expect(line).toContain('2 hooks');
        expect(line).toContain('your own: draft-spec');
        expect(host.querySelector('.pb-changed')?.getAttribute('aria-expanded'))
            .toBe('true');
    });

    it('closes again, and keeps the line to the step it belongs to', async () => {
        const { host } = canvas(graph({
            steps: [
                step({ name: 'specify', changes: { ...NO_CHANGES, reordered: true } }),
                step({ name: 'plan', changes: { ...NO_CHANGES, hooks: 1 } }),
            ],
        }));
        const marks = Array.from(host.querySelectorAll('.pb-changed')) as HTMLButtonElement[];
        marks[1].click();
        await flush();

        const steps = host.querySelectorAll('.pb-step');
        expect(steps[0].querySelector('.pb-changed-line')).toBeNull();
        expect(steps[1].querySelector('.pb-changed-line')?.textContent).toBe('1 hook');

        (steps[1].querySelector('.pb-changed') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.pb-changed-line')).toBeNull();
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
    it('names the template rather than marking it with a glyph', async () => {
        const { host } = canvas(graph({
            steps: [step({
                changes: { ...NO_CHANGES },
                template: { file: 'spec-template.md', sections: ['Requirements'], sectionsAvailable: [], chosenBy: {} },
            })],
        }));
        expect(host.querySelector('.pb-step-facts')?.textContent).not.toContain('§');
        (host.querySelector('.pb-changed') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.pb-changed-line')?.textContent)
            .toContain('template: Requirements');
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
        const { host, newSteps, newStepAfter } = canvas();
        (host.querySelector('.pb-add-step') as HTMLButtonElement).click();
        expect(newSteps()).toBe(1);
        // The tail appends: it names no step to run behind.
        expect(newStepAfter).toEqual([undefined]);
    });

    // The heading names what follows it. Above `+ Add step` it filed the one
    // control that adds a step TO the run under "outside" it.
    it('puts the invitation above the heading for what is not in the run', () => {
        const { host } = canvas(graph({
            steps: [step({ name: 'specify' }), step({ name: 'auto', inSequence: false })],
        }));
        const tail = host.querySelector('.pb-outside')!;
        const order = Array.from(tail.children).map(el => el.className);
        expect(order).toEqual(['pb-add-step', 'pb-outside-head', 'pb-aside']);
    });

    it('drops the heading when nothing runs outside the run', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-outside-head')).toBeNull();
        expect(host.querySelector('.pb-add-step')).not.toBeNull();
    });
});

describe('a seam between two lanes says where a step would go', () => {
    const run = () => graph({
        steps: ['specify', 'plan', 'tasks', 'implement'].map(name => step({ name })),
    });

    it('draws one seam per join, and none at either end', () => {
        const { host } = canvas(run());
        const board = host.querySelector('.pb-run') as HTMLElement;

        expect(board.className).toContain('pb-run--seamed');
        expect(board.style.getPropertyValue('--pb-seams')).toBe('3');
        expect(board.querySelectorAll('.pb-lane-seam')).toHaveLength(3);
        expect(board.firstElementChild?.className).toContain('pb-step');
        expect(board.lastElementChild?.className).toContain('pb-outside');
    });

    // `Add step` appends, and the step someone wants is usually a review BEFORE
    // implement. The seam is the only control on the board that says where.
    it('names the step to its left, which is the one it runs behind', () => {
        const { host, newStepAfter } = canvas(run());
        const seams = Array.from(host.querySelectorAll('.pb-lane-seam')) as HTMLButtonElement[];
        expect(seams[2].getAttribute('title')).toBe('Add a step after tasks');

        seams[2].click();
        expect(newStepAfter).toEqual(['tasks']);
    });

    it('draws no seam on a run of one step', () => {
        const { host } = canvas(graph({ steps: [step({ name: 'specify' })] }));
        expect(host.querySelector('.pb-lane-seam')).toBeNull();
        expect((host.querySelector('.pb-run') as HTMLElement).className)
            .not.toContain('pb-run--seamed');
    });
});

describe('a step that declares no phase', () => {
    // Every control that adds something hangs off a phase header, so a step
    // without one drew its name, `0 nodes`, and no way to change that.
    it('offers the first phase rather than nothing at all', () => {
        const { host } = canvas(graph({
            steps: [step({ name: 'doctor', phases: [], dropped: ['report'] })],
        }));
        const add = host.querySelector('.pb-menu-trigger.pb-first-phase-add');
        expect(add?.textContent).toContain('Add the first phase');
    });

    // The writer refuses a phase with nothing in it, so the phase and its first
    // node are made in one move.
    it('writes the phase holding the node that was picked', async () => {
        const { host, addedNodes } = canvas(graph({
            steps: [step({
                name: 'doctor', phases: [], dropped: ['report'],
                offers: { report: { name: 'Report on the run', summary: 'Says what ran' } },
            })],
        }));
        (host.querySelector('.pb-first-phase-add') as HTMLButtonElement).click();
        await flush();
        (host.querySelector('.pb-menu-option') as HTMLButtonElement).click();
        await flush();

        expect(addedNodes).toEqual([{
            c: 'doctor', id: 'report', phase: 'new phase',
            order: ['report'], phases: [{ name: 'new phase', nodes: ['report'] }],
        }]);
    });

    it('says where nodes come from when the step has none to place', async () => {
        const { host, addedNodes } = canvas(graph({
            steps: [step({ name: 'doctor', phases: [], dropped: [] })],
        }));
        (host.querySelector('.pb-first-phase-add') as HTMLButtonElement).click();
        await flush();
        const only = host.querySelector('.pb-menu-option') as HTMLButtonElement;
        expect(only.getAttribute('aria-disabled')).toBe('true');
        expect(only.textContent).toContain('.specify/companion/nodes/doctor/');

        only.click();
        await flush();
        expect(addedNodes).toEqual([]);
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

// Read from the stylesheet: jsdom resolves no cascade, so nothing else on the
// board can catch a resting control going back to invisible.
describe('a resting control on the board is drawn', () => {
    const css = readFileSync(
        join(__dirname, '..', '..', '..', 'styles', 'pipeline-builder.css'), 'utf8');

    /** The declarations of one rule, by its selector. */
    const rule = (selector: string) => {
        const at = css.indexOf(`\n${selector} {`);
        if (at < 0) { throw new Error(`no rule for ${selector}`); }
        return css.slice(at, css.indexOf('}', at));
    };

    // Both were `opacity: 0`: the seam's `+` is the one route to placing a hook
    // precisely, and the bin is a live destructive target.
    it('gives the seam and the bin no opacity to hide behind', () => {
        for (const selector of ['.pb-slot::before', '.pb-node-drop']) {
            expect(rule(selector)).not.toMatch(/opacity:/);
        }
    });

    // An `opacity: 0` element still hit-tests: parked below its `+`, the lane
    // seam's label reserved an invisible band over the next step's heading and
    // took the clicks meant for it.
    it('leaves the pointer nothing to hit on a label it has hidden', () => {
        expect(rule('.pb-lane-seam-label')).toContain('pointer-events: none;');
    });

    // .45 over a token that already carries an alpha put both under the 3:1 a
    // control that is not text has to clear. One ink, one stop, both the same.
    it('rests them on the same ink, and on a token rather than a fraction of one', () => {
        for (const selector of ['.pb-slot::before', '.pb-node-drop']) {
            expect(rule(selector)).toContain('color: var(--text-secondary);');
        }
    });
});
