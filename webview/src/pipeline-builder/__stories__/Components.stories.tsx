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
import { Inspector } from '../Inspector';
import { AttachForm, NewWorkflowForm } from '../AttachForm';
import {
    AUTO, CHOICES, IMPLEMENT, NO_CHANGES, PLAN, SPECIFY, STOCK, TASKS,
    graph, hook, node, phase, step,
} from './fixtures';

const noop = () => undefined;

const CANVAS = {
    onOpenNode: noop, onReplaceNode: noop, onRestoreNode: noop, onReorder: noop,
    onAddHook: noop, onEditHook: noop, onSetPhases: noop, onAddNode: noop,
    onOpenFrame: noop, onReplaceStep: noop,
};

const HEAD = {
    onBuild: noop, onPreview: noop, onOpenConfig: noop,
    onSelectWorkflow: noop, onNewWorkflow: noop,
};

const INSPECT = {
    onClose: noop, onOpenFile: noop, onReplace: noop, onRestore: noop, onAttach: noop,
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

export const StepChanged: Story = {
    name: 'Step · with everything changed',
    render: () => (
        <One><Canvas graph={graph([step('specify', SPECIFY.phases, {
            artifacts: ['spec.md'],
            template: { file: 'spec-template.md', sections: ['User Scenarios & Testing'] },
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

// ── Header ──────────────────────────────────────────────

export const HeaderShipped: Story = {
    name: 'Header · nothing changed',
    render: () => (
        <One><Header graph={graph([SPECIFY, PLAN])} buildState="unconfigured"
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
            {...INSPECT} /></One>
    ),
};

export const InspectorWaiting: Story = {
    name: 'Inspector · still reading',
    render: () => (
        <One><Inspector node={node('draft-spec', 'Draft the spec')} step="specify"
            body={null} parts={[]} {...INSPECT} /></One>
    ),
};

export const InspectorNothingOfItsOwn: Story = {
    name: 'Inspector · a node that is only shared blocks',
    render: () => (
        <One><Inspector node={node('handoff', 'Hand off to the next step')} step="specify"
            body="" parts={['timing', 'self-advance']} {...INSPECT} /></One>
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
            parts={[]} {...INSPECT} /></One>
    ),
};

export const InspectorPinned: Story = {
    name: 'Inspector · a node held in place',
    render: () => (
        <One><Inspector
            node={node('resolve-dir', 'Resolve the spec folder', {
                pinned: 'load-living-specs, draft-spec has to run after it',
            })}
            step="specify" body="Resolve the feature directory." parts={[]} {...INSPECT} /></One>
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
        <One><AttachForm step={SPECIFY} anchor="author" choices={{ skills: [], nodes: [] }}
            onCancel={noop} onAttach={noop} /></One>
    ),
};

export const NewWorkflow: Story = {
    name: 'New workflow',
    render: () => (
        <One><NewWorkflowForm from="" taken={['shipped', 'bugfix']}
            onCancel={noop} onCreate={noop} /></One>
    ),
};

export const NewWorkflowFromAnother: Story = {
    name: 'New workflow · seeded from one you are on',
    render: () => (
        <One><NewWorkflowForm from="bugfix" taken={['shipped', 'bugfix']}
            onCancel={noop} onCreate={noop} /></One>
    ),
};
