/**
 * Every situation the Pipeline Builder can be in, side by side.
 *
 * The panel is hard to review from a running extension: reaching a state means
 * editing `companion.yml`, rebuilding, and hoping the state you wanted is the
 * one you got. Half of these — a broken configuration, a build mid-flight, a
 * node nothing can be dragged past — are awkward or slow to reach on purpose.
 *
 * So each one is a story. What they are FOR is the review: a state that reads
 * badly here reads badly in the panel.
 */
import type { Meta, StoryObj } from '@storybook/preact';
import { Canvas } from '../Canvas';
import { Header } from '../Header';
import type {
    PipelineGraph,
    PipelineHook,
    PipelineNode,
    PipelinePhase,
    PipelineStep,
} from '../../../../src/protocol/pipeline';

// ── Fixtures ────────────────────────────────────────────
// Shaped like `pipeline-graph.py` emits them. The ids, names and hook text are
// this repository's real pipeline, so the stories show the widths and the
// wrapping the panel actually has to survive.

const NO_CHANGES = {
    added: [], removed: [], reordered: false, hooks: 0, decisions: [], replaced: [],
    phases: [],
};

function node(id: string, name: string, over: Partial<PipelineNode> = {}): PipelineNode {
    return {
        id, name, kind: 'control', reads: [], writes: [], hooks: [],
        source: `/ext/nodes/${id}.md`, replaced: false, pinned: '', ...over,
    };
}

function phase(name: string, nodes: PipelineNode[], hooks: PipelineHook[] = []): PipelinePhase {
    return { name, nodes, hooks };
}

function step(name: string, phases: PipelinePhase[], over: Partial<PipelineStep> = {}): PipelineStep {
    return {
        name, inSequence: name !== 'auto', stockHooks: [], dropped: [], phases,
        frame: { source: `/ext/nodes/${name}/_frame.md`, replaced: false },
        decisions: [], artifacts: [], template: null,
        changes: { ...NO_CHANGES }, ...over,
    };
}

function graph(steps: PipelineStep[], over: Partial<PipelineGraph> = {}): PipelineGraph {
    return {
        steps,
        workflows: { available: ['shipped'], active: '' },
        choices: { skills: [], nodes: [] },
        configured: false,
        customised: false,
        warnings: [],
        counts: {
            steps: steps.length,
            phases: steps.reduce((n, s) => n + s.phases.length, 0),
            nodes: steps.reduce((n, s) => n + s.phases.reduce((m, p) => m + p.nodes.length, 0), 0),
            hooks: 0,
            stockHooks: 0,
        },
        ...over,
    };
}

/** The shipped `specify` step, as it really is. */
const SPECIFY = step('specify', [
    phase('gather', [
        node('resolve-dir', 'Resolve the spec folder', { kind: 'control' }),
        node('load-living-specs', 'Load living specs', { kind: 'investigate', reads: ['resolve-dir'] }),
    ]),
    phase('author', [
        node('draft-spec', 'Draft the spec', { kind: 'author', writes: ['spec.md'], reads: ['resolve-dir'] }),
        node('quality-checklist', 'Quality checklist', {
            kind: 'gate', writes: ['checklists/requirements.md'], reads: ['draft-spec'],
        }),
    ]),
    phase('classify', [
        node('classify-size', 'Classify the change size', { kind: 'control', reads: ['draft-spec'] }),
        node('persist-size', 'Record the verdict', { kind: 'control', reads: ['classify-size'] }),
    ]),
], {
    artifacts: ['spec.md', 'checklists/requirements.md'],
    template: { file: 'spec-template.md', sections: [] },
    decisions: [{
        node: 'classify-size',
        verdicts: [
            { name: 'simple', folds: ['plan', 'tasks'], warns: '' },
            { name: 'normal', folds: [], warns: '' },
        ],
    }],
});

const PLAN = step('plan', [
    phase('gather', [
        node('size-budget', 'Apply the size budget'),
        node('gather-context', 'Gather context', { kind: 'investigate' }),
    ]),
    phase('author', [node('plan-doc', 'Write the plan', { kind: 'author', writes: ['plan.md'] })]),
    phase('check', [node('constitution-check', 'Constitution check', { kind: 'gate' })]),
], { artifacts: ['plan.md'], template: { file: 'plan-template.md', sections: [] } });

const noop = () => undefined;
const CANVAS_ACTIONS = {
    onOpenNode: noop, onReplaceNode: noop, onRestoreNode: noop,
    onReorder: noop, onAddHook: noop,
};
const HEADER_ACTIONS = {
    onBuild: noop, onPreview: noop, onOpenConfig: noop,
    onSelectWorkflow: noop, onNewWorkflow: noop,
};

const meta: Meta = { title: 'Pipeline Builder/Situations' };
export default meta;
type Story = StoryObj;

// ── 1. The default: a project that has changed nothing ──

export const ShippedDefault: Story = {
    name: '1 · Nothing changed',
    render: () => (
        <div class="builder">
            <Header graph={graph([SPECIFY, PLAN])} buildState="unconfigured" busy={false} {...HEADER_ACTIONS} />
            <Canvas graph={graph([SPECIFY, PLAN])} {...CANVAS_ACTIONS} />
        </div>
    ),
};

// ── 2. Origin: what is shipped and what is the project's ──

export const OneNodeReplaced: Story = {
    name: '2 · One node is the project\'s own',
    render: () => {
        const ours = step('specify', [
            phase('author', [
                node('draft-spec', 'Draft the spec (ours)', {
                    kind: 'author', writes: ['spec.md'], replaced: true,
                    source: '/proj/.specify/companion/nodes/specify/draft-spec.md',
                }),
                node('quality-checklist', 'Quality checklist', { kind: 'gate' }),
            ]),
        ], { changes: { ...NO_CHANGES, replaced: ['draft-spec'] } });
        const g = graph([ours], { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="current" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

export const TemplateSectionReplaced: Story = {
    name: '3 · A template section is the project\'s own',
    render: () => {
        const g = graph([step('specify', [
            phase('author', [node('draft-spec', 'Draft the spec', { kind: 'author', writes: ['spec.md'] })]),
        ], {
            template: { file: 'spec-template.md', sections: ['User Scenarios & Testing'] },
            artifacts: ['spec.md'],
        })], { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="current" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

// ── 3. Hooks: every type, both sides, real text ──────────

export const EveryHookType: Story = {
    name: '4 · All four hook types',
    render: () => {
        const g = graph([step('implement', [
            phase('wrap-up', [
                node('complete', 'Mark the spec complete', {
                    hooks: [
                        { when: 'before', type: 'command', summary: 'python3 .specify/extensions/companion/scripts/doctor.py --chat || true', anchor: '', index: 0, note: ''  },
                        { when: 'before', type: 'node', summary: 'debug-timing', anchor: '', index: 0, note: ''  },
                    ],
                }),
                node('handoff', 'Hand off at the end', {
                    hooks: [
                        { when: 'after', type: 'prompt', summary: 'Before this spec is marked complete, self-review your full diff against the project conventions and the review checklist, and fix any violations you find.', anchor: '', index: 0, note: ''  },
                        { when: 'after', type: 'skill', summary: 'create-pr', anchor: '', index: 0, note: ''  },
                    ],
                }),
            ], [{ when: 'before', type: 'prompt', summary: 'Read the doctor report above and act on it.', anchor: '', index: 0, note: ''  }]),
        ], { changes: { ...NO_CHANGES, hooks: 5 } })], { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="current" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

export const OneVeryLongHook: Story = {
    name: '5 · A hook longer than the panel',
    render: () => {
        const g = graph([step('implement', [
            phase('wrap-up', [node('complete', 'Mark the spec complete', {
                hooks: [{
                    when: 'before', type: 'prompt', anchor: '', index: 0, note: '',
                    summary: 'Read the doctor report above and act on it by this rule. FIX IN THIS RUN only what is this run\'s own unfinished bookkeeping — tasks completed but never journaled, a living-spec delta not yet folded. Those are yours and they are cheap. DO NOT fix anything else here: drift, template violations, step bleed, and capture failures are separate work, and folding them into the tail of an unrelated spec produces a diff nobody can review.',
                }],
            })]),
        ], { changes: { ...NO_CHANGES, hooks: 1 } })], { configured: true, customised: true });
        return <Canvas graph={g} {...CANVAS_ACTIONS} />;
    },
};

export const ManyHooksOneAnchor: Story = {
    name: '6 · Several hooks on one node',
    render: () => {
        const g = graph([step('implement', [
            phase('wrap-up', [node('handoff', 'Hand off at the end', {
                hooks: [
                    { when: 'after', type: 'prompt', summary: 'Self-review your full diff against the project conventions.', anchor: '', index: 0, note: ''  },
                    { when: 'after', type: 'prompt', summary: 'Run the code-simplifier agent on the files you changed.', anchor: '', index: 0, note: ''  },
                    { when: 'after', type: 'skill', summary: 'create-pr', anchor: '', index: 0, note: ''  },
                ],
            })]),
        ], { changes: { ...NO_CHANGES, hooks: 3 } })], { configured: true, customised: true });
        return <Canvas graph={g} {...CANVAS_ACTIONS} />;
    },
};

// ── 4. The decision ─────────────────────────────────────

export const RoutingAsShipped: Story = {
    name: '7 · Routing, as it ships',
    render: () => <Canvas graph={graph([SPECIFY])} {...CANVAS_ACTIONS} />,
};

export const RoutingChanged: Story = {
    name: '8 · Routing the project changed',
    render: () => {
        const moved = step('specify', SPECIFY.phases, {
            decisions: [{
                node: 'classify-size',
                verdicts: [
                    { name: 'simple', folds: ['tasks'], warns: '' },
                    { name: 'normal', folds: [], warns: '' },
                    { name: 'oversized', folds: [], warns: 'This change is large enough to split.' },
                ],
            }],
            changes: { ...NO_CHANGES, decisions: ['classify-size'] },
        });
        const g = graph([moved], { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="stale" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

// ── 5. Recipe changes ───────────────────────────────────

export const NodeDropped: Story = {
    name: '9 · A node the project dropped',
    render: () => {
        const g = graph([step('specify', [
            phase('author', [node('draft-spec', 'Draft the spec', { kind: 'author', writes: ['spec.md'] })]),
        ], { changes: { ...NO_CHANGES, removed: ['quality-checklist'] } })],
            { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="never-built" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

export const NodesReordered: Story = {
    name: '10 · Nodes the project reordered',
    render: () => {
        const g = graph([step('plan', [
            phase('gather', [
                node('gather-context', 'Gather context', { kind: 'investigate' }),
                node('size-budget', 'Apply the size budget'),
            ]),
        ], { changes: { ...NO_CHANGES, reordered: true } })], { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="current" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

export const EverythingChangedAtOnce: Story = {
    name: '11 · Every kind of change at once',
    render: () => {
        const g = graph([step('specify', [
            phase('author', [
                node('draft-spec', 'Draft the spec (ours)', {
                    kind: 'author', writes: ['spec.md'], replaced: true,
                    hooks: [{ when: 'after', type: 'skill', summary: 'verify-code-review', anchor: '', index: 0, note: ''  }],
                }),
            ]),
        ], {
            template: { file: 'spec-template.md', sections: ['User Scenarios & Testing', 'Requirements'] },
            artifacts: ['spec.md'],
            changes: {
                added: [], removed: ['quality-checklist'], reordered: true,
                hooks: 1, decisions: ['classify-size'], replaced: ['draft-spec'],
            },
        })], { configured: true, customised: true, counts: { steps: 1, phases: 1, nodes: 1, hooks: 1 } });
        return (
            <div class="builder">
                <Header graph={g} buildState="stale" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

// ── 6. Header states ────────────────────────────────────

export const BuildIsBehind: Story = {
    name: '12 · The build is behind the file',
    render: () => (
        <Header graph={graph([SPECIFY], { configured: true, customised: true })}
            buildState="stale" busy={false} {...HEADER_ACTIONS} />
    ),
};

export const NeverBuilt: Story = {
    name: '13 · Configured but never built',
    render: () => (
        <Header graph={graph([SPECIFY], { configured: true, customised: true })}
            buildState="never-built" busy={false} {...HEADER_ACTIONS} />
    ),
};

export const Building: Story = {
    name: '14 · A build is running',
    render: () => (
        <Header graph={graph([SPECIFY], { configured: true, customised: true })}
            buildState="current" busy {...HEADER_ACTIONS} />
    ),
};

export const WithWarnings: Story = {
    name: '15 · The build reported a warning',
    render: () => (
        <Header
            graph={graph([SPECIFY], {
                configured: true,
                warnings: [
                    "hook anchor 'draft-specs' for specify.before not in active recipe — skipped",
                    "hook anchor 'wrapup' for implement.after not in active recipe — skipped",
                ],
            })}
            buildState="current" busy={false} {...HEADER_ACTIONS} />
    ),
};

// ── 7. Scale and edges ──────────────────────────────────

export const TheWholePipeline: Story = {
    name: '16 · All five steps',
    render: () => {
        const g = graph([
            step('auto', [
                phase('orchestrate', [node('orchestrate', 'Run every step in order')]),
                phase('wrap-up', [node('handoff', 'Hand off at the end')]),
            ]),
            SPECIFY,
            PLAN,
            step('tasks', [
                phase('author', [node('tasks-doc', 'Write the task list', { kind: 'author', writes: ['tasks.md'] })]),
                phase('check', [node('review-gaps', 'Review for gaps', { kind: 'gate' })]),
            ], { artifacts: ['tasks.md'] }),
            step('implement', [
                phase('execute', [node('implement-exec', 'Execute the tasks', { kind: 'author', writes: ['tasks.md'] })]),
                phase('wrap-up', [
                    node('complete', 'Mark the spec complete'),
                    node('handoff', 'Hand off at the end'),
                ]),
            ]),
        ], { configured: true, customised: true });
        return (
            <div class="builder">
                <Header graph={g} buildState="current" busy={false} {...HEADER_ACTIONS} />
                <Canvas graph={g} {...CANVAS_ACTIONS} />
            </div>
        );
    },
};

export const EmptyPhase: Story = {
    name: '17 · A step whose phase has one node',
    render: () => (
        <Canvas graph={graph([step('implement', [phase('execute', [
            node('implement-exec', 'Execute the tasks', { kind: 'author', writes: ['tasks.md'] }),
        ])])])} {...CANVAS_ACTIONS} />
    ),
};

export const NoPhases: Story = {
    name: '18 · A step with no phases declared',
    render: () => (
        <Canvas graph={graph([step('doctor', [])])} {...CANVAS_ACTIONS} />
    ),
};

export const SeveralWorkflows: Story = {
    name: '20 · Several saved workflows',
    render: () => (
        <Header
            graph={graph([SPECIFY], {
                configured: true, customised: true,
                workflows: { available: ['shipped', 'bugfix', 'client'], active: 'bugfix' },
            })}
            buildState="current" busy={false} {...HEADER_ACTIONS} />
    ),
};

export const APinnedNode: Story = {
    name: '21 · A node nothing can be dragged past',
    render: () => (
        <Canvas graph={graph([step('specify', [
            phase('gather', [
                node('resolve-dir', 'Resolve the spec folder', {
                    pinned: 'load-living-specs has to run after it',
                }),
                node('load-living-specs', 'Load living specs', {
                    kind: 'investigate', reads: ['resolve-dir'],
                    pinned: 'it has to run after resolve-dir',
                }),
            ]),
            phase('wrap-up', [
                node('finalize', 'Finalize'),
                node('handoff', 'Hand off to the next step'),
            ]),
        ])])} {...CANVAS_ACTIONS} />
    ),
};

export const NarrowPanel: Story = {
    name: '19 · A narrow panel',
    render: () => (
        <div style={{ width: '380px', border: '1px dashed var(--border)' }}>
            <Header graph={graph([SPECIFY], { configured: true, customised: true })}
                buildState="stale" busy={false} {...HEADER_ACTIONS} />
            <Canvas graph={graph([SPECIFY])} {...CANVAS_ACTIONS} />
        </div>
    ),
};
