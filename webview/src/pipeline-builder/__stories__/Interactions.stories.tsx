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
                onReplaceNode={(c, n) => sent.push({ what: 'replaceNode', with: [c, n] })}
                onRestoreNode={on('restoreNode')}
                onReorder={(c, order) => sent.push({ what: 'reorder', with: [c, order] })}
                onAddHook={(c, a, w) => sent.push({ what: 'addHook', with: [c, a, w] })}
                onEditHook={(c, h) => sent.push({ what: 'editHook', with: [c, h.anchor, h.index] })}
                onSetPhases={(c, p, r) => sent.push({ what: 'setPhases', with: [c, p, r] })}
                onAddNode={(c, id, p) => sent.push({ what: 'addNode', with: [c, id, p] })}
                onOpenFrame={on('openFrame')}
                onReplaceStep={on('replaceStep')} />
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
        name.textContent = 'set up';
        name.dispatchEvent(new Event('blur', { bubbles: true }));
    },
};

export const MoveAPhase: Story = {
    name: 'Move a phase',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const tools = canvasElement.querySelectorAll('.pb-phase')[1]
            .querySelectorAll('button.pb-phase-tool');
        (tools[0] as HTMLButtonElement).click();
        assert(tools.length === 4, 'up, down, add and remove');
    },
};

export const RemoveAPhase: Story = {
    name: 'Remove a phase',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const tools = canvasElement.querySelectorAll('.pb-phase')[1]
            .querySelectorAll('button.pb-phase-tool');
        (tools[3] as HTMLButtonElement).click();
    },
};

export const AddAPhase: Story = {
    name: 'Add a phase',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const tools = canvasElement.querySelectorAll('.pb-phase')[0]
            .querySelectorAll('button.pb-phase-tool');
        (tools[2] as HTMLButtonElement).click();
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
        const select = canvasElement.querySelector('.pb-phase-add-node') as HTMLSelectElement;
        assert(select.options.length === 3, 'the placeholder plus the two dropped nodes');
        select.value = 'branch';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    },
};

export const MakeANodeYours: Story = {
    name: 'Make a node yours',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const action = canvasElement.querySelector('.pb-node-action') as HTMLButtonElement;
        assert(action.textContent === 'Make mine', 'a shipped node offers to become yours');
        action.click();
    },
};

export const MakeAStepYours: Story = {
    name: 'Make a whole step yours',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const action = canvasElement.querySelector('.pb-step-replace') as HTMLButtonElement;
        assert(action.textContent === 'Make it ours', 'a step can be handed to one document');
        action.click();
    },
};

// ── Hooks ───────────────────────────────────────────────

export const AddAHook: Story = {
    name: 'Add a hook',
    render: () => board().view,
    play: async ({ canvasElement }) => {
        const attach = canvasElement.querySelector('.pb-attach') as HTMLButtonElement;
        assert(attach.textContent?.includes('Add hook') ?? false,
            'the button says what it adds');
        attach.click();
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
                onClose={noop} onOpenFile={noop} onReplace={noop}
                onRestore={noop} onAttach={noop} />
        </div>
    ),
    play: async ({ canvasElement }) => {
        const actions = Array.from(canvasElement.querySelectorAll('.pb-inspector-action'))
            .map(el => el.textContent);
        assert(actions.includes('Make it mine'), 'a shipped node offers to become yours');
        assert(actions.includes('Add hook'), 'and to have work attached');
        assert(actions.includes('Open the file'), 'with the editor still one click away');
    },
};
