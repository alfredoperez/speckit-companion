/**
 * Every part of the builder on its own, and every state it has.
 *
 * The situation stories show the panel as a whole; these show one piece at a
 * time, so a change to a node card or a hook group is judged without four
 * lanes of context around it.
 */
import type { Meta, StoryObj } from '@storybook/preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import { Menu } from '../Menu';
import { StatusLine } from '../StatusLine';
import { Inspector } from '../Inspector';
import { AttachForm, NewStepForm, NewWorkflowForm } from '../AttachForm';
import { TemplateForm } from '../TemplateForm';
import {
    AUTO, CHOICES, IMPLEMENT, NO_CHANGES, NO_PHASES, OWN_STEP, PLAN, SPECIFY,
    SPECIFY_THREE_YOURS, STOCK, TASKS,
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
    onClose: noop, onOpenFile: noop, onRestore: noop, onAttach: noop,
    onSave: noop, onUseVariant: noop, onRemove: noop, onMove: noop,
};

/** One step, drawn alone, in the panel's own shell. */
function One({ children }: { children: preact.ComponentChildren }) {
    return <div class="builder">{children}</div>;
}

const meta: Meta = { title: 'Pipeline Builder/Components' };
export default meta;
type Story = StoryObj;

// ── Node ────────────────────────────────────────────────

export const NodePlain: Story = {
    name: 'Node · plain',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('gather', [node('resolve-dir', 'Resolve the spec folder')]),
        ])])} {...CANVAS} /></One>
    ),
};

export const NodeEveryKind: Story = {
    name: 'Node · all four kinds',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('one of each', [
                node('gather-context', 'Gather context', { kind: 'investigate' }),
                node('draft-spec', 'Draft the spec', { kind: 'author', writes: ['spec.md'] }),
                node('constitution-check', 'Check against the constitution', { kind: 'gate' }),
                node('resolve-dir', 'Resolve the spec folder', { kind: 'control' }),
            ]),
        ])])} {...CANVAS} /></One>
    ),
};

export const NodeYours: Story = {
    name: 'Node · yours',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('author', [
                node('draft-spec', 'Draft the spec (ours)', {
                    kind: 'author', writes: ['spec.md'], replaced: true,
                    source: '/proj/.specify/companion/nodes/specify/draft-spec.md',
                }),
                node('quality-checklist', 'Write the quality checklist', { kind: 'gate' }),
            ]),
        ], { changes: { ...NO_CHANGES, replaced: ['draft-spec'] } })])} {...CANVAS} /></One>
    ),
};

/**
 * The frame the `yours` mark is judged from.
 *
 * No other fixture puts more than one on a lane, so "a wall of purple" — the
 * thing the filled pill was accused of being — could not be seen in any
 * capture. Three of them, plus two swapped template sections.
 */
export const ThreeYours: Story = {
    name: 'Node · three yours on one lane',
    render: () => (
        <One><Canvas graph={graph([SPECIFY_THREE_YOURS])} {...CANVAS} /></One>
    ),
};

export const NodePinned: Story = {
    name: 'Node · held in place',
    render: () => (
        <One><Canvas graph={graph([step('plan', [
            phase('author', [
                node('plan-doc', 'Write the plan', {
                    kind: 'author', writes: ['plan.md'],
                    pinned: 'it has to run after gather-context and before constitution-check',
                }),
                node('handoff', 'Hand off to the next step'),
            ]),
        ])])} {...CANVAS} /></One>
    ),
};

export const NodeLongName: Story = {
    name: 'Node · a name and a path that do not fit',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('author', [
                node('quality-checklist', 'Write the quality checklist for this specification', {
                    kind: 'gate', writes: ['checklists/requirements-and-acceptance.md'],
                }),
            ]),
        ])])} {...CANVAS} /></One>
    ),
};

// ── Hooks ───────────────────────────────────────────────

export const HooksBothSides: Story = {
    name: 'Hooks · before and after',
    render: () => (
        <One><Canvas graph={graph([IMPLEMENT])} {...CANVAS} /></One>
    ),
};

export const HooksEveryType: Story = {
    name: 'Hooks · all four types',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('author', [
                node('draft-spec', 'Draft the spec', {
                    hooks: [
                        hook({ when: 'before', type: 'skill', summary: 'verify-code-review' }),
                        hook({ when: 'before', type: 'node', summary: 'debug-timing', index: 1 }),
                        hook({ when: 'after', type: 'command', summary: 'npm run lint-spec' }),
                        hook({
                            when: 'after', type: 'prompt', index: 1,
                            summary: 'Confirm the CHANGELOG is updated before continuing.',
                        }),
                    ],
                }),
            ]),
        ], { changes: { ...NO_CHANGES, hooks: 4 } })])} {...CANVAS} /></One>
    ),
};

export const HooksOnAPhase: Story = {
    name: 'Hooks · on a phase, not a node',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('author', [node('draft-spec', 'Draft the spec')], [
                hook({ when: 'before', type: 'prompt', anchor: 'author',
                    summary: 'Read the steering docs before writing anything.' }),
                hook({ when: 'after', type: 'skill', anchor: 'author', index: 1,
                    summary: 'code-review' }),
            ]),
        ], { changes: { ...NO_CHANGES, hooks: 2 } })])} {...CANVAS} /></One>
    ),
};

export const HooksYoursAndAnExtensions: Story = {
    name: 'Hooks · yours beside an extension\'s',
    render: () => (
        <One><Canvas graph={graph([step('implement', IMPLEMENT.phases, {
            stockHooks: STOCK, changes: { ...NO_CHANGES, hooks: 3 },
        })])} {...CANVAS} /></One>
    ),
};

export const HooksLongShellLine: Story = {
    name: 'Hooks · a shell line longer than the lane',
    render: () => (
        <One><Canvas graph={graph([step('implement', [
            phase('wrap-up', [
                node('complete', 'Mark the spec complete', {
                    hooks: [hook({
                        when: 'before', type: 'command', anchor: 'complete',
                        summary: 'python3 .specify/extensions/companion/scripts/doctor.py '
                            + '--chat --feature-dir specs/172-composable-command-nodes || true',
                    })],
                }),
            ]),
        ], { changes: { ...NO_CHANGES, hooks: 1 } })])} {...CANVAS} /></One>
    ),
};

/**
 * The frame a hook row is actually read at.
 *
 * The same anchors drawn one step wide fill a 1300px lane, where every row fits
 * and nothing truncates — which is the wrong frame to judge a row from. Four
 * lanes put them at the width a docked panel gives them.
 */
export const HookRowsAtLaneWidth: Story = {
    name: 'Hooks · at the width a lane actually has',
    render: () => (
        <One><Canvas graph={graph([
            step('implement', [
                phase('wrap-up', [
                    node('complete', 'Mark the spec complete', {
                        hooks: [
                            hook({ when: 'before', type: 'command', anchor: 'complete',
                                summary: 'python3 .specify/extensions/companion/scripts/'
                                    + 'doctor.py --chat || true' }),
                            hook({ when: 'before', type: 'node', anchor: 'complete', index: 1,
                                summary: 'house-review' }),
                        ],
                    }),
                    node('handoff', 'Hand off at the end', {
                        hooks: [
                            hook({ when: 'after', type: 'prompt', anchor: 'handoff',
                                summary: 'Before this spec is marked complete, self-review '
                                    + 'your full diff against the project conventions and '
                                    + 'the review checklist, and fix any violations.' }),
                            hook({ when: 'after', type: 'skill', anchor: 'handoff', index: 1,
                                summary: 'create-pr' }),
                        ],
                    }),
                ], [hook({ when: 'before', type: 'prompt', anchor: 'wrap-up',
                    summary: 'Read the doctor report above and act on it.' })]),
            ], { stockHooks: STOCK, changes: { ...NO_CHANGES, hooks: 5 } }),
            PLAN, TASKS, OWN_STEP,
        ])} {...CANVAS} /></One>
    ),
};

// ── Phase ───────────────────────────────────────────────

export const PhaseWithTools: Story = {
    name: 'Phase · its controls',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('gather', [node('a', 'First node'), node('b', 'Second node')]),
            phase('author', [node('c', 'Third node')]),
            phase('wrap-up', [node('d', 'Fourth node')]),
        ], { dropped: ['branch', 'finalize'] })])} {...CANVAS} /></One>
    ),
};

export const PhaseOnlyOne: Story = {
    name: 'Phase · the only one a step has',
    render: () => (
        <One><Canvas graph={graph([step('doctor', [
            phase('run', [node('report', 'Report on the run')]),
        ])])} {...CANVAS} /></One>
    ),
};

// ── Step ────────────────────────────────────────────────

export const StepShipped: Story = {
    name: 'Step · as it ships',
    render: () => <One><Canvas graph={graph([TASKS])} {...CANVAS} /></One>,
};

export const StepYourOwn: Story = {
    name: 'Step · one this project added',
    render: () => (
        <One><Canvas graph={graph([IMPLEMENT, OWN_STEP])} {...CANVAS} /></One>
    ),
};

export const StepYourOwnByHand: Story = {
    name: 'Step · yours, launched by hand',
    render: () => (
        <One><Canvas graph={graph([
            TASKS,
            step('audit', [phase('audit', [node('audit-work', 'Audit the change')])],
                { own: true, after: '', inSequence: false }),
        ])} {...CANVAS} /></One>
    ),
};

export const StepChanged: Story = {
    name: 'Step · with everything changed',
    render: () => (
        <One><Canvas graph={graph([step('specify', SPECIFY.phases, {
            artifacts: ['spec.md'],
            template: { file: 'spec-template.md', sections: ['User Scenarios & Testing'], sectionsAvailable: [], chosenBy: {} },
            dropped: ['branch'],
            frame: { source: '/proj/.specify/companion/nodes/specify/_frame.md', replaced: true },
            changes: {
                added: [], removed: ['branch'], reordered: true, hooks: 3,
                decisions: ['classify-size'], replaced: ['draft-spec'],
                phases: ['our review'],
            },
        })])} {...CANVAS} /></One>
    ),
};

export const StepOutOfSequence: Story = {
    name: 'Step · auto, which is not one',
    render: () => <One><Canvas graph={graph([AUTO, SPECIFY])} {...CANVAS} /></One>,
};

export const StepWithStockHooks: Story = {
    name: 'Step · hooks from your spec-kit extensions',
    render: () => (
        <One><Canvas graph={graph([step('specify', SPECIFY.phases, {
            stockHooks: STOCK, artifacts: ['spec.md'],
        })])} {...CANVAS} /></One>
    ),
};

export const StepWithDecision: Story = {
    name: 'Step · where a verdict routes',
    render: () => <One><Canvas graph={graph([SPECIFY])} {...CANVAS} /></One>,
};

/**
 * The joins between the lanes, where a step is added in the middle of the run.
 *
 * `Add step` appends, and the step people want is usually a review before
 * implement rather than a fifth lane after it.
 */
export const LaneSeam: Story = {
    name: 'Step · the seam between two lanes',
    render: () => (
        <One><Canvas graph={graph([SPECIFY, PLAN, TASKS, IMPLEMENT])} {...CANVAS} /></One>
    ),
};

/** A step declaring no phase at all — the one lane that could not be changed. */
export const NoPhases: Story = {
    name: 'Step · no phases yet',
    render: () => (
        <One><Canvas graph={graph([
            { ...NO_PHASES, inSequence: true, dropped: ['report'],
              offers: { report: { name: 'Report on the run', summary: 'Says what ran' } } },
        ])} {...CANVAS} /></One>
    ),
};

// ── Header ──────────────────────────────────────────────

export const HeaderShipped: Story = {
    name: 'Header · nothing changed',
    render: () => (
        <One><Header graph={graph([PLAN, TASKS])} buildState="unconfigured"
            busy={false} {...HEAD} /></One>
    ),
};

export const HeaderCustomised: Story = {
    name: 'Header · customised',
    render: () => (
        <One><Header
            graph={graph([step('specify', SPECIFY.phases, {
                changes: { ...NO_CHANGES, hooks: 3, replaced: ['draft-spec'], phases: ['our review'] },
            })], { customised: true, configured: true })}
            buildState="current" busy={false} {...HEAD} /></One>
    ),
};

export const HeaderStale: Story = {
    name: 'Header · the build is behind',
    render: () => (
        <One><Header graph={graph([SPECIFY])} buildState="stale" busy={false} {...HEAD} /></One>
    ),
};

export const HeaderNeverBuilt: Story = {
    name: 'Header · never built',
    render: () => (
        <One><Header graph={graph([SPECIFY])} buildState="never-built"
            busy={false} {...HEAD} /></One>
    ),
};

export const HeaderBusy: Story = {
    name: 'Header · building',
    render: () => (
        <One><Header graph={graph([SPECIFY])} buildState="current" busy {...HEAD} /></One>
    ),
};

export const HeaderWarnings: Story = {
    name: 'Header · the build warned',
    render: () => (
        <One><Header
            graph={graph([SPECIFY], {
                warnings: [
                    "hook anchor 'draft-specs' for specify.before not in active recipe — skipped",
                    "hook anchor 'wrapup' for implement.after not in active recipe — skipped",
                ],
            })}
            buildState="current" busy={false} {...HEAD} /></One>
    ),
};

export const HeaderWorkflows: Story = {
    name: 'Header · several workflows',
    render: () => (
        <One><Header
            graph={graph([SPECIFY], {
                workflows: { available: ['shipped', 'bugfix', 'client'], active: 'bugfix' },
            })}
            buildState="current" busy={false} {...HEAD} /></One>
    ),
};

export const HeaderFirstRun: Story = {
    name: 'Header · the first time, nothing configured',
    render: () => (
        <One><Header
            graph={graph([step('specify', SPECIFY.phases, { changes: { ...NO_CHANGES } })],
                { firstRun: true, configured: false, customised: false })}
            buildState="unconfigured" busy={false} {...HEAD} onDismissFirstRun={noop} /></One>
    ),
};

export const HeaderBuilt: Story = {
    name: 'Header · what the build did',
    render: () => (
        <One><Header graph={graph([SPECIFY])} buildState="current" busy={false} {...HEAD}
            report={{
                ok: true, at: '14:02', commands: 5, changed: [], dryRun: false,
                output: '[build] built 5 commands from .specify/companion.yml',
            }} /></One>
    ),
};

export const HeaderPreviewed: Story = {
    name: 'Header · what a preview would change',
    render: () => (
        <One><Header graph={graph([SPECIFY])} buildState="stale" busy={false} {...HEAD}
            report={{
                ok: true, at: '14:02', commands: 5, changed: ['specify', 'implement'],
                dryRun: true,
                output: '[build] would build 5 commands from .specify/companion.yml\n'
                    + '[build] what would change:\n'
                    + '  implement: +12 −4 lines\n  plan: unchanged\n  specify: +31 −0 lines',
            }} /></One>
    ),
};

// The strip lives at the foot of the panel rather than in this band, but it is
// the header's other half of the same conversation: one says what a build did,
// the other says what a write did.
export const StatusAfterAWrite: Story = {
    name: 'Status line · a write, with the way back',
    render: () => (
        <div class="builder">
            <StatusLine
                status={{
                    tone: 'done', text: 'Hook added before Draft the spec',
                    detail: 'Build to apply', undo: { token: 'hook:specify:draft-spec' },
                }}
                onUndo={noop} onDismiss={noop} />
        </div>
    ),
};

export const StatusAfterARefusal: Story = {
    name: 'Status line · a write the configuration refused',
    render: () => (
        <div class="builder">
            <StatusLine
                status={{
                    tone: 'warning',
                    text: 'review-gaps is not a node specify can run — nothing was written',
                }}
                onUndo={noop} onDismiss={noop} />
        </div>
    ),
};

// A menu row that is offered and impossible, which is how a phase menu can keep
// teaching what a phase can do while saying why it cannot do it here.
export const MenuWithAnImpossibleRow: Story = {
    name: 'Menu · a row that cannot be picked, and why',
    render: () => (
        <div class="builder" style="padding: var(--space-4); height: 260px">
            <Menu trigger="⋯" title="Phase" defaultOpen onPick={noop}
                options={[
                    { id: 'add-hook', label: 'Add hook', note: 'Attach work at this boundary' },
                    {
                        id: 'add-node', label: 'Add node', disabled: true,
                        note: 'This step runs every node it ships, so there is none to put back',
                    },
                    {
                        id: 'split', label: 'Split phase', disabled: true,
                        note: 'One node here, so there is nothing to split off',
                    },
                    { id: 'rename', label: 'Rename phase', note: 'Names this group in the run' },
                ]} />
        </div>
    ),
};

// ── Inspector ───────────────────────────────────────────

export const InspectorReading: Story = {
    name: 'Inspector · a node with instructions',
    render: () => (
        <One><Inspector
            node={node('draft-spec', 'Draft the spec', {
                kind: 'author', writes: ['spec.md'], reads: ['resolve-dir'],
            })}
            step="specify"
            body={'## Write it\n\nLoad `spec-template.md` and write the specification.\n\n'
                + '- Keep every section the template declares\n'
                + '- Mark assumptions with `[NEEDS CLARIFICATION]`\n\n'
                + '```bash\npython3 write-context.py --set step=specify\n```'}
            parts={['timing', 'self-advance']}
            editable="## Write it\n\n<!-- speckit-companion:part timing -->\n<!-- /speckit-companion:part timing -->"
            {...INSPECT} /></One>
    ),
};

export const InspectorWaiting: Story = {
    name: 'Inspector · still reading',
    render: () => (
        <One><Inspector node={node('draft-spec', 'Draft the spec')} step="specify"
            body={null} parts={[]} editable="" {...INSPECT} /></One>
    ),
};

export const InspectorNothingOfItsOwn: Story = {
    name: 'Inspector · a node that is only shared blocks',
    render: () => (
        <One><Inspector node={node('handoff', 'Hand off to the next step')} step="specify"
            body="" parts={['timing', 'self-advance']}
            editable="<!-- speckit-companion:part timing -->\n<!-- /speckit-companion:part timing -->"
            {...INSPECT} /></One>
    ),
};

export const InspectorYours: Story = {
    name: 'Inspector · a node you rewrote',
    render: () => (
        <One><Inspector
            node={node('draft-spec', 'Draft the spec', {
                kind: 'author', writes: ['spec.md'], replaced: true,
                source: '/Users/you/project/.specify/companion/nodes/specify/draft-spec.md',
            })}
            step="specify" body="Write the spec the way THIS TEAM writes specs."
            parts={[]} editable="Write the spec the way THIS TEAM writes specs."
            {...INSPECT} /></One>
    ),
};

export const InspectorPinned: Story = {
    name: 'Inspector · a node held in place',
    render: () => (
        <One><Inspector
            node={node('resolve-dir', 'Resolve the spec folder', {
                pinned: 'load-living-specs, draft-spec has to run after it',
            })}
            step="specify" body="Resolve the feature directory." parts={[]}
            editable="Resolve the feature directory." {...INSPECT} /></One>
    ),
};

// The Order row said a node was free to move and offered no way to move it;
// the two buttons are the whole keyboard and touch story for ordering.
export const InspectorOrderRow: Story = {
    name: 'Inspector · moving a node from the row that says it can move',
    render: () => (
        <One><Inspector
            node={node('draft-spec', 'Draft the spec', {
                kind: 'author', writes: ['spec.md'],
            })}
            step="specify" body="Load `spec-template.md` and write the specification."
            parts={[]} editable="Load `spec-template.md` and write the specification."
            {...INSPECT} /></One>
    ),
};

export const InspectorHeld: Story = {
    name: 'Inspector · a node held in place, said in a word',
    render: () => (
        <One><Inspector
            node={node('resolve-dir', 'Resolve the spec folder', {
                pinned: 'load-living-specs, draft-spec read it',
            })}
            step="specify" body="Resolve the feature directory from the branch." parts={[]}
            editable="Resolve the feature directory from the branch." {...INSPECT} /></One>
    ),
};

export const InspectorFrame: Story = {
    name: 'Inspector · a step\'s own instructions',
    render: () => (
        <One><Inspector
            node={node('_frame', 'specify — the step\'s own instructions', {
                pinned: 'the frame always comes first — it is what every node sits under',
            })}
            step="specify"
            body={'## User Input\n\nWhat the person asked for, verbatim.\n\n'
                + '## Outline\n\nWrite the specification for this feature.'}
            parts={[]} editable="## Outline" {...INSPECT} onReplaceStep={noop} /></One>
    ),
};

// ── Forms ───────────────────────────────────────────────

export const AttachSkill: Story = {
    name: 'Add hook · a skill',
    render: () => (
        <One><AttachForm step={SPECIFY} anchor="author" choices={CHOICES}
            onCancel={noop} onAttach={noop} /></One>
    ),
};

export const AttachEditing: Story = {
    name: 'Add hook · editing one that is there',
    render: () => (
        <One><AttachForm step={IMPLEMENT} anchor="handoff" choices={CHOICES}
            editing={hook({
                when: 'after', type: 'skill', anchor: 'handoff', index: 1,
                summary: 'create-pr', note: 'Do not merge.',
            })}
            onCancel={noop} onAttach={noop} onRemove={noop} /></One>
    ),
};

export const AttachNothingToPick: Story = {
    name: 'Add hook · a project with no skills yet',
    render: () => (
        <One><AttachForm step={SPECIFY} anchor="author" choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
            onCancel={noop} onAttach={noop} /></One>
    ),
};

export const AttachCommand: Story = {
    name: 'Add hook · a command, after a node',
    render: () => (
        <One><AttachForm step={SPECIFY} anchor="draft-spec" choices={CHOICES}
            editing={hook({
                when: 'after', type: 'command', anchor: 'draft-spec', index: 0,
                summary: 'npm run lint-spec',
            })}
            onCancel={noop} onAttach={noop} onRemove={noop} /></One>
    ),
};

export const TemplateSections: Story = {
    name: 'Template · the document a step writes',
    render: () => (
        <One><TemplateForm
            step={step('specify', SPECIFY.phases, {
                template: {
                    file: 'spec-template.md',
                    sections: ['User Scenarios & Testing'],
                    sectionsAvailable: [
                        'User Scenarios & Testing', 'Requirements', 'Success Criteria',
                    ],
                    chosenBy: { 'User Scenarios & Testing': 'ears-requirements' },
                },
            })}
            fragments={CHOICES.fragments} onCancel={noop} onPick={noop} /></One>
    ),
};

// A section with nothing behind it drew a field that looked exactly like the
// working one above it, with the reason in the chosen fragment's slot.
export const TemplateNoAlternatives: Story = {
    name: 'Template · nothing else written for any section',
    render: () => (
        <One><TemplateForm
            step={step('plan', PLAN.phases, {
                template: {
                    file: 'plan-template.md',
                    sections: [],
                    sectionsAvailable: [
                        'Technical Context', 'Constitution Check', 'Project Structure',
                    ],
                    chosenBy: {},
                },
            })}
            fragments={CHOICES.fragments} onCancel={noop} onPick={noop} /></One>
    ),
};

export const NewWorkflow: Story = {
    name: 'New workflow',
    render: () => (
        <One><NewWorkflowForm from="" taken={['shipped', 'bugfix']} presets={CHOICES.presets}
            onCancel={noop} onCreate={noop} /></One>
    ),
};

export const NewWorkflowFromAnother: Story = {
    name: 'New workflow · seeded from one you are on',
    render: () => (
        <One><NewWorkflowForm from="bugfix" taken={['shipped', 'bugfix']} presets={CHOICES.presets}
            onCancel={noop} onCreate={noop} /></One>
    ),
};

export const NewWorkflowNoPresets: Story = {
    name: 'New workflow · nothing shipped to start from',
    render: () => (
        <One><NewWorkflowForm from="" taken={['shipped']} presets={[]}
            onCancel={noop} onCreate={noop} /></One>
    ),
};

export const NewStep: Story = {
    name: 'New step',
    render: () => (
        <One><NewStepForm sequence={['specify', 'plan', 'tasks', 'implement']}
            taken={['specify', 'plan', 'tasks', 'implement', 'auto']}
            onCancel={noop} onCreate={noop} /></One>
    ),
};

// Opened from the seam between two lanes, which is already the answer to
// "runs after" — so the form does not ask again.
export const NewStepAfterTasks: Story = {
    name: 'New step · opened at the seam after tasks',
    render: () => (
        <One><NewStepForm sequence={['specify', 'plan', 'tasks', 'implement']}
            taken={['specify', 'plan', 'tasks', 'implement', 'auto']}
            initialAfter="tasks" onCancel={noop} onCreate={noop} /></One>
    ),
};
