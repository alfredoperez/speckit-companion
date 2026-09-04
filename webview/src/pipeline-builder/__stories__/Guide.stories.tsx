/**
 * The screenshots the pipeline-builder guide is written around.
 *
 * One story per gesture the guide teaches, framed so the shot shows the thing
 * being taught and little else. `capture-docs-images.mjs` renders these into
 * `docs/screenshots/generated/`; the guide embeds them by name.
 *
 * Kept apart from the Situations and Components sets on purpose. Those exist to
 * review states; these exist to be photographed, so their content is chosen for
 * what reads in a picture rather than for edge-case coverage — and changing one
 * changes a published image, which is a different kind of edit.
 *
 * An output filename never changes. The README resolves images against `main`,
 * so a rename retroactively 404s the published Marketplace listing; a story
 * renamed from "block" to "node" therefore keeps writing the file it always
 * wrote. The mapping lives in `scripts/capture-docs-images.mjs`.
 */
import type { Meta, StoryObj } from '@storybook/preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { Inspector } from '../Inspector';
import { Menu } from '../Menu';
import { StatusLine } from '../StatusLine';
import { BrokenPipeline } from '../BrokenPipeline';
import { AttachForm, NewStepForm, NewWorkflowForm } from '../AttachForm';
import { TemplateForm } from '../TemplateForm';
import {
    CHOICES, IMPLEMENT, NO_CHANGES, PLAN, SPECIFY, TASKS,
    graph, hook, node, phase, step,
} from './fixtures';

const noop = () => undefined;

const CANVAS = {
    onOpenNode: noop, onRestoreNode: noop, onReorder: noop,
    onAddHook: noop, onEditHook: noop, onSetPhases: noop, onAddNode: noop,
    onOpenFrame: noop, onReplaceStep: noop, onOpenTemplate: noop, onNewStep: noop,
    onRemoveNode: noop, onMoveNode: noop,
};
const HEAD = {
    onBuild: noop, onPreview: noop, onOpenConfig: noop,
    onSelectWorkflow: noop, onNewWorkflow: noop,
};
const INSPECT = {
    onClose: noop, onOpenFile: noop, onReplace: noop, onRestore: noop,
    onAttach: noop, onSave: noop, onUseVariant: noop, onRemove: noop, onMove: noop,
};

/** The panel's own shell, so a shot has the ground the real thing has. */
function Panel({ children }: { children: preact.ComponentChildren }) {
    return <div class="builder">{children}</div>;
}

/** A pane on its own, at the width it really gets. */
function Pane({ children }: { children: preact.ComponentChildren }) {
    return (
        <div class="builder" style="width: 420px">
            <div class="builder-body">{children}</div>
        </div>
    );
}

/** Click a control the story wants photographed open. */
function press(root: HTMLElement, selector: string) {
    (root.querySelector(selector) as HTMLButtonElement | null)?.click();
}

const meta: Meta = { title: 'Pipeline Builder/Guide' };
export default meta;
type Story = StoryObj;

const WHOLE = graph([SPECIFY, PLAN, TASKS, IMPLEMENT], {
    configured: true,
    workflows: { available: ['shipped'], active: '' },
});

// ── The board ───────────────────────────────────────────

/**
 * The hero: two lanes at a size type can be read at.
 *
 * The full board is 1560px, which lands in a documentation column as a
 * thumbnail — every mark the guide's legend names is there and none of them is
 * legible. So the guide opens on specify and plan, wide enough to read, and
 * carries the whole board underneath for the shape of the thing.
 *
 * Everything the legend points at is in this crop on purpose: a changed step
 * and an unchanged one, the file count, the template chip, the four kind marks,
 * a gate, a node this project rewrote, and one attached hook.
 */
const HERO_SPECIFY = step('specify', [
    phase('gather', [
        node('resolve-dir', 'Resolve the spec folder', {
            pinned: 'load-living-specs, draft-spec has to run after it',
        }),
        node('load-living-specs', 'Load living specs', {
            kind: 'investigate', reads: ['resolve-dir'],
        }),
    ]),
    phase('author', [
        node('draft-spec', 'Draft the spec', {
            kind: 'author', writes: ['spec.md'], reads: ['resolve-dir'],
            replaced: true, shipped: true,
            hooks: [hook({
                when: 'before', type: 'skill', anchor: 'draft-spec', summary: 'code-review',
            })],
        }),
        node('quality-checklist', 'Write the quality checklist', {
            kind: 'gate', writes: ['checklists/requirements.md'], reads: ['draft-spec'],
        }),
    ]),
], {
    artifacts: ['spec.md', 'checklists/requirements.md'],
    template: {
        file: 'spec-template.md', sections: [],
        sectionsAvailable: ['User Scenarios & Testing', 'Requirements'], chosenBy: {},
    },
    changes: { ...NO_CHANGES, hooks: 1, replaced: ['draft-spec'] },
});

const HERO_PLAN = step('plan', [
    phase('gather', [
        node('size-budget', 'Apply the size budget'),
        node('gather-context', 'Gather context', { kind: 'investigate' }),
    ]),
    phase('author', [
        node('plan-doc', 'Write the plan', {
            kind: 'author', writes: ['plan.md'], reads: ['gather-context'],
        }),
    ]),
], {
    artifacts: ['plan.md', 'research.md', 'data-model.md', 'contracts/'],
    template: {
        file: 'plan-template.md', sections: [],
        sectionsAvailable: ['Technical Context'], chosenBy: {},
    },
});

export const TwoLanes: Story = {
    parameters: { capture: { width: 800, height: 500 } },
    name: 'Two lanes, close up',
    render: () => (
        <Panel>
            <Canvas graph={graph([HERO_SPECIFY, HERO_PLAN], { configured: true })}
                {...CANVAS} />
        </Panel>
    ),
};

export const TheBoard: Story = {
    // Wide enough for four lanes AND the tail of the row. At 1280 the board
    // scrolls and the shot cuts "Outside the run" in half.
    parameters: { capture: { width: 1560, height: 980 } },
    name: 'The board',
    render: () => (
        <Panel>
            <Header graph={WHOLE} buildState="current" busy={false} {...HEAD} />
            <Canvas graph={WHOLE} {...CANVAS} />
        </Panel>
    ),
};

export const AStepHeader: Story = {
    parameters: { capture: { width: 560, height: 340 } },
    name: 'A step, read close up',
    render: () => (
        <Panel>
            <Canvas graph={graph([step('specify', [
                phase('gather', [
                    node('resolve-dir', 'Resolve the spec folder'),
                    node('load-living-specs', 'Load living specs', { kind: 'investigate' }),
                ]),
                phase('author', [
                    node('draft-spec', 'Draft the spec', {
                        kind: 'author', writes: ['spec.md'],
                    }),
                ]),
            ], {
                artifacts: ['spec.md', 'checklists/requirements.md'],
                template: {
                    file: 'spec-template.md', sections: [],
                    sectionsAvailable: ['User Scenarios & Testing', 'Requirements'],
                    chosenBy: {},
                },
            })])} {...CANVAS} />
        </Panel>
    ),
};

/**
 * The one control every phase carries, open.
 *
 * Everything a phase can do used to be a separate button that was invisible
 * until the pointer arrived. It is one `+` on the rule now, and the rows it
 * cannot run are shown inert with the reason — which is what teaches the
 * capability. The rows and notes here are the ones `Canvas.tsx` builds for a
 * phase holding a single node.
 */
export const ThePhaseMenu: Story = {
    parameters: { capture: { width: 440, height: 320 } },
    name: 'What a phase can do',
    render: () => (
        <div class="builder" style="width: 420px; padding: 16px">
            <Menu
                class="pb-phase-add"
                trigger="+"
                caret={false}
                defaultOpen
                title="Add or change author"
                options={[
                    { id: 'hook', label: 'Add hook',
                      note: 'a skill, an instruction or a command' },
                    { id: 'node', label: 'Add node', note: '2 on offer' },
                    { id: 'rename', label: 'Rename phase',
                      note: 'its hooks follow the new name' },
                    { id: 'split', label: 'Split phase', disabled: true,
                      note: 'one node here, so there is nothing to split off' },
                    { id: 'merge', label: 'Merge into the phase above',
                      note: 'its nodes go with it' },
                ]}
                onPick={noop} />
        </div>
    ),
};

/**
 * The header chip, expanded.
 *
 * Two marks, side by side. The first says whether anything differs from the
 * shipped pipeline and takes you to the first lane that does; the second says
 * what the pipeline holds, and opens onto the counts. There is no prop for the
 * open state — it is what clicking does — so the story clicks it.
 */
export const WhatChanged: Story = {
    parameters: { capture: { width: 1000, height: 200 } },
    name: 'What this project changed',
    render: () => (
        <Panel>
            <Header
                graph={graph([
                    step('specify', [phase('author', [node('draft-spec', 'Draft the spec')])], {
                        changes: {
                            ...NO_CHANGES, hooks: 1, replaced: ['draft-spec'],
                        },
                        template: {
                            file: 'spec-template.md', sections: ['User Scenarios & Testing'],
                            sectionsAvailable: ['User Scenarios & Testing'],
                            chosenBy: { 'User Scenarios & Testing': 'outcomes' },
                        },
                    }),
                    step('tasks', [phase('author', [node('tasks-doc', 'Write the task list')])], {
                        changes: { ...NO_CHANGES, added: ['review-gaps'], reordered: true },
                    }),
                ], { configured: true })}
                buildState="stale" busy={false} {...HEAD} />
        </Panel>
    ),
    play: ({ canvasElement }: { canvasElement: HTMLElement }) => {
        press(canvasElement, '.builder-tally');
    },
};

// ── Reading and changing a node ─────────────────────────

export const ReadingANode: Story = {
    parameters: { capture: { width: 440, height: 570 } },
    name: 'Reading a node',
    render: () => (
        <Pane>
            <Inspector
                node={node('draft-spec', 'Draft the spec', {
                    kind: 'author', writes: ['spec.md'], reads: ['resolve-dir'],
                    variants: [
                        { id: 'draft-spec-delta', name: 'Draft the spec as a delta',
                          summary: 'Create spec.md describing only what changes' },
                    ],
                })}
                step="specify"
                body={'Create `<feature_directory>/spec.md` from the description.\n\n'
                    + 'Write for a business stakeholder — **what** and **why**, not **how**.'}
                editable="Create the spec." parts={['timing', 'self-advance']}
                {...INSPECT} />
        </Pane>
    ),
};

/**
 * A node this project rewrote.
 *
 * Saving an edit is what writes the copy, so `yours` is the state an edit
 * leaves behind rather than something to switch on first. The Source row is the
 * whole point of the shot, which is why the More menu stays shut: it is
 * anchored to the foot of the pane and opens upward over exactly that row.
 */
export const ANodeYouRewrote: Story = {
    parameters: { capture: { width: 440, height: 590 } },
    name: 'A node you rewrote',
    render: () => (
        <Pane>
            <Inspector
                node={node('draft-spec', 'Draft the spec', {
                    kind: 'author', writes: ['spec.md'], reads: ['resolve-dir'],
                    replaced: true, shipped: true,
                    source: '.specify/companion/nodes/specify/draft-spec.md',
                })}
                step="specify"
                body={'Create `<feature_directory>/spec.md` from the description.\n\n'
                    + '- Name every capability the change touches\n'
                    + '- Mark an assumption with `[NEEDS CLARIFICATION]`'}
                editable="Create the spec." parts={['timing']}
                {...INSPECT} />
        </Pane>
    ),
};

/**
 * What the revert did, and the one chance to take it back.
 *
 * The words are the ones `builderPanel.ts` really sends when a node is handed
 * back, so the picture cannot promise an undo in a sentence the panel does not
 * say.
 */
export const TheWayBack: Story = {
    parameters: { capture: { width: 720, height: 48 } },
    name: 'Taking a change back',
    render: () => (
        <Panel>
            <StatusLine
                status={{
                    tone: 'done',
                    text: 'draft-spec runs the shipped node again',
                    detail: 'Your copy went to the trash',
                    undo: { token: 'restore:specify:draft-spec' },
                }}
                onUndo={noop} onDismiss={noop} />
        </Panel>
    ),
};

export const ReplacingANode: Story = {
    parameters: { capture: { width: 440, height: 260 } },
    name: 'Replacing a node',
    render: () => (
        <div class="builder" style="width: 420px; padding: 16px">
            <Menu
                class="pb-inspector-action"
                trigger="Replace"
                title="Run a different node in this one's place"
                defaultOpen
                options={[
                    { id: 'draft-spec-delta', label: 'Draft the spec as a delta',
                      note: 'Create spec.md describing only what changes' },
                    { id: 'draft-spec-bugfix', label: 'Draft the spec as a fix contract',
                      note: 'Three statements of behaviour rather than a set of user stories' },
                ]}
                onPick={noop} />
        </div>
    ),
};

export const AddingANode: Story = {
    parameters: { capture: { width: 440, height: 260 } },
    name: 'Adding a node',
    render: () => (
        <div class="builder" style="width: 420px; padding: 16px">
            <Menu
                class="pb-inspector-action"
                trigger="Add node"
                title="Put a node in this phase"
                defaultOpen
                options={[
                    { id: 'review-gaps', label: 'Review the task list for gaps',
                      note: 'Attacks the task list for gaps before it runs · '
                          + 'tasks ships this and does not run it' },
                    { id: 'branch', label: 'Create the feature branch',
                      note: 'Creates the feature branch · removed from this run' },
                ]}
                onPick={noop} />
        </div>
    ),
};

// ── The document a step writes ──────────────────────────

export const ChangingTheDocument: Story = {
    parameters: { capture: { width: 440, height: 450 } },
    name: 'Changing what a step writes',
    render: () => (
        <Pane>
            <TemplateForm
                step={step('specify', [], {
                    template: {
                        file: 'spec-template.md',
                        sections: ['User Scenarios & Testing'],
                        sectionsAvailable: [
                            'User Scenarios & Testing', 'Requirements', 'Success Criteria',
                        ],
                        chosenBy: { 'User Scenarios & Testing': 'ears-requirements' },
                    },
                })}
                fragments={CHOICES.fragments}
                onCancel={noop} onPick={noop} />
        </Pane>
    ),
};

// ── Attaching work ──────────────────────────────────────

/**
 * Your hooks and an installed extension's, in the same place and the same shape.
 *
 * The extension rows are the ones the `git` and `companion` spec-kit extensions
 * really register on implement, so the picture is not showing specify's hooks on
 * an implement lane the way it used to.
 */
export const WorkAttachedToANode: Story = {
    parameters: { capture: { width: 620, height: 400 } },
    name: 'Work attached to a node',
    render: () => (
        <Panel>
            <Canvas graph={graph([step('implement', [
                phase('wrap-up', [
                    node('complete', 'Mark the spec complete', {
                        hooks: [
                            hook({ when: 'before', type: 'command', anchor: 'complete',
                                summary: 'npm test' }),
                            hook({ when: 'after', type: 'skill', anchor: 'complete',
                                index: 1, summary: 'create-pr' }),
                        ],
                    }),
                    node('handoff', 'Hand off at the end'),
                ]),
            ], {
                stockHooks: [
                    { when: 'before', extension: 'git', command: 'speckit.git.commit',
                      description: 'Auto-commit before implementation',
                      optional: true, conditional: false },
                    { when: 'after', extension: 'companion',
                      command: 'speckit.companion.after-implement',
                      description: 'Per-task journaling on implement',
                      optional: false, conditional: false },
                ],
                changes: { ...NO_CHANGES, hooks: 2 },
            })])} {...CANVAS} />
        </Panel>
    ),
};

export const AttachingWork: Story = {
    parameters: { capture: { width: 440, height: 500 } },
    name: 'Attaching work',
    render: () => (
        <Pane>
            <AttachForm step={SPECIFY} anchor="author" choices={CHOICES}
                onCancel={noop} onAttach={noop} />
        </Pane>
    ),
};

// ── Whole configurations ────────────────────────────────

export const StartingFromAPreset: Story = {
    parameters: { capture: { width: 440, height: 530 } },
    name: 'Starting from a preset',
    render: () => (
        <Pane>
            <NewWorkflowForm from="" taken={['shipped']} presets={CHOICES.presets}
                onCancel={noop} onCreate={noop} />
        </Pane>
    ),
};

export const AddingAStep: Story = {
    parameters: { capture: { width: 440, height: 620 } },
    name: 'Adding a step of your own',
    render: () => (
        <Pane>
            <NewStepForm sequence={['specify', 'plan', 'tasks', 'implement']}
                taken={['specify', 'plan', 'tasks', 'implement', 'auto']}
                onCancel={noop} onCreate={noop} />
        </Pane>
    ),
};

export const AStepOfYourOwn: Story = {
    parameters: { capture: { width: 760, height: 580 } },
    name: 'A step of your own, in the run',
    render: () => {
        const own = step('review', [
            phase('review', [node('review-work', 'Review the change', {
                kind: 'gate', writes: ['review.md'],
            })]),
        ], { own: true, after: 'implement', artifacts: ['review.md'] });
        return (
            <Panel>
                <Canvas graph={graph([IMPLEMENT, own])} {...CANVAS} />
            </Panel>
        );
    },
};

// ── Building ────────────────────────────────────────────

export const TheBuildIsBehind: Story = {
    parameters: { capture: { width: 1000, height: 112 } },
    name: 'The build is behind',
    render: () => (
        <Panel>
            <Header graph={graph([SPECIFY], { configured: true, customised: true })}
                buildState="stale" busy={false} {...HEAD} />
        </Panel>
    ),
};

/** A build answers in the panel it was asked from, not in the editor. */
export const WhatTheBuildDid: Story = {
    parameters: { capture: { width: 1000, height: 110 } },
    name: 'What the build did',
    render: () => (
        <Panel>
            <Header graph={graph([SPECIFY], { configured: true, customised: true })}
                buildState="current" busy={false}
                report={{
                    ok: true, at: '14:02', commands: 5, changed: [], dryRun: false,
                    output: 'wrote 5 commands',
                }}
                {...HEAD} />
        </Panel>
    ),
};

// ── When it cannot be read ──────────────────────────────

/**
 * The state a reader most needs a picture of, and the one that had none.
 *
 * The ways out are actions here, each carrying what it costs — the broadest
 * one reading as destructive, because a recovery that quietly discards an
 * afternoon's work is worse than the breakage.
 */
export const WhenItCannotBeRead: Story = {
    parameters: { capture: { width: 620, height: 470 } },
    name: 'When the panel cannot read your pipeline',
    // The error and the three repairs are the strings the extension really
    // sends (`companion_config.py`, `config_repair.py`), so the picture cannot
    // promise a way out in words the panel does not use.
    render: () => (
        <div class="builder" style="width: 600px">
            <BrokenPipeline
                error={"specify: phase 'author' has no nodes — remove the phase, "
                    + 'or give it one'}
                repairs={[
                    { id: 'drop-empty-phases:specify',
                      label: 'Remove the empty phase from specify',
                      detail: "Takes out 'author'. Every other change you made is kept." },
                    { id: 'reset-phases:specify',
                      label: 'Use the shipped phases for specify',
                      detail: 'Drops the grouping you set for specify. Its hooks stay.' },
                    { id: 'reset-all', label: 'Reset every step to the shipped pipeline',
                      destructive: true,
                      detail: 'Drops every node order and phase grouping in this workflow. '
                          + 'Your hooks are kept.' },
                ]}
                onRepair={noop} onOpenConfig={noop} />
        </div>
    ),
};
