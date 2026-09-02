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
 */
import type { Meta, StoryObj } from '@storybook/preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { Inspector } from '../Inspector';
import { Menu } from '../Menu';
import { AttachForm, NewStepForm, NewWorkflowForm } from '../AttachForm';
import { TemplateForm } from '../TemplateForm';
import {
    CHOICES, IMPLEMENT, NO_CHANGES, PLAN, SPECIFY, STOCK, TASKS,
    graph, hook, node, phase, step,
} from './fixtures';

const noop = () => undefined;

const CANVAS = {
    onOpenNode: noop, onRestoreNode: noop, onReorder: noop,
    onAddHook: noop, onEditHook: noop, onSetPhases: noop, onAddNode: noop,
    onOpenFrame: noop, onReplaceStep: noop, onOpenTemplate: noop, onNewStep: noop,
};
const HEAD = {
    onBuild: noop, onPreview: noop, onOpenConfig: noop,
    onSelectWorkflow: noop, onNewWorkflow: noop,
};
const INSPECT = {
    onClose: noop, onOpenFile: noop, onReplace: noop, onRestore: noop,
    onAttach: noop, onSave: noop, onUseVariant: noop,
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

const meta: Meta = { title: 'Pipeline Builder/Guide' };
export default meta;
type Story = StoryObj;

const WHOLE = graph([SPECIFY, PLAN, TASKS, IMPLEMENT], {
    configured: true,
    workflows: { available: ['shipped'], active: '' },
});

// ── The board ───────────────────────────────────────────

export const TheBoard: Story = {
    // Wide enough for four lanes AND the tail of the row. At 1280 the board
    // scrolls and the shot cuts "Outside the run" in half.
    parameters: { capture: { width: 1560, height: 760 } },
    name: 'The board',
    render: () => (
        <Panel>
            <Header graph={WHOLE} buildState="current" busy={false} {...HEAD} />
            <Canvas graph={WHOLE} {...CANVAS} />
        </Panel>
    ),
};

export const AStepHeader: Story = {
    parameters: { capture: { width: 560, height: 420 } },
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

// ── Reading and changing a block ────────────────────────

export const ReadingABlock: Story = {
    parameters: { capture: { width: 440, height: 620 } },
    name: 'Reading a block',
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

export const ReplacingABlock: Story = {
    parameters: { capture: { width: 440, height: 260 } },
    name: 'Replacing a block',
    render: () => (
        <div class="builder" style="width: 420px; padding: 16px">
            <Menu
                class="pb-inspector-action"
                trigger="Replace"
                title="Run a different block in this node's place"
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

export const AddingABlock: Story = {
    parameters: { capture: { width: 440, height: 260 } },
    name: 'Adding a block',
    render: () => (
        <div class="builder" style="width: 420px; padding: 16px">
            <Menu
                class="pb-phase-tool pb-phase-add-node"
                trigger="+ node"
                title="Put a node in this phase"
                defaultOpen
                options={[
                    { id: 'review-gaps', label: 'Review the task list for gaps',
                      note: 'Adversarial gap review' },
                    { id: 'branch', label: 'Create the feature branch',
                      note: 'this project took it out' },
                ]}
                onPick={noop} />
        </div>
    ),
};

// ── The document a step writes ──────────────────────────

export const ChangingTheDocument: Story = {
    parameters: { capture: { width: 440, height: 520 } },
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

export const WorkAttachedToABlock: Story = {
    parameters: { capture: { width: 620, height: 400 } },
    name: 'Work attached to a block',
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
            ], { stockHooks: STOCK, changes: { ...NO_CHANGES, hooks: 2 } })])} {...CANVAS} />
        </Panel>
    ),
};

export const AttachingWork: Story = {
    parameters: { capture: { width: 440, height: 760 } },
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
    parameters: { capture: { width: 440, height: 560 } },
    name: 'Starting from a preset',
    render: () => (
        <Pane>
            <NewWorkflowForm from="" taken={['shipped']} presets={CHOICES.presets}
                onCancel={noop} onCreate={noop} />
        </Pane>
    ),
};

export const AddingAStep: Story = {
    parameters: { capture: { width: 440, height: 680 } },
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
    parameters: { capture: { width: 760, height: 400 } },
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
    parameters: { capture: { width: 1000, height: 150 } },
    name: 'The build is behind',
    render: () => (
        <Panel>
            <Header graph={graph([SPECIFY], { configured: true, customised: true })}
                buildState="stale" busy={false} {...HEAD} />
        </Panel>
    ),
};
