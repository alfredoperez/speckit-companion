/**
 * One place the builder's stories get their data from.
 *
 * Shaped like `pipeline-graph.py` emits it, with this repository's real ids,
 * names and hook text — so a story shows the widths and the wrapping the panel
 * actually has to survive rather than the ones a short placeholder would.
 */
import type {
    PipelineChoices,
    PipelineGraph,
    PipelineHook,
    PipelineNode,
    PipelinePhase,
    PipelineStep,
    StockHook,
} from '../../../../src/protocol/pipeline';

export const NO_CHANGES = {
    added: [], removed: [], reordered: false, hooks: 0,
    decisions: [], replaced: [], phases: [],
};

export function node(
    id: string, name: string, over: Partial<PipelineNode> = {},
): PipelineNode {
    return {
        id, name, kind: 'control', reads: [], writes: [], mayWrite: [], hooks: [], pinned: '',
        variants: [], source: `/ext/nodes/${id}.md`, replaced: false, shipped: true, ...over,
    };
}

export function hook(over: Partial<PipelineHook> = {}): PipelineHook {
    return {
        when: 'before', type: 'prompt', summary: 'Check the CHANGELOG is updated.',
        anchor: 'draft-spec', index: 0, note: '', ...over,
    };
}

export function phase(
    name: string, nodes: PipelineNode[], hooks: PipelineHook[] = [],
): PipelinePhase {
    return { name, nodes, hooks };
}

export function step(
    name: string, phases: PipelinePhase[], over: Partial<PipelineStep> = {},
): PipelineStep {
    return {
        name,
        inSequence: name !== 'auto',
        own: false,
        after: '',
        stockHooks: [],
        hooks: [],
        dropped: [],
        addOns: [],
        offers: {},
        frame: { source: `/ext/nodes/${name}/_frame.md`, replaced: false },
        phases,
        decisions: [],
        artifacts: [],
        template: null,
        changes: { ...NO_CHANGES },
        ...over,
    };
}

export const CHOICES: PipelineChoices = {
    skills: ['create-pr', 'code-review', 'verify-code-review', 'speckit-companion-doctor'],
    nodes: ['debug-timing', 'house-review', 'timing'],
    fragments: [
        { name: 'outcomes', section: 'User Scenarios & Testing', for: 'specify',
          summary: 'Observable outcomes instead of prioritized user stories.' },
        { name: 'ears-requirements', section: 'User Scenarios & Testing', for: 'specify',
          summary: 'Numbered requirements with WHEN/THEN/SHALL criteria.' },
        { name: 'stories-classic', section: 'User Scenarios & Testing', for: 'specify',
          summary: "Stock spec-kit's three P1/P2/P3 stories." },
    ],
    presets: [
        { name: 'classic', label: 'Classic spec-kit',
          summary: "Stock spec-kit's document shapes — prioritized P1/P2/P3 user stories." },
        { name: 'brownfield', label: 'Brownfield',
          summary: 'For changing a system that already exists.' },
    ],
};

/** A step this project added: its own directory, placed after implement. */
export const OWN_STEP = step('review', [
    phase('review', [node('review-work', 'Review the change')]),
], { own: true, after: 'implement', artifacts: ['review.md'] });

export function graph(
    steps: PipelineStep[], over: Partial<PipelineGraph> = {},
): PipelineGraph {
    return {
        steps,
        workflows: { available: ['shipped'], active: '' },
        choices: CHOICES,
        configured: false,
        customised: false,
        warnings: [],
        counts: {
            steps: steps.length,
            phases: steps.reduce((n, s) => n + s.phases.length, 0),
            nodes: steps.reduce((n, s) => n + s.phases.reduce((m, p) => m + p.nodes.length, 0), 0),
            hooks: steps.reduce((n, s) => n + s.changes.hooks, 0),
            stockHooks: steps.reduce((n, s) => n + s.stockHooks.length, 0),
        },
        ...over,
    };
}

// ── This repository's real pipeline ─────────────────────

export const SPECIFY = step('specify', [
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
            hooks: [hook({
                when: 'before', type: 'node', summary: 'debug-timing', anchor: 'draft-spec',
            })],
        }),
        node('quality-checklist', 'Write the quality checklist', {
            kind: 'gate', writes: ['checklists/requirements.md'], reads: ['draft-spec'],
        }),
    ]),
    phase('classify', [
        node('classify-size', 'Classify the change size', { reads: ['draft-spec'] }),
        node('persist-size', 'Record the size verdict', { reads: ['classify-size'] }),
    ]),
    phase('wrap-up', [
        node('branch', 'Create the feature branch'),
        node('finalize', 'Finalise the spec', { reads: ['branch'] }),
        node('handoff', 'Hand off to the next step'),
    ]),
], {
    artifacts: ['spec.md', 'checklists/requirements.md'],
    template: { file: 'spec-template.md', sections: [], sectionsAvailable: [], chosenBy: {} },
    changes: { ...NO_CHANGES, hooks: 1 },
    decisions: [{
        node: 'classify-size',
        verdicts: [
            { name: 'simple', folds: ['plan', 'tasks'], warns: '' },
            { name: 'normal', folds: [], warns: '' },
            { name: 'oversized', folds: [], warns: 'This change is large enough to split.' },
        ],
    }],
});

export const PLAN = step('plan', [
    phase('gather', [
        node('size-budget', 'Apply the size budget'),
        node('gather-context', 'Gather context', { kind: 'investigate' }),
    ]),
    phase('author', [
        node('plan-doc', 'Write the plan', {
            kind: 'author', writes: ['plan.md'], reads: ['gather-context'],
            pinned: 'it has to run after gather-context and before constitution-check, side-files',
        }),
    ]),
    phase('check', [
        node('constitution-check', 'Check against the constitution', {
            kind: 'gate', reads: ['plan-doc'],
        }),
    ]),
    phase('wrap-up', [
        node('side-files', 'Write the design side files', {
            kind: 'author', reads: ['plan-doc'],
        }),
        node('handoff', 'Hand off to the next step'),
    ]),
], {
    artifacts: ['plan.md', 'research.md', 'data-model.md', 'contracts/'],
    template: { file: 'plan-template.md', sections: [], sectionsAvailable: [], chosenBy: {} },
});

export const TASKS = step('tasks', [
    phase('gather', [node('size-budget', 'Apply the size budget')]),
    phase('author', [
        node('tasks-doc', 'Write the task list', { kind: 'author', writes: ['tasks.md'] }),
    ]),
    phase('check', [node('review-gaps', 'Review for gaps', { kind: 'gate' })]),
    phase('wrap-up', [node('handoff', 'Hand off to the next step')]),
], { artifacts: ['tasks.md'], template: { file: 'tasks-template.md', sections: [], sectionsAvailable: [], chosenBy: {} } });

export const IMPLEMENT = step('implement', [
    phase('execute', [
        node('implement-exec', 'Execute the tasks', { kind: 'author', writes: ['tasks.md'] }),
    ]),
    phase('wrap-up', [
        node('complete', 'Mark the spec complete', {
            hooks: [
                hook({
                    when: 'before', type: 'command', anchor: 'complete', index: 0,
                    summary: 'python3 .specify/extensions/companion/scripts/doctor.py --chat || true',
                }),
                hook({
                    when: 'before', type: 'prompt', anchor: 'complete', index: 1,
                    summary: 'Read the doctor report above and act on it by this rule. FIX IN '
                        + 'THIS RUN only what is this run\'s own unfinished bookkeeping.',
                }),
            ],
        }),
        node('handoff', 'Hand off at the end', {
            hooks: [
                hook({
                    when: 'after', type: 'prompt', anchor: 'handoff', index: 0,
                    summary: 'Before this spec is marked complete, self-review your full diff.',
                }),
                hook({
                    when: 'after', type: 'skill', anchor: 'handoff', index: 1,
                    summary: 'create-pr', note: 'Do not merge.',
                }),
            ],
        }),
    ]),
], { changes: { ...NO_CHANGES, hooks: 4 } });

export const AUTO = step('auto', [
    phase('orchestrate', [node('orchestrate', 'Run every step in order')]),
    phase('wrap-up', [node('handoff', 'Hand off at the end')]),
], { inSequence: false });

/** The hooks this repository's own spec-kit extensions register. */
export const STOCK: StockHook[] = [
    {
        when: 'before', extension: 'git', command: 'speckit.git.feature',
        description: 'Create feature branch before specification',
        optional: false, conditional: false,
    },
    {
        when: 'after', extension: 'git', command: 'speckit.git.commit',
        description: 'Auto-commit after specification', optional: true, conditional: false,
    },
    {
        when: 'after', extension: 'companion', command: 'speckit.companion.after-specify',
        description: 'Record specify completion into .spec-context.json',
        optional: false, conditional: true,
    },
];

/** The whole pipeline, as this repository runs it. */
export const WHOLE = graph([AUTO, SPECIFY, PLAN, TASKS, IMPLEMENT], {
    configured: true,
    customised: true,
    workflows: { available: ['shipped', 'bugfix'], active: '' },
});
