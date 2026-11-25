/**
 * Every action the panel offers, driven and checked.
 *
 * A component story shows a state; these show a change of state. Each one does
 * the thing a person would do and asserts the message the panel would send —
 * which is the whole contract with the extension, and the thing that broke
 * twice: a drag that wrote to the wrong file, a rename that dropped its hooks.
 *
 * They run in Storybook's UI and in CI through the test runner.
 */
import type { Meta, StoryObj } from '@storybook/preact';
import { BrokenPipeline } from '../BrokenPipeline';
import { BuildBar } from '../BuildBar';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { HookModal } from '../HookModal';
import { Inspector } from '../Inspector';
import { NodePopover } from '../NodePopover';
import { movePlaces } from '../moves';
import { CHOICES, IMPLEMENT, NO_CHANGES, SPECIFY, graph, hook, node, phase, step } from './fixtures';

const noop = () => undefined;

/** What the panel would have sent, in order. */
type Sent = Array<{ what: string; with: unknown }>;

function recorder() {
    const sent: Sent = [];
    const on = (what: string) => (...args: unknown[]) =>
        sent.push({ what, with: args.length === 1 ? args[0] : args });
    return { sent, on };
}

function board(g = graph([SPECIFY])) {
    const { sent, on } = recorder();
    const view = (
        <div class="builder"
            ref={(el: HTMLElement | null) => {
                if (el) { (el as HTMLElement & { __sent?: Sent }).__sent = sent; }
            }}>
            <Canvas graph={g}
                onOpenNode={(c, n) => sent.push({ what: 'openNode', with: [c, n] })}
                onReorder={(c, order) => sent.push({ what: 'reorder', with: [c, order] })}
                onAddHook={(c, a, w) => sent.push({ what: 'addHook', with: [c, a, w] })}
                onEditHook={(c, h) => sent.push({ what: 'editHook', with: [c, h.anchor, h.index] })}
                onSetPhases={(c, p, r) => sent.push({ what: 'setPhases', with: [c, p, r] })}
                onAddNode={(c, id, p) => sent.push({ what: 'addNode', with: [c, id, p] })}
                onOpenFrame={on('openFrame')}
                onNewStep={on('newStep')}
                onMoveHook={(c, from, to) => sent.push({ what: 'moveHook', with: [c, from, to] })}
                onRefuse={on('refuse')} />
        </div>
    );
    return { view, sent };
}

/**
 * What the board rendered by this story has sent so far.
 *
 * `render` and `play` are separate calls, so a recorder captured in `play` by
 * building a second board belongs to a tree nobody clicked — every assertion
 * against it passed on an empty array. The rendered tree carries its own.
 */
function sentFrom(root: HTMLElement): Sent {
    const holder = (root.querySelector('.builder') ?? root) as HTMLElement & { __sent?: Sent };
    if (!holder.__sent) { throw new Error('this story did not render a recorded board'); }
    return holder.__sent;
}

/** Drag one `.pb-node` onto another, the way a browser does. */
function drag(root: HTMLElement, from: number, to: number) {
    const nodes = root.querySelectorAll('.pb-node');
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

function assert(condition: boolean, said: string) {
    if (!condition) { throw new Error(said); }
}

/** Open a phase's label menu and read back what it offers. */
async function phaseMenu(root: HTMLElement, at: number) {
    const phase = root.querySelectorAll('.pb-phase')[at];
    (phase.querySelector('.pb-phase-name') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return Array.from(phase.querySelectorAll('.pb-menu-option')) as HTMLButtonElement[];
}

/** Open it and take the entry with this label. */
async function fromPhaseMenu(root: HTMLElement, at: number, label: string | RegExp) {
    const options = await phaseMenu(root, at);
    const hit = options.find(o => {
        const text = o.querySelector('.pb-menu-label')?.textContent ?? '';
        return typeof label === 'string' ? text === label : label.test(text);
    });
    assert(Boolean(hit), `the phase menu offers "${label}"`);
    hit!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
}

const meta: Meta = { title: 'VS Code Extension/Pipeline Builder/Interactions' };
export default meta;
type Story = StoryObj;

// ── Reading ─────────────────────────────────────────────

export const OpenANode: Story = {
    name: 'Open a node',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const button = canvasElement.querySelector('.pb-node-main') as HTMLButtonElement;
        button.click();
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].what === 'openNode',
            'clicking a node asks the extension to read it');
        assert(JSON.stringify(sent[0].with) === JSON.stringify(['specify', 'resolve-dir']),
            'and names the step and the node it clicked');
    },
};

export const OpenTheStepsOwnInstructions: Story = {
    name: "Open a step's own instructions",
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const open = canvasElement.querySelector('.pb-step-open') as HTMLButtonElement;
        assert(open.textContent?.trim() === 'specify', 'the step name opens its frame');
        open.click();
    },
};

// ── Reordering ──────────────────────────────────────────

export const DragWithinAPhase: Story = {
    name: 'Drag a node within its phase',
    render: () => {
        const g = graph([step('plan', [
            phase('gather', [
                node('size-budget', 'Apply the size budget'),
                node('gather-context', 'Gather context'),
            ]),
        ])]);
        return board(g).view;
    },
    play: async ({ canvasElement }) => {
        drag(canvasElement, 1, 0);
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].what === 'reorder',
            'a drag inside one phase saves the order, not the grouping');
        assert(JSON.stringify(sent[0].with)
            === JSON.stringify(['plan', ['gather-context', 'size-budget']]),
            'and the order it saves is the one the drag produced');
    },
};

export const DragAcrossPhases: Story = {
    name: 'Drag a node into another phase',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        assert(canvasElement.querySelectorAll('.pb-phase').length === 4,
            'specify has four phases to move between');
        drag(canvasElement, 1, 3);
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].what === 'setPhases',
            'a drag across a phase boundary saves the whole grouping');
        const [, phases] = sent[0].with as [string, Array<{ name: string; nodes: string[] }>];
        const holds = (name: string) =>
            phases.find(p => p.name === name)?.nodes.includes('load-context');
        assert(holds('author') === true, 'the node landed in the phase it was dropped on');
        assert(holds('gather') === false, 'and left the one it came from');
    },
};

export const APinnedNodeRefusesToStart: Story = {
    name: 'A pinned node will not drag',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const first = canvasElement.querySelector('.pb-node') as HTMLElement;
        assert(first.getAttribute('draggable') === 'false',
            'resolve-dir is read by two nodes and cannot move');
        assert(Boolean(first.querySelector('.pb-grip--pinned')),
            'and it says so with a lock rather than a grip');
    },
};

// ── Phases ──────────────────────────────────────────────

export const RenameAPhase: Story = {
    name: 'Rename a phase',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const label = canvasElement.querySelector('.pb-phase-name') as HTMLElement;
        assert(label.tagName === 'BUTTON', 'a phase name is a button that opens its menu');
        await fromPhaseMenu(canvasElement, 0, 'Rename…');
        await new Promise(resolve => setTimeout(resolve, 0));
        const name = canvasElement.querySelector('.pb-phase-input') as HTMLInputElement;
        assert(document.activeElement === name, 'Rename… turns the label into a field with the caret in it');
        name.value = 'set up';
        name.dispatchEvent(new Event('blur', { bubbles: true }));
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].what === 'setPhases',
            'a rename saves the grouping');
        const [, , renamed] = sent[0].with as [
            string, unknown, { from: string; to: string } | undefined];
        // Named, so the hooks anchored to the old phase follow it. Without this
        // a rename detached every hook on that phase and said nothing.
        assert(JSON.stringify(renamed) === JSON.stringify({ from: 'gather', to: 'set up' }),
            'and says which phase was renamed, so its hooks travel');
    },
};

export const APhaseOffersOnlyWhatWorks: Story = {
    name: 'A phase offers only what can actually happen',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const labels = (await phaseMenu(canvasElement, 1))
            .map(o => o.querySelector('.pb-menu-label')?.textContent);
        // Moving a phase moves its nodes, and no such move in any shipped step
        // survives the `reads:` dependencies. The arrows could only ever fire,
        // be refused, and redraw unchanged.
        assert(!labels.some(l => /move/i.test(l ?? '')), 'nothing claims to move a phase');
        assert(labels.includes('Split'), 'a phase can be split');
        assert(labels.includes('Merge into gather, above') && labels.includes('Merge into classify, below'),
            'and merged into either neighbour, each named');
        assert(labels[0] === 'Rename…', 'and renaming comes first');

        // The first phase has nothing above it, so it offers only the way its nodes can go.
        const first = await phaseMenu(canvasElement, 0);
        const firstLabels = first.map(o => o.querySelector('.pb-menu-label')?.textContent);
        assert(firstLabels.includes('Merge into author, below'),
            'the first phase merges downward, and says so');
        assert(!firstLabels.some(l => /above/.test(l ?? '')),
            'and never claims a direction it does not go');

        // A row that cannot run here is inert rather than absent: its note is
        // where someone learns the capability exists at all.
        const inert = first.filter(o => o.getAttribute('aria-disabled') === 'true');
        assert(inert.every(o => (o.querySelector('.pb-menu-note')?.textContent ?? '') !== ''),
            'every inert row still says why it cannot run here');
    },
};

export const MergeAPhase: Story = {
    name: 'Merge a phase into the one above',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        await fromPhaseMenu(canvasElement, 1, /, above$/);
        const sent = sentFrom(canvasElement);
        const [, phases] = sent[0].with as [string, Array<{ name: string; nodes: string[] }>];
        assert(phases[0].nodes.join(',') === 'resolve-dir,load-context,draft-spec,quality-checklist',
            'its nodes join the end of the phase above');
    },
};

export const MergeAPhaseDown: Story = {
    name: 'Merge a phase into the one below',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        await fromPhaseMenu(canvasElement, 1, /, below$/);
        const sent = sentFrom(canvasElement);
        const [, phases] = sent[0].with as [string, Array<{ name: string; nodes: string[] }>];
        assert(phases[1].name === 'classify'
            && phases[1].nodes.join(',') === 'draft-spec,quality-checklist,classify-size,persist-size',
        'its nodes join the start of the phase below');
    },
};

export const SplitAPhase: Story = {
    name: 'Split a phase in two',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        await fromPhaseMenu(canvasElement, 0, 'Split');
    },
};

// ── Nodes ───────────────────────────────────────────────

export const PutADroppedNodeBack: Story = {
    name: 'Put a dropped node back',
    render: () => {
        const sent: Sent = [];
        return (
            <div class="builder"
                ref={(el: HTMLElement | null) => {
                    if (el) { (el as HTMLElement & { __sent?: Sent }).__sent = sent; }
                }}>
                <HookModal step={step('specify', [
                    phase('gather', [node('resolve-dir', 'Resolve the spec folder')]),
                ], { dropped: ['branch', 'finalize'] })} anchor="gather" choices={CHOICES}
                mode="node" modes={['hook', 'node', 'step']} onCancel={noop} onAttach={noop}
                onAddNode={(phase, id) => sent.push({ what: 'addNode', with: [phase, id] })} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        const rows = canvasElement.querySelectorAll('.pb-modal-row');
        assert(rows.length === 2, 'the two dropped nodes, with no placeholder row');
        (rows[1] as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        (canvasElement.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        const sent = sentFrom(canvasElement);
        assert(JSON.stringify(sent[0]?.with) === '["gather","finalize"]',
            'Add node puts the picked node at the end of the phase shown');
    },
};

export const AShippedNodeCarriesNoExtraAction: Story = {
    name: 'A shipped node card offers nothing but itself',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        // Clicking the node opens the panel where its instructions are edited,
        // and saving that edit is what makes it yours — so the card no longer
        // carries a "make mine" step in front of the thing people came to do,
        // and no "Undo" that silently deleted the copy it made. Going back to
        // the shipped node lives in that same panel.
        const card = canvasElement.querySelector('.pb-node') as HTMLElement;
        assert(!card.textContent?.includes('Undo'),
            'nothing on a node card is called Undo');
        assert(!card.textContent?.includes('Make it ours'),
            'and nothing asks to make it yours before you have read it');
        (canvasElement.querySelector('.pb-node-main') as HTMLButtonElement | null)?.click();
    },
};

export const TakeANodeOutOfTheRun: Story = {
    name: 'Take a node out of the run',
    render: () => {
        const sent: Sent = [];
        return (
            <div class="builder"
                ref={(el: HTMLElement | null) => {
                    if (el) { (el as HTMLElement & { __sent?: Sent }).__sent = sent; }
                }}>
                <NodePopover node={node('draft-spec', 'Draft the spec')}
                    step="specify" hooksIn="companion.yml"
                    moves={{ places: [], held: [], pinned: '' }} removeBlocked=""
                    onClose={noop} onEditNode={noop} onAddHook={noop}
                    onEditHook={noop} onRemoveHook={noop}
                    onAction={action => sent.push({ what: 'nodeAction', with: action })} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        // Under More, saying the file survives.
        (canvasElement.querySelector('.pb-pop-more') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const remove = Array.from(document.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.querySelector('.pb-menu-label')?.textContent === 'Remove from the run')!;
        assert(Boolean(remove), 'More carries the removal');
        assert((remove.textContent ?? '').includes('Keeps the file'), 'and says the file survives it');
        remove.click();
        const sent = sentFrom(canvasElement);
        assert(sent.at(-1)?.with === 'remove', 'and asks for the removal');
    },
};

export const MoveANodeOnePlaceRefused: Story = {
    name: 'Move a node, one place refused',
    render: () => {
        const sent: Sent = [];
        const plan = step('plan', [
            phase('author', [
                node('write-plan', 'Write the plan'),
                node('pick-blocks', "Pick the plan's blocks", { reads: ['write-plan'] }),
            ]),
            phase('check', [node('constitution', 'Check against the constitution')]),
            phase('wrap-up', [node('handoff', 'Hand off', {
                pinned: 'it is the last thing the step does, so nothing goes after it',
            })]),
        ]);
        return (
            <div class="builder"
                ref={(el: HTMLElement | null) => {
                    if (el) { (el as HTMLElement & { __sent?: Sent }).__sent = sent; }
                }}>
                <NodePopover node={plan.phases[0].nodes[1]} step="plan" hooksIn="companion.yml"
                    moveOpen
                    moves={movePlaces(plan, 'pick-blocks')} removeBlocked=""
                    onClose={noop} onEditNode={noop} onAddHook={noop}
                    onEditHook={noop} onRemoveHook={noop}
                    onAction={action => sent.push({ what: 'nodeAction', with: action })} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        const places = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('.pb-move-place'));
        const up = places.find(p => p.textContent?.startsWith('Up'))!;
        assert(up.getAttribute('aria-disabled') === 'true'
            && (up.textContent ?? '').includes('It reads Write the plan, so it cannot run before it.'),
        'the place the writer would refuse is inert and says why');
        up.click();
        const legal = places.find(p => p.getAttribute('aria-disabled') !== 'true')!;
        legal.click();
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].with === 'phase:check', 'only the legal place is sent');
        assert((canvasElement.textContent ?? '').includes('Hand off is held in place'),
            'the node held in place is said beside the moves');
    },
};

// ── Hooks ───────────────────────────────────────────────

export const AddAHook: Story = {
    name: 'Add a hook',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        (canvasElement.querySelector('.pb-edge-add--before') as HTMLButtonElement).click();
        const sent = sentFrom(canvasElement);
        assert(sent[0]?.what === 'addHook', 'the "+" before a node opens the hook form there');
    },
};

export const AddToALane: Story = {
    name: 'Add to a lane',
    render: () => {
        const { sent } = recorder();
        return (
            <div class="builder"
                ref={(el: HTMLElement | null) => {
                    if (el) { (el as HTMLElement & { __sent?: Sent }).__sent = sent; }
                }}>
                <Canvas graph={graph([SPECIFY])} onOpenNode={noop} onReorder={noop}
                    onAddHook={noop} onEditHook={noop} onSetPhases={noop} onAddNode={noop}
                    onOpenFrame={noop} onNewStep={noop}
                    onAddTo={c => sent.push({ what: 'addTo', with: c })} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        (canvasElement.querySelector('.pb-lane-add') as HTMLButtonElement).click();
        const sent = sentFrom(canvasElement);
        assert(sent[0]?.what === 'addTo' && sent[0].with === 'specify',
            'the lane button opens the add modal for its step');
    },
};

export const EditAHook: Story = {
    name: 'Edit a hook',
    render: () => board(graph([IMPLEMENT])).view,
    play: async ({ canvasElement }) => {
        const chip = canvasElement.querySelector('.pb-hook') as HTMLButtonElement;
        assert(chip.getAttribute('title')?.includes('Click to edit') ?? false,
            'a hook says it can be opened');
        chip.click();
    },
};

export const FillInAHook: Story = {
    name: 'Fill in the hook form',
    render: () => (
        <div class="builder">
            <HookModal step={SPECIFY} anchor="author" choices={CHOICES}
                onCancel={noop} onAttach={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const input = canvasElement.querySelector('.pb-modal-search input') as HTMLInputElement;
        const submit = canvasElement.querySelector('.pb-action--primary') as HTMLButtonElement;
        assert(submit.disabled, 'nothing to add until a skill is named');

        input.value = 'verify-code-review';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
        assert(!(canvasElement.querySelector('.pb-action--primary') as HTMLButtonElement).disabled,
            'and enabled once it is');
    },
};

export const ChangeTheHookType: Story = {
    name: 'Change what a hook does',
    render: () => (
        <div class="builder">
            <HookModal step={SPECIFY} anchor="author" choices={CHOICES}
                onCancel={noop} onAttach={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const kinds = canvasElement.querySelectorAll('.pb-modal-kind');
        assert(kinds.length === 4, 'the four kinds sit on one row');
        (kinds[1] as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert(Boolean(canvasElement.querySelector('.pb-modal-area')),
            'an instruction gets room to write in');
    },
};

export const PlaceTheHookFirst: Story = {
    name: 'Change where a hook goes',
    render: () => (
        <div class="builder">
            <HookModal step={SPECIFY} anchor="draft-spec" choices={CHOICES}
                onCancel={noop} onAttach={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const triggers = canvasElement.querySelectorAll('.pb-modal-runs .pb-menu-trigger');
        assert(triggers.length === 2, 'when and where, on one quiet line');
        (triggers[1] as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const options = Array.from(canvasElement.querySelectorAll('.pb-modal-runs .pb-menu-option'));
        assert(options.length > 0, 'the anchors are named, not listed as ids');
        const draft = options.find(el => el.textContent?.startsWith('Draft the spec'));
        (draft as HTMLButtonElement).click();
    },
};

/** Drag one element onto another carrying a hook's payload, landing on the target's upper half. */
function dragHook(from: Element, to: Element) {
    const carried = new Map<string, string>();
    const dataTransfer = {
        get types() { return Array.from(carried.keys()); },
        setData: (k: string, v: string) => { carried.set(k, v); },
        getData: (k: string) => carried.get(k) ?? '',
        effectAllowed: '', dropEffect: '',
    };
    const box = to.getBoundingClientRect();
    const fire = (el: Element, type: string) => {
        const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        // A quarter of the way down, less one, so jsdom's zero-height box still reads as upper.
        Object.defineProperty(event, 'clientY', { value: box.top + box.height / 4 - 1 });
        el.dispatchEvent(event);
    };
    fire(from, 'dragstart');
    fire(to, 'dragover');
    fire(to, 'drop');
}

const TWO_HOOKS = graph([step('implement', [
    phase('wrap-up', [
        node('complete', 'Mark the spec complete', {
            hooks: [
                hook({ when: 'after', type: 'command', anchor: 'complete', summary: 'npm test' }),
                hook({ when: 'after', type: 'skill', anchor: 'complete', index: 1, summary: 'create-pr' }),
            ],
        }),
        node('handoff', 'Hand off at the end'),
    ]),
], {
    stockHooks: [{ when: 'before', extension: 'git', command: 'speckit.git.commit',
        description: '', optional: false, conditional: false }],
})]);

export const DragAHookAboveAnother: Story = {
    name: 'Drag a hook above another',
    render: () => board(TWO_HOOKS).view,
    play: async ({ canvasElement }) => {
        const rows = canvasElement.querySelectorAll('button.pb-hook');
        dragHook(rows[1], rows[0]);
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].what === 'moveHook', 'one move is asked for');
        const [, from, to] = sent[0].with as [string, { index: number }, { index: number }];
        assert(from.index === 1 && to.index === 0, 'the second hook goes first');
    },
};

export const DragAHookToAnotherNode: Story = {
    name: 'Drag a hook before another node',
    render: () => board(TWO_HOOKS).view,
    play: async ({ canvasElement }) => {
        const rows = canvasElement.querySelectorAll('button.pb-hook');
        dragHook(rows[0], canvasElement.querySelectorAll('.pb-node')[1]);
        const [, , to] = sentFrom(canvasElement)[0].with as [string, unknown,
            { when: string; anchor: string }];
        assert(to.when === 'before' && to.anchor === 'handoff', 'it runs before the node dropped on');
    },
};

export const DragAnExtensionsHook: Story = {
    name: "Drag an extension's hook",
    render: () => board(TWO_HOOKS).view,
    play: async ({ canvasElement }) => {
        dragHook(canvasElement.querySelector('.pb-hook--stock')!,
            canvasElement.querySelectorAll('.pb-node')[1]);
        const sent = sentFrom(canvasElement);
        assert(sent.length === 1 && sent[0].what === 'refuse', 'the drag is refused');
        assert(String(sent[0].with).includes('git extension'), 'and says who registered it');
    },
};

// ── Steps ───────────────────────────────────────────────

export const AddAStepBetweenTwoLanes: Story = {
    name: 'Add a step between two lanes',
    render: () => board(graph([
        step('specify', SPECIFY.phases),
        step('plan', SPECIFY.phases),
        step('tasks', SPECIFY.phases),
        step('implement', SPECIFY.phases),
    ])).view,
    play: async ({ canvasElement }) => {
        // `Add step` appends, and the step people want is usually a review
        // BEFORE implement. The seam is the only control that says where.
        const seams = Array.from(canvasElement.querySelectorAll('.pb-lane-seam'));
        assert(seams.length === 3, 'one seam per join, and none at either end');
        const then = Array.from(canvasElement.querySelectorAll('.pb-lane-then'))
            .map(line => line.textContent);
        assert(then.join('|') === 'then plan|then tasks|then implement',
            'each join names the step that runs next');

        (seams[2] as HTMLButtonElement).click();
        const sent = sentFrom(canvasElement);
        assert(sent[0]?.what === 'newStep' && sent[0].with === 'tasks',
            'the seam after tasks opens New step with tasks already in Runs after');
    },
};

export const OpenWhatChangedOnAStep: Story = {
    name: 'Open what changed on a step',
    render: () => board(graph([step('tasks', SPECIFY.phases, {
        changes: { ...NO_CHANGES, added: ['review-gaps'], reordered: true },
    })])).view,
    play: async ({ canvasElement }) => {
        const mark = canvasElement.querySelector('.pb-changed') as HTMLButtonElement;
        assert(mark.tagName === 'BUTTON' && mark.getAttribute('title') === null,
            'the facts are disclosed, not parked in a tooltip nobody opens');
        assert(!canvasElement.querySelector('.pb-changed-line'), 'closed to start with');

        mark.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const line = canvasElement.querySelector('.pb-changed-line')?.textContent ?? '';
        assert(line.includes('+review-gaps') && line.includes('reordered'),
            "and opens the step's own change line under its head");
    },
};

export const ReachTheNodePlusWithNoPointer: Story = {
    name: 'Reach a node\'s "+" with no pointer',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const plus = canvasElement.querySelector('.pb-edge-add--after') as HTMLButtonElement;
        assert(plus.tagName === 'BUTTON' && !plus.disabled,
            'the "+" on a node is a real button, so tab order reaches it');

        plus.focus();
        assert(canvasElement.ownerDocument.activeElement === plus, 'and it takes the focus');

        plus.click();
        const sent = sentFrom(canvasElement);
        assert(sent[0]?.what === 'addHook', 'and adds a hook on its side of the node');
    },
};

// ── Workflows ───────────────────────────────────────────

export const SwitchWorkflow: Story = {
    name: 'Switch workflow',
    render: () => (
        <div class="builder">
            <Header
                graph={graph([SPECIFY], {
                    workflows: { available: ['shipped', 'bugfix', 'client'], active: '' },
                })}
                buildState="current" busy={false}
                onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={noop} onNewWorkflow={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const chip = canvasElement.querySelector('.builder-workflow-current') as HTMLButtonElement;
        chip.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const options = canvasElement.querySelectorAll('.pb-menu-option');
        assert(options.length === 4, 'three workflows and a way to make another');
        (options[1] as HTMLButtonElement).click();
    },
};

/** The review under the build bar names each changed lane and goes there. */
export const GoToWhatChanged: Story = {
    name: 'Go to what this project changed',
    render: () => {
        const shown: string[] = [];
        (GoToWhatChanged as { shown?: string[] }).shown = shown;
        return (
            <div class="builder builder--bar" style="height: 420px;">
                <BuildBar
                    graph={graph([
                        step('plan', SPECIFY.phases),
                        step('tasks', SPECIFY.phases, {
                            changes: {
                                ...NO_CHANGES, hooks: 2, replaced: ['draft-spec'],
                                removed: ['branch'], phases: ['our review'],
                            },
                        }),
                    ], { customised: true, configured: true })}
                    buildState="stale" busy={false} report={null} status={null}
                    onBuild={noop} onPreview={noop} onUndo={noop} onDismissStatus={noop}
                    onEditHook={noop} onRemoveHook={noop}
                    onShowStep={name => shown.push(name)} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('.builder-bar button'))
            .find(el => el.textContent === 'Review')!.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        (canvasElement.querySelector('[aria-label="Show tasks on the board"]') as HTMLButtonElement)
            .click();
        const shown = (GoToWhatChanged as { shown?: string[] }).shown ?? [];
        assert(shown.length === 1, 'the row asks to be taken somewhere');
        assert(shown[0] === 'tasks', 'and it is the lane that changed');
    },
};

/** The way to grow the run, in the menu of the band that names it. */
export const AddAStepFromTheHeader: Story = {
    name: 'Add a step from the header',
    render: () => {
        const started: string[] = [];
        (AddAStepFromTheHeader as { started?: string[] }).started = started;
        return (
            <div class="builder">
                <Header
                    graph={graph([SPECIFY], { configured: true })}
                    buildState="current" busy={false}
                    onPreview={noop} onOpenConfig={noop}
                    onSelectWorkflow={noop} onNewWorkflow={noop}
                    onNewStep={() => started.push('new')} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        (canvasElement.querySelector('.builder-overflow button') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const add = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.textContent === 'Add step')!;
        assert(Boolean(add), 'the header menu offers a way to add a step');
        add.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert((AddAStepFromTheHeader as { started?: string[] }).started?.length === 1,
            'and it opens the new-step form');
    },
};

/** The counts, which used to be a native tooltip nobody found. */
export const OpenTheTally: Story = {
    name: 'See what the pipeline holds',
    render: () => (
        <div class="builder">
            <Header
                graph={graph([SPECIFY], { configured: true })}
                buildState="current" busy={false}
                onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={noop} onNewWorkflow={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        (canvasElement.querySelector('.builder-overflow button') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const said = Array.from(canvasElement.querySelectorAll('.pb-menu-option'))
            .map(el => el.textContent ?? '');
        assert(said.some(line => /\d+ steps? · \d+ phases? · \d+ nodes?/.test(line)),
            'the shape of the pipeline is a line you can read');
    },
};

// ── Inspector ───────────────────────────────────────────

// ── Recovering a broken pipeline ────────────────────────

export const RepairABrokenPipeline: Story = {
    name: 'Repair a pipeline that could not be read',
    render: () => {
        const { sent, on } = recorder();
        (RepairABrokenPipeline as { sent?: Sent }).sent = sent;
        return (
            <div class="builder">
                <BrokenPipeline
                    error="tasks: phase 'gather' has no nodes — remove the phase, or give it one"
                    repairs={[{
                        id: 'drop-empty-phases:tasks',
                        label: 'Remove the empty phase from tasks',
                        detail: "Takes out 'gather'. Every other change you made is kept.",
                    }]}
                    onRepair={on('repair')} onOpenConfig={on('openConfig')} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        const sent = (RepairABrokenPipeline as { sent?: Sent }).sent!;
        (canvasElement.querySelector('.builder-repair .builder-action') as HTMLButtonElement)
            .click();
        assert(sent.length === 1, 'clicking a way out asks for exactly one repair');
        assert(sent[0].what === 'repair', 'and it is a repair, not an edit');
        assert(sent[0].with === 'drop-empty-phases:tasks', 'named by its own id');
    },
};

export const ABrokenPipelineSaysWhatItCosts: Story = {
    name: 'Every way out says what it costs',
    render: () => (
        <div class="builder">
            <BrokenPipeline
                error="tasks: phase 'gather' has no nodes — remove the phase, or give it one"
                repairs={[
                    {
                        id: 'drop-empty-phases:tasks',
                        label: 'Remove the empty phase from tasks',
                        detail: "Takes out 'gather'. Every other change you made is kept.",
                    },
                    {
                        id: 'reset-all',
                        label: 'Reset every step to the shipped pipeline',
                        detail: 'Drops every node order and phase grouping in this '
                            + 'workflow. Your hooks are kept.',
                    },
                ]}
                onRepair={noop} onOpenConfig={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const offered = Array.from(canvasElement.querySelectorAll('.builder-repair'));
        assert(offered.length === 2, 'both ways out are offered');
        for (const repair of offered) {
            const detail = repair.querySelector('.builder-repair-detail')?.textContent ?? '';
            assert(detail.trim().length > 0,
                'a repair with no stated cost is one nobody can judge before clicking');
        }
        // The narrow repair first: someone scanning top-down should meet the one
        // that keeps their work before the one that discards it.
        assert((offered[0].textContent ?? '').includes('empty phase'),
            'the narrowest way out is offered first');
    },
};

export const ABrokenPipelineKeepsTheManualEscape: Story = {
    name: 'The manual escape survives, smaller',
    render: () => {
        const { sent, on } = recorder();
        (ABrokenPipelineKeepsTheManualEscape as { sent?: Sent }).sent = sent;
        return (
            <div class="builder">
                <BrokenPipeline error="something the panel cannot diagnose" repairs={[]}
                    onRepair={noop} onOpenConfig={on('openConfig')} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        const sent = (ABrokenPipelineKeepsTheManualEscape as { sent?: Sent }).sent!;
        assert(canvasElement.querySelector('.builder-repairs') === null,
            'nothing diagnosable means nothing is offered');
        (canvasElement.querySelector('.builder-link') as HTMLButtonElement).click();
        assert(sent[0]?.what === 'openConfig',
            'the file is still one click away when the panel cannot help');
    },
};

export const EditANodeInPlace: Story = {
    name: 'Edit a node without leaving the panel',
    render: () => {
        const { sent, on } = recorder();
        (EditANodeInPlace as { sent?: Sent }).sent = sent;
        return (
            <div class="builder">
                <Inspector
                    node={node('draft-spec', 'Draft the spec', { kind: 'author' })}
                    step="specify"
                    body={'Load `spec-template.md` and write the specification.'}
                    editable={'Load `spec-template.md`.\n<!-- speckit-companion:part timing -->'}
                    parts={['timing']}
                    onClose={noop} onOpenFile={noop} onSave={on('saveNode')}
                    onRestore={noop} onAttach={noop} onUseVariant={noop}
                    onRemove={noop} onMove={noop} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        const sent = (EditANodeInPlace as { sent?: Sent }).sent!;
        const action = (label: string) =>
            Array.from(canvasElement.querySelectorAll('.pb-inspector-action'))
                .find(el => el.textContent === label) as HTMLButtonElement;

        action('Edit').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const box = canvasElement.querySelector('.pb-doc-edit') as HTMLTextAreaElement;
        assert(Boolean(box), 'editing happens here, not in the editor');
        // The fence travels with the text: it is where the shared block lands,
        // and saving the rendered prose back would quietly delete it.
        assert(box.value.includes('speckit-companion:part'),
            'the shared-block markers come with the text being edited');

        action('Save').click();
        assert(sent.length === 1 && sent[0].what === 'saveNode',
            'saving is one message — and it is what writes your copy');
    },
};

export const ReadAndAct: Story = {
    name: 'Read a node, then act on it',
    render: () => (
        <div class="builder">
            <Inspector
                node={node('draft-spec', 'Draft the spec', {
                    kind: 'author', writes: ['spec.md'], reads: ['resolve-dir'],
                })}
                step="specify"
                body={'Load `spec-template.md` and write the specification.'}
                parts={['timing']}
                editable={'Load `spec-template.md` and write the specification.'}
                onClose={noop} onOpenFile={noop} onSave={noop}
                onRestore={noop} onAttach={noop} onUseVariant={noop}
                    onRemove={noop} onMove={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const actions = Array.from(canvasElement.querySelectorAll('.pb-inspector-action'))
            .map(el => el.textContent);
        assert(actions.includes('Edit'), 'a node is edited here, not somewhere else');
        assert(!actions.includes('Make it mine'),
            'making it yours is what saving does, not a step before editing');
        assert(actions.includes('Add hook'), 'and work can be attached');
        // Reading the file is not changing it, so it sits beside the id.
        assert(Boolean(canvasElement.querySelector('.pb-side-head .pb-inspector-open')),
            'with the editor still one click away, from the header');
    },
};

export const EverythingElseANodeCanDo: Story = {
    name: 'Move a node from its Order row, remove or give it back from More',
    render: () => {
        const { sent, on } = recorder();
        (EverythingElseANodeCanDo as { sent?: Sent }).sent = sent;
        return (
            <div class="builder">
                <Inspector
                    node={node('draft-spec', 'Draft the spec', {
                        kind: 'author', writes: ['spec.md'], replaced: true, shipped: true,
                    })}
                    step="specify" body="Write the spec the way THIS TEAM writes specs."
                    editable="Write the spec the way THIS TEAM writes specs." parts={[]}
                    onClose={noop} onOpenFile={noop} onSave={noop}
                    onRestore={on('restoreNode')} onAttach={noop} onUseVariant={noop}
                    onRemove={noop} onMove={on('moveNode')} />
            </div>
        );
    },
    play: async ({ canvasElement }) => {
        const sent = (EverythingElseANodeCanDo as { sent?: Sent }).sent!;
        // Dragging needs a pointer, so the row that says a node is free to move
        // is where moving it is offered.
        const moves = Array.from(canvasElement.querySelectorAll('.pb-order-move'));
        assert(moves.map(el => el.textContent).join(' ') === 'Move up Move down',
            'reordering has a keyboard path, on the row that claims it');
        (moves[0] as HTMLButtonElement).click();
        assert(sent[0]?.what === 'moveNode' && sent[0]?.with === 'up',
            'and pressing one moves the node');

        const trigger = canvasElement.querySelector('.pb-more .pb-menu-trigger') as HTMLButtonElement;
        trigger.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const offered = Array.from(canvasElement.querySelectorAll('.pb-more .pb-menu-label'))
            .map(el => el.textContent);
        assert(!offered.includes('Move up'),
            'and More is left to the things that cost something');
        assert(offered.includes('Remove from the run'),
            'and a node can stop running without its file being deleted');
        assert(offered.includes('Use the shipped node'),
            'the way back is here too, said once');

        (Array.from(canvasElement.querySelectorAll('.pb-more .pb-menu-option'))
            .find(el => el.textContent?.startsWith('Use the shipped node')) as HTMLButtonElement)
            .click();
        assert(sent.at(-1)?.what === 'restoreNode', 'which asks for the revert, and says so');
    },
};
