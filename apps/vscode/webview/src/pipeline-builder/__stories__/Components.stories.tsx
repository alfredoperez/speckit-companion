/**
 * Every part of the builder on its own, and every state it has.
 *
 * The situation stories show the panel as a whole; these show one piece at a
 * time, so a change to a node card or a hook group is judged without four
 * lanes of context around it.
 */
import type { Meta, StoryObj } from '@storybook/preact';
import { Canvas } from '../Canvas';
import { BuildBar } from '../BuildBar';
import { Header } from '../Header';
import { Menu } from '../Menu';
import { StatusLine } from '../StatusLine';
import { Inspector } from '../Inspector';
import { NewWorkflowForm } from '../AttachForm';
import { HookModal } from '../HookModal';
import { TemplateForm } from '../TemplateForm';
import { movePlaces, moveTargets } from '../moves';
import { NodePopover } from '../NodePopover';
import type { HookRunsAnswer } from '../../../../src/protocol/pipeline';
import {
    AUTO, CHOICES, IMPLEMENT, NO_CHANGES, NO_PHASES, OWN_STEP, PLAN, SPECIFY,
    SPECIFY_THREE_YOURS, STOCK, TASKS,
    graph, hook, node, phase, step,
} from './fixtures';

const noop = () => undefined;

const CANVAS = {
    onOpenNode: noop, onReorder: noop,
    onAddHook: noop, onEditHook: noop, onSetPhases: noop, onAddNode: noop,
    onOpenFrame: noop, onOpenTemplate: noop, onNewStep: noop,
};

const POPOVER = {
    onClose: noop, onEditNode: noop, onAddHook: noop, onEditHook: noop,
    onRemoveHook: noop, onAction: noop,
};

/** A run record that saw two of the hooks below and not the third. */
const RUNS: HookRunsAnswer = {
    spec: { name: '684-hook-run-record', path: '/proj/specs/684-hook-run-record' },
    runAt: '2026-11-20T10:00:00Z',
    runs: [
        {
            key: 'implement/before/execute/0', step: 'implement', when: 'before',
            anchor: 'execute', index: 0, type: 'prompt', ref: '', outcome: 'skipped',
            reason: 'The assistant read it and chose not to.', at: '2026-11-20T10:00:00Z',
        },
        {
            key: 'implement/before/gather/0', step: 'implement', when: 'before',
            anchor: 'gather', index: 0, type: 'skill', ref: 'house-check', outcome: 'ran',
            at: '2026-11-20T10:00:00Z',
        },
    ],
};

const EXECUTE = node('execute', 'Execute the tasks', {
    kind: 'author', reads: ['tasks.md'],
    hooks: [
        hook({ when: 'before', type: 'prompt', anchor: 'execute', summary: 'Ask me before adding a new dependency' }),
        hook({ when: 'after', type: 'command', anchor: 'execute', summary: 'npm run lint' }),
    ],
});

const RAN = step('implement', [
    phase('gather', [node('resolve-dir', 'Resolve the spec folder')], [
        hook({ when: 'before', type: 'skill', anchor: 'gather', summary: 'house-check' }),
    ]),
    phase('execute', [
        EXECUTE,
        node('check', 'Check the requirements', {
            kind: 'gate',
            hooks: [hook({
                when: 'after', type: 'skill', anchor: 'check', summary: 'pr-template',
                problem: 'No skill named "pr-template" in this project or an installed plugin, so this hook does nothing in a run.',
            })],
        }),
        node('draft', 'Draft the spec', { kind: 'author', writes: ['spec.md'], replaced: true }),
    ]),
], { changes: { ...NO_CHANGES, hooks: 4 } });

const HEAD = {
    onPreview: noop, onOpenConfig: noop,
    onSelectWorkflow: noop, onNewWorkflow: noop, onNewStep: noop,
};

const BAR = {
    onBuild: noop, onPreview: noop, onUndo: noop, onDismissStatus: noop,
    onEditHook: noop, onRemoveHook: noop, onShowStep: noop,
};

/** The bar floats at the foot of the panel, so it is drawn inside one. */
function Foot({ children, width = 900 }: { children: preact.ComponentChildren; width?: number }) {
    return (
        <div class="builder builder--bar" style={`width: ${width}px; height: 420px;`}>
            {children}
        </div>
    );
}

const BUILT_REPORT = {
    ok: true, at: '14:02', commands: 4, changed: [], dryRun: false,
    output: '[build] built 4 commands from .specify/companion.yml', warnings: [],
};

const PREVIEW_REPORT = {
    ok: true, at: '14:02', commands: 4, changed: ['implement'], dryRun: true,
    output: '[build] would build 4 commands from .specify/companion.yml\n'
        + '[build] what would change:\n  implement: +12 −4 lines',
    warnings: [],
};

const INSPECT = {
    onClose: noop, onOpenFile: noop, onRestore: noop, onAttach: noop,
    onSave: noop, onUseVariant: noop, onRemove: noop, onMove: noop,
};

/** One step, drawn alone, in the panel's own shell. */
function One({ children }: { children: preact.ComponentChildren }) {
    return <div class="builder">{children}</div>;
}

const meta: Meta = { title: 'VS Code Extension/Pipeline Builder/Components' };
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

export const HooksWhetherTheyRan: Story = {
    name: 'Hooks · whether each ran',
    render: () => (
        <One><Canvas graph={graph([RAN])} runs={RUNS} {...CANVAS} /></One>
    ),
};

export const HooksNoRunOnRecord: Story = {
    name: 'Hooks · no run on record',
    render: () => (
        <One><Canvas graph={graph([RAN])} runs={{ spec: null, runAt: null, runs: [] }} {...CANVAS} /></One>
    ),
};

export const NodePopoverOpen: Story = {
    name: 'Node popover · details and hooks',
    render: () => (
        <One>
            <NodePopover node={EXECUTE} step="implement" runs={RUNS} hooksIn="companion.yml"
                moves={movePlaces(RAN, 'execute')} removeBlocked="" {...POPOVER} />
        </One>
    ),
};

/** A node that reads the one above it, beside a held node: one place refused, one lock. */
const MOVING = step('plan', [
    phase('author', [
        node('write-plan', 'Write the plan', { writes: ['plan.md'] }),
        node('pick-blocks', "Pick the plan's blocks", { reads: ['write-plan'] }),
    ]),
    phase('check', [node('constitution', 'Check against the constitution', { kind: 'gate' })]),
    phase('wrap-up', [node('handoff', 'Hand off', {
        pinned: 'it hands off to the next step, so nothing can run after it',
    })]),
]);

export const NodePopoverMove: Story = {
    name: 'Node popover · Move…, one place refused',
    render: () => (
        <One>
            <NodePopover node={MOVING.phases[0].nodes[1]} step="plan" hooksIn="companion.yml"
                moves={movePlaces(MOVING, 'pick-blocks')} removeBlocked="" moveOpen {...POPOVER} />
        </One>
    ),
};

export const NodePopoverLastNode: Story = {
    name: 'Node popover · the last node cannot leave',
    render: () => (
        <One>
            <NodePopover node={node('only', 'The only node')} step="doctor" hooksIn="companion.yml"
                moves={{ places: [], held: [], pinned: '' }}
                removeBlocked="The last node doctor has: a step needs at least one." {...POPOVER} />
        </One>
    ),
};

export const NodePopoverMore: Story = {
    name: 'Node popover · More open',
    render: () => (
        <One>
            <NodePopover node={node('draft', 'Draft the spec', {
                kind: 'author', writes: ['spec.md'], replaced: true,
                variants: [{ id: 'draft-lean', name: 'Lean draft', summary: 'A shorter spec' }],
            })} step="implement" runs={RUNS} hooksIn="companion.yml"
            moves={movePlaces(RAN, 'draft')} removeBlocked="" moreOpen {...POPOVER} />
        </One>
    ),
};

export const NodePopoverSheet: Story = {
    name: 'Node popover · bottom sheet when narrow',
    render: () => (
        <div class="builder" style="max-width: 380px; height: 640px; position: relative">
            <NodePopover node={EXECUTE} step="implement" runs={RUNS} hooksIn="companion.yml"
                moves={movePlaces(RAN, 'execute')} narrow removeBlocked="" {...POPOVER} />
        </div>
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
    name: 'Hooks · grouped under the mark of whoever registered them',
    render: () => (
        <One><Canvas graph={graph([step('implement', IMPLEMENT.phases, {
            stockHooks: STOCK, changes: { ...NO_CHANGES, hooks: 3 },
        })])} {...CANVAS} /></One>
    ),
};

/**
 * The heading names the file the hooks are actually in.
 *
 * A project on a named workflow keeps all of them in that workflow's file;
 * `companion.yml` only says which one is active and holds none of them.
 */
export const HooksOnANamedWorkflow: Story = {
    name: 'Hooks · a project on a named workflow',
    render: () => (
        <One><Canvas graph={graph([step('implement', IMPLEMENT.phases, {
            stockHooks: STOCK, changes: { ...NO_CHANGES, hooks: 3 },
        })], {
            workflows: { available: ['shipped', 'client-delivery'], active: 'client-delivery' },
        })} {...CANVAS} /></One>
    ),
};

/** The pipeline as it ships, with this project's own hooks parked in place. */
const PARKED = {
    workflows: {
        available: ['', 'shipped'], active: 'shipped',
        parked: { file: '.specify/companion.yml', unplaceable: 0, warnings: [] },
    },
};

/**
 * What this project wrote, drawn where it would attach, and not running.
 *
 * `workflow: shipped` bypasses `companion.yml` rather than emptying it, so the
 * hooks stay on the board — dashed, struck through, and carrying the word,
 * because a shade of grey in a column of greys is not a state anyone can read.
 */
export const HooksParked: Story = {
    name: 'Hooks · parked while the pipeline runs as it ships',
    render: () => (
        <One><Canvas graph={graph([step('implement', IMPLEMENT.phases.map(p => ({
            ...p,
            nodes: p.nodes.map(n => ({
                ...n, hooks: n.hooks.map(h => ({ ...h, parked: true })),
            })),
        })), { changes: { ...NO_CHANGES } })], PARKED)} {...CANVAS} /></One>
    ),
};

/**
 * Three sources at one anchor, in the order the registry declares them.
 *
 * `git` is spec-kit's own and carries GitHub's mark; Companion's own extension
 * carries the mascot but reads `via`, because it runs here and is not edited
 * here; anybody else's gets the neutral mark. The alternation is drawn as it
 * runs, so `git` heads two groups rather than being collected into one.
 */
export const HooksInterleavedSources: Story = {
    name: 'Hooks · three extensions alternating at one anchor',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('wrap-up', [node('handoff', 'Hand off to the next step')]),
        ], {
            stockHooks: [
                {
                    when: 'after', extension: 'git', command: 'speckit.git.commit',
                    description: 'Commit the work', optional: true, conditional: false,
                },
                {
                    when: 'after', extension: 'companion',
                    command: 'speckit.companion.after-specify',
                    description: 'Record the step', optional: false, conditional: true,
                },
                {
                    when: 'after', extension: 'acme-review',
                    command: 'acme.review.queue', description: 'Queue a house review',
                    optional: false, conditional: false,
                },
                {
                    when: 'after', extension: 'git', command: 'speckit.git.validate',
                    description: 'Check the branch is clean',
                    optional: false, conditional: false,
                },
            ],
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

export const PhaseMenuOpen: Story = {
    name: 'Phase · its label menu',
    render: () => (
        <One><Canvas graph={graph([step('specify', [
            phase('gather', [node('a', 'First node')]),
            phase('classify', [node('b', 'Second node'), node('c', 'Third node')]),
            phase('author', [node('d', 'Fourth node')]),
        ])])} {...CANVAS} /></One>
    ),
    play: async ({ canvasElement }) => {
        (canvasElement.querySelectorAll('.pb-phase-name')[1] as HTMLButtonElement | undefined)?.click();
    },
};

export const LaneAddAndRemoved: Story = {
    name: 'Lane · Add to, and a removed node with Undo',
    render: () => (
        <One><Canvas graph={graph([step('implement', [
            phase('execute', [node('execute', 'Execute the tasks'), node('check', 'Check the requirements')]),
        ])])} {...CANVAS} onAddTo={noop} adding="implement" onUndo={noop}
        removed={{
            command: 'implement', phase: 'execute', index: 2,
            name: 'Record what was verified', token: 'remove:implement:record-verified',
        }} /></One>
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

/** Docked narrow, the lanes stack and each join reads "then <step>". */
export const LanesStacked: Story = {
    name: 'Step · lanes stacked in a docked panel',
    parameters: { capture: { width: 380, height: 900 } },
    render: () => (
        <div style="width: 380px;">
            <One><Canvas graph={graph([SPECIFY, PLAN, TASKS, IMPLEMENT])} {...CANVAS} /></One>
        </div>
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

/** Which of the two is running, said in the band rather than left to be inferred. */
export const HeaderAsShipped: Story = {
    name: 'Header · running as it ships, with the project parked',
    render: () => (
        <One><Header
            graph={graph([step('specify', SPECIFY.phases, { changes: { ...NO_CHANGES } })],
                { ...PARKED, configured: false, customised: false })}
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

// ── Build bar ───────────────────────────────────────────

export const BuildBarAppears: Story = {
    name: 'Build bar · changes waiting',
    render: () => (
        <Foot><BuildBar graph={graph([SPECIFY, RAN])} buildState="stale" busy={false}
            report={null} status={null} {...BAR} /></Foot>
    ),
};

export const BuildBarAfterAWrite: Story = {
    name: 'Build bar · the last write, with the way back',
    render: () => (
        <Foot><BuildBar graph={graph([SPECIFY, RAN])} buildState="stale" busy={false}
            report={null}
            status={{ tone: 'done', text: 'draft-spec no longer runs in specify',
                undo: { token: 'remove:specify:draft-spec' } }}
            {...BAR} /></Foot>
    ),
};

export const BuildBarReview: Story = {
    name: 'Build bar · review open, with a problem',
    render: () => (
        <Foot><BuildBar graph={graph([SPECIFY, RAN])} buildState="stale" busy={false}
            report={PREVIEW_REPORT}
            status={{ tone: 'done', text: 'Hook added before execute',
                undo: { token: 'add:implement' } }}
            {...BAR} /></Foot>
    ),
    play: ({ canvasElement }: { canvasElement: HTMLElement }) => {
        Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('.builder-bar button'))
            .find(el => el.textContent === 'Review')?.click();
    },
};

export const BuildBarBuilding: Story = {
    name: 'Build bar · building',
    render: () => (
        <Foot><BuildBar graph={graph([SPECIFY, RAN])} buildState="stale" busy
            report={null} status={null} {...BAR} /></Foot>
    ),
};

export const BuildBarBuilt: Story = {
    name: 'Build bar · built',
    render: () => (
        <Foot><BuildBar graph={graph([SPECIFY])} buildState="current" busy={false}
            report={BUILT_REPORT} status={null} {...BAR} /></Foot>
    ),
};

export const BuildBarFailed: Story = {
    name: 'Build bar · the build failed',
    render: () => (
        <Foot><BuildBar graph={graph([SPECIFY, RAN])} buildState="stale" busy={false}
            report={{ ...BUILT_REPORT, ok: false,
                warnings: ['implement: unknown node "draft" in phase execute'] }}
            status={null} {...BAR} /></Foot>
    ),
};

export const BuildBarNarrow: Story = {
    name: 'Build bar · a docked panel',
    parameters: { capture: { width: 380, height: 420 } },
    render: () => (
        <Foot width={380}><BuildBar graph={graph([SPECIFY, RAN])} buildState="stale"
            busy={false} report={null} status={null} {...BAR} /></Foot>
    ),
};

/** Nothing configured, nothing changed: the first-run line is the loudest thing. */
export const HeaderFresh: Story = {
    name: 'Header · a fresh project',
    render: () => (
        <One><Header
            graph={graph([PLAN, TASKS], { firstRun: true, configured: false })}
            buildState="unconfigured" busy={false} {...HEAD} onDismissFirstRun={noop} /></One>
    ),
};

/** What the pipeline holds, which used to be a native tooltip on grey text. */
export const HeaderTally: Story = {
    name: 'Header · what the pipeline holds',
    render: () => (
        <One><Header
            graph={graph([SPECIFY, PLAN, TASKS, IMPLEMENT], { configured: true })}
            buildState="current" busy={false} {...HEAD} /></One>
    ),
    play: ({ canvasElement }: { canvasElement: HTMLElement }) => {
        (canvasElement.querySelector('.builder-overflow button') as HTMLButtonElement | null)?.click();
    },
};

/** The name, the workflow and the menu; Build is in the bar at the foot. */
export const HeaderNarrow: Story = {
    name: 'Header · a docked panel',
    parameters: { capture: { width: 380, height: 160 } },
    render: () => (
        <div style="width: 380px;">
            <One><Header
                graph={graph([step('specify', SPECIFY.phases, {
                    changes: { ...NO_CHANGES, hooks: 2, replaced: ['draft-spec'] },
                }), PLAN], { configured: true, customised: true })}
                buildState="stale" busy={false} {...HEAD} /></One>
        </div>
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

export const StatusAfterARefusedHookDrag: Story = {
    name: 'Status line · a hook drag that was refused',
    render: () => (
        <div class="builder">
            <StatusLine
                status={{
                    tone: 'warning',
                    text: 'Registered by the git extension in .specify/extensions.yml. '
                        + 'It runs here, and is not moved or edited in this panel.',
                }}
                onUndo={noop} onDismiss={noop} />
        </div>
    ),
};

export const StatusAfterAHookMove: Story = {
    name: 'Status line · a hook moved',
    render: () => (
        <div class="builder">
            <StatusLine status={{ tone: 'done', text: 'Hook moved up after complete',
                detail: 'Build to apply' }} onUndo={noop} onDismiss={noop} />
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
                pinned: 'load-context, draft-spec has to run after it',
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
            moveTargets={[
                { phase: 'gather', joins: 'end' },
                { phase: 'classify', joins: 'start' },
            ]}
            onMoveToPhase={noop}
            {...INSPECT} /></One>
    ),
};

/** The board and the inspector for `branch`, laid out as the panel lays them out. */
function MoveToPhaseOpen({ width }: { width: number }) {
    const branch = SPECIFY.phases[3].nodes[0];
    return (
        <div style={{ width: `${width}px` }}>
            <div class="builder">
                <div class="builder-body">
                    <Canvas graph={graph([SPECIFY])} {...CANVAS}
                        selected={{ command: 'specify', nodeId: branch.id }} />
                    <Inspector node={branch} step="specify"
                        body="Branch on the verdict." parts={[]}
                        editable="Branch on the verdict."
                        moveTargets={moveTargets(SPECIFY, branch.id)}
                        onMoveToPhase={noop} moveMenuOpen {...INSPECT} />
                </div>
            </div>
        </div>
    );
}

// The list escapes the clipping pane, stays inside the panel and scrolls when it runs out of room.
export const InspectorMoveToPhaseNarrow: Story = {
    name: 'Inspector · Move to phase, open in a narrow panel',
    parameters: { layout: 'fullscreen' },
    args: { width: 330 },
    render: args => <MoveToPhaseOpen width={Number(args?.width ?? 330)} />,
};

export const InspectorMoveToPhaseWide: Story = {
    name: 'Inspector · Move to phase, open in a wide panel',
    parameters: { layout: 'fullscreen' },
    args: { width: 1100 },
    render: args => <MoveToPhaseOpen width={Number(args?.width ?? 1100)} />,
};

export const InspectorHeld: Story = {
    name: 'Inspector · a node held in place, said in a word',
    render: () => (
        <One><Inspector
            node={node('resolve-dir', 'Resolve the spec folder', {
                pinned: 'load-context, draft-spec read it',
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
        <One><HookModal step={SPECIFY} anchor="author" choices={CHOICES}
            onCancel={noop} onAttach={noop} /></One>
    ),
};

export const AttachEditing: Story = {
    name: 'Add hook · editing one that is there',
    render: () => (
        <One><HookModal step={IMPLEMENT} anchor="handoff" choices={CHOICES}
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
        <One><HookModal step={SPECIFY} anchor="author" choices={{ skills: [], nodes: [], commands: [], fragments: [], presets: [] }}
            onCancel={noop} onAttach={noop} /></One>
    ),
};

/**
 * The catalog, on the kind that can actually run one.
 *
 * A spec-kit command is dispatched, not shelled, so it belongs to Instruction:
 * picking one writes the sentence that asks for it, which is how this project's
 * own hooks reach a skill or an agent. Each row says what the command does, who
 * registered it, and where it usually goes, so choosing needs no memorised name.
 */
export const AttachFromTheCatalog: Story = {
    name: 'Add hook · choosing a command this project has',
    render: () => (
        <One><HookModal step={SPECIFY} anchor="draft-spec" choices={{
            skills: ['create-pr'], nodes: ['review'], fragments: [], presets: [],
            commands: [
                { id: 'speckit.git.initialize', label: 'speckit.git.initialize',
                    note: 'Sets up the git repository',
                    usually: 'before constitution', from: 'git' },
                { id: 'speckit.git.feature', label: 'speckit.git.feature',
                    note: 'Creates the feature branch',
                    usually: 'before specify', from: 'git' },
                { id: 'speckit.git.commit', label: 'speckit.git.commit',
                    note: 'Commits outstanding changes, with a prompt first', from: 'git' },
                { id: 'speckit.companion.after-implement',
                    label: 'speckit.companion.after-implement',
                    note: 'Per-task journaling on implement',
                    usually: 'after implement', from: 'companion' },
            ],
        }} onCancel={noop} onAttach={noop} /></One>
    ),
};

export const AttachCommand: Story = {
    name: 'Add hook · a command, after a node',
    render: () => (
        <One><HookModal step={SPECIFY} anchor="draft-spec" choices={CHOICES}
            editing={hook({
                when: 'after', type: 'command', anchor: 'draft-spec', index: 0,
                summary: 'npm run lint-spec',
            })}
            onCancel={noop} onAttach={noop} onRemove={noop} /></One>
    ),
};

/** The skill list read from the catalog: where each one lives, and the one a hook cannot call. */
const CATALOG_CHOICES = {
    ...CHOICES,
    skillCatalog: [
        { id: 'superpowers:test-driven-development', name: 'test-driven-development',
            source: 'plugin' as const, where: 'superpowers', description: '', callable: true, enabled: true },
        { id: 'testing-library-patterns', name: 'testing-library-patterns',
            source: 'project' as const, where: '.claude/skills', description: '', callable: true, enabled: true },
        { id: 'run-tests', name: 'run-tests', source: 'user' as const,
            where: '~/.claude/skills', description: '', callable: false, enabled: true },
    ],
};

/** Type into the modal's search, the way a person would, so the list is drawn narrowed. */
function typed(text: string) {
    return (el: HTMLElement | null) => {
        const input = el?.querySelector<HTMLInputElement>('.pb-modal-search input');
        if (!input || input.value === text) { return; }
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };
}

export const AttachFromTheSkillCatalog: Story = {
    name: 'Add hook · the skill catalog, narrowed by typing',
    render: () => (
        <One><div ref={typed('test')}><HookModal step={IMPLEMENT} anchor="handoff" when="before"
            choices={CATALOG_CHOICES} onCancel={noop} onAttach={noop} /></div></One>
    ),
};

export const AttachNarrowSheet: Story = {
    name: 'Add hook · a full-height sheet when the panel is narrow',
    render: () => (
        <div class="builder" style="width: 380px">
            <div ref={typed('test')}><HookModal step={IMPLEMENT} anchor="handoff" when="before"
                choices={CATALOG_CHOICES} onCancel={noop} onAttach={noop} /></div>
        </div>
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

const STEP_FORM = {
    sequence: ['specify', 'plan', 'tasks', 'implement'],
    taken: ['specify', 'plan', 'tasks', 'implement', 'auto'],
    autoRuns: ['specify', 'plan', 'tasks', 'implement'],
};

const OFFERING = step('implement', [
    phase('execute', [node('execute', 'Execute the tasks'), node('check', 'Check the requirements')]),
    phase('wrap-up', [node('handoff', 'Hand off', { pinned: 'it hands off to the next step, so nothing can run after it' })]),
], {
    dropped: ['review-gaps', 'verify-manually', 'record-verified'],
    addOns: ['review-gaps', 'verify-manually'],
    offers: {
        'review-gaps': { name: 'Review the gaps', summary: 'Lists what the spec asked for and the code skipped' },
        'verify-manually': { name: 'Verify by hand', summary: 'Asks you to try it before it closes' },
        'record-verified': { name: 'Record what was verified', summary: '' },
    },
});

export const AddModalNode: Story = {
    name: 'Add modal · a node from the lane',
    render: () => (
        <One><HookModal step={OFFERING} anchor="execute" choices={CHOICES} mode="node"
            modes={['hook', 'node', 'step']} stepForm={STEP_FORM}
            onCancel={noop} onAttach={noop} onAddNode={noop} onNewStep={noop} /></One>
    ),
};

export const AddModalNothingOnOffer: Story = {
    name: 'Add modal · nothing on offer',
    render: () => (
        <One><HookModal step={step('tasks', [phase('author', [node('tasks-doc', 'Write the tasks')])])}
            anchor="author" choices={CHOICES} mode="node" modes={['hook', 'node', 'step']}
            stepForm={STEP_FORM} onCancel={noop} onAttach={noop} /></One>
    ),
};

export const NewStep: Story = {
    name: 'Add modal · a step, with the auto warning',
    render: () => (
        <One><HookModal step={OFFERING} anchor="execute" choices={CHOICES} mode="step"
            modes={['hook', 'node', 'step']} stepForm={{ ...STEP_FORM, after: 'implement' }}
            onCancel={noop} onAttach={noop} onNewStep={noop} /></One>
    ),
};

// Opened from the seam between two lanes, which is already the answer to
// "runs after" — so the form does not ask again.
export const NewStepAfterTasks: Story = {
    name: 'Add modal · a step opened at the seam after tasks',
    render: () => (
        <One><HookModal step={OFFERING} anchor="execute" choices={CHOICES} mode="step"
            modes={['step']} title="Add a step" stepForm={{ ...STEP_FORM, after: 'tasks' }}
            onCancel={noop} onAttach={noop} onNewStep={noop} /></One>
    ),
};
