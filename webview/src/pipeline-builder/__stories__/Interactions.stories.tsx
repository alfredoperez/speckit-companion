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
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { AttachForm } from '../AttachForm';
import { Inspector } from '../Inspector';
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
        <div class="builder">
            <Canvas graph={g}
                onOpenNode={(c, n) => sent.push({ what: 'openNode', with: [c, n] })}
                onRestoreNode={on('restoreNode')}
                onReorder={(c, order) => sent.push({ what: 'reorder', with: [c, order] })}
                onAddHook={(c, a, w) => sent.push({ what: 'addHook', with: [c, a, w] })}
                onEditHook={(c, h) => sent.push({ what: 'editHook', with: [c, h.anchor, h.index] })}
                onSetPhases={(c, p, r) => sent.push({ what: 'setPhases', with: [c, p, r] })}
                onAddNode={(c, id, p) => sent.push({ what: 'addNode', with: [c, id, p] })}
                onOpenFrame={on('openFrame')}
                onReplaceStep={on('replaceStep')} onOpenTemplate={on('openTemplate')}
                onNewStep={on('newStep')}
                onRemoveNode={on('removeNode')} onMoveNode={on('moveNode')} />
            <pre class="sb-sent" style="display:none">{JSON.stringify(sent)}</pre>
        </div>
    );
    return { view, sent };
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

/** Open a phase's one resting control and read back what it offers. */
async function phaseMenu(root: HTMLElement, at: number) {
    const phase = root.querySelectorAll('.pb-phase')[at];
    (phase.querySelector('.pb-phase-add') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return Array.from(phase.querySelectorAll('.pb-menu-option')) as HTMLButtonElement[];
}

/** Open it and take the entry with this label. */
async function fromPhaseMenu(root: HTMLElement, at: number, label: string) {
    const options = await phaseMenu(root, at);
    const hit = options.find(o => o.querySelector('.pb-menu-label')?.textContent === label);
    assert(Boolean(hit), `the phase menu offers "${label}"`);
    hit!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
}

const meta: Meta = { title: 'Pipeline Builder/Interactions' };
export default meta;
type Story = StoryObj;

// ── Reading ─────────────────────────────────────────────

export const OpenANode: Story = {
    name: 'Open a node',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const { view, sent } = board();
        void view;
        const button = canvasElement.querySelector('.pb-node-main') as HTMLButtonElement;
        button.click();
        void sent;
        assert(Boolean(button), 'a node should be clickable to read it');
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
        assert(canvasElement.querySelectorAll('.pb-node').length === 2,
            'both nodes survive a reorder');
    },
};

export const DragAcrossPhases: Story = {
    name: 'Drag a node into another phase',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const before = canvasElement.querySelectorAll('.pb-phase').length;
        drag(canvasElement, 0, 2);
        assert(before === 4, 'specify has four phases to move between');
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
        const name = canvasElement.querySelector('.pb-phase-name') as HTMLElement;
        assert(name.getAttribute('contenteditable') === 'true', 'a phase name is editable');
        // Labelled, since contentEditable on its own reads to a screen reader
        // as the heading it also looks like.
        assert(name.getAttribute('role') === 'textbox', 'and says it is a field');
        await fromPhaseMenu(canvasElement, 0, 'Rename phase');
        assert(document.activeElement === name, 'the menu puts the caret in it');
        name.textContent = 'set up';
        name.dispatchEvent(new Event('blur', { bubbles: true }));
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
        assert(labels.includes('Split phase'), 'a phase can be split');
        assert(labels.includes('Merge into the phase above'),
            'and merged into the one above');
        assert(labels[0] === 'Add hook', 'and the commonest change is first');
    },
};

export const MergeAPhase: Story = {
    name: 'Merge a phase into the one above',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        await fromPhaseMenu(canvasElement, 1, 'Merge into the phase above');
    },
};

export const SplitAPhase: Story = {
    name: 'Split a phase in two',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        await fromPhaseMenu(canvasElement, 0, 'Split phase');
    },
};

// ── Nodes ───────────────────────────────────────────────

export const PutADroppedNodeBack: Story = {
    name: 'Put a dropped node back',
    render: () => {
        const g = graph([step('specify', [
            phase('gather', [node('resolve-dir', 'Resolve the spec folder')]),
        ], { dropped: ['branch', 'finalize'] })]);
        return board(g).view;
    },
    play: async ({ canvasElement }) => {
        // The panel's own menu, not a native select: a `<select>` is drawn by
        // the operating system, so those two pickers arrived in a different
        // visual language from everything around them. Reached from the phase's
        // one resting control, which is where every phase change starts.
        await fromPhaseMenu(canvasElement, 0, 'Add node');
        const options = canvasElement.querySelectorAll('.pb-menu-option');
        assert(options.length === 2, 'the two dropped nodes, with no placeholder row');
        (options[0] as HTMLButtonElement).click();
    },
};

export const AShippedNodeCarriesNoExtraAction: Story = {
    name: 'A shipped node card offers nothing but itself',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        // Clicking the node opens the panel where its instructions are edited,
        // and saving that edit is what makes it yours — so the card no longer
        // carries a "make mine" step in front of the thing people came to do,
        // and no "Undo" that silently deleted the copy it made.
        assert(canvasElement.querySelector('.pb-node-action') === null,
            'a shipped node card has no action of its own');
        (canvasElement.querySelector('.pb-node-main') as HTMLButtonElement | null)?.click();
    },
};

export const TakeANodeOutOfTheRun: Story = {
    name: 'Take a node out of the run',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        // There was no way to stop running a node from the panel at all — the
        // writer's own refusal named an action only the file could perform.
        const drop = canvasElement.querySelector('.pb-node-drop') as HTMLButtonElement;
        assert(drop.getAttribute('title')?.includes('The file stays') ?? false,
            'it stops the node running, and says the file survives it');
        drop.click();
    },
};

// ── Hooks ───────────────────────────────────────────────

export const AddAHook: Story = {
    name: 'Add a hook',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        await fromPhaseMenu(canvasElement, 0, 'Add hook');
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
            <AttachForm step={SPECIFY} anchor="author" choices={CHOICES}
                onCancel={noop} onAttach={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const input = canvasElement.querySelector('.pb-input--mono') as HTMLInputElement;
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
            <AttachForm step={SPECIFY} anchor="author" choices={CHOICES}
                onCancel={noop} onAttach={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const radios = canvasElement.querySelectorAll('.pb-choice input');
        (radios[1] as HTMLInputElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert(Boolean(canvasElement.querySelector('.pb-input--area')),
            'an instruction gets room to write in');
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
                onBuild={noop} onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={noop} onNewWorkflow={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const chip = canvasElement.querySelector('.builder-workflow-current') as HTMLButtonElement;
        chip.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const options = canvasElement.querySelectorAll('.builder-workflow-option');
        assert(options.length === 4, 'three workflows and a way to make another');
        (options[1] as HTMLButtonElement).click();
    },
};

export const ExpandWhatChanged: Story = {
    name: 'See what this project changed',
    render: () => (
        <div class="builder">
            <Header
                graph={graph([step('specify', SPECIFY.phases, {
                    changes: {
                        ...NO_CHANGES, hooks: 2, replaced: ['draft-spec'],
                        removed: ['branch'], phases: ['our review'],
                    },
                })], { customised: true, configured: true })}
                buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={noop} onNewWorkflow={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        (canvasElement.querySelector('.builder-chip') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const listed = canvasElement.querySelector('.builder-changes')?.textContent ?? '';
        assert(listed.includes('draft-spec'), 'the rewritten node is listed');
        assert(listed.includes('our review'), 'and the renamed phase');
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
        assert(actions.includes('Open the file'), 'with the editor still one click away');
    },
};
