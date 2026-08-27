/**
 * The canvas: step ⊃ phase ⊃ node, drawn as containment.
 *
 * The three levels only mean anything if you can see one inside the other, so a
 * step is an outlined container, a phase a tinted band within it, and a node a
 * box within that. Steps are linked edge to edge.
 *
 * A decision states where its verdicts route in words. The design round tried
 * drawn wires and they crossed the canvas without saying more than a sentence
 * does.
 */

import { PipelineGraph, PipelineNode, PipelinePhase, PipelineStep } from '../../../src/protocol/pipeline';

const KIND_LABEL: Record<string, string> = {
    investigate: 'INVST',
    author: 'AUTHR',
    gate: 'GATE',
    control: 'CTRL',
};

interface Props {
    graph: PipelineGraph;
    onOpenNode: (command: string, nodeId: string) => void;
}

function HookChips({ hooks }: { hooks: PipelineNode['hooks'] }) {
    if (hooks.length === 0) { return null; }
    return (
        <div class="pb-hooks">
            {hooks.map((hook, i) => (
                <span key={i} class={`pb-hook pb-hook--${hook.type}`} title={hook.summary}>
                    {hook.when} · {hook.type}
                    {hook.summary ? `: ${hook.summary.slice(0, 48)}` : ''}
                </span>
            ))}
        </div>
    );
}

function Node({ node, step, onOpenNode }: {
    node: PipelineNode; step: string; onOpenNode: Props['onOpenNode'];
}) {
    return (
        <div class="pb-node">
            <button class="pb-node-main" onClick={() => onOpenNode(step, node.id)}>
                <span class="pb-node-name">{node.name}</span>
                <span class="pb-node-meta">
                    <span class="pb-node-id">{node.id}</span>
                    <span class={`pb-kind pb-kind--${node.kind}`}>
                        {KIND_LABEL[node.kind] ?? node.kind}
                    </span>
                    {node.writes.map(file => (
                        <span key={file} class="pb-writes" title="produced by this node">{file}</span>
                    ))}
                </span>
            </button>
            <HookChips hooks={node.hooks} />
        </div>
    );
}

function Phase({ phase, step, onOpenNode }: {
    phase: PipelinePhase; step: string; onOpenNode: Props['onOpenNode'];
}) {
    return (
        <div class="pb-phase">
            <div class="pb-phase-head">
                <span class="pb-phase-name">PHASE · {phase.name}</span>
                <HookChips hooks={phase.hooks} />
            </div>
            <div class="pb-phase-nodes">
                {phase.nodes.map(node => (
                    <Node key={node.id} node={node} step={step} onOpenNode={onOpenNode} />
                ))}
            </div>
        </div>
    );
}

function Decisions({ step }: { step: PipelineStep }) {
    if (step.decisions.length === 0) { return null; }
    return (
        <div class="pb-decisions">
            {step.decisions.map(decision => (
                <div key={decision.node} class="pb-decision">
                    <span class="pb-decision-node">{decision.node} decides:</span>
                    <ul class="pb-verdicts">
                        {decision.verdicts.map(verdict => (
                            <li key={verdict.name}>
                                <span class="pb-verdict">{verdict.name}</span>
                                {' → '}
                                {verdict.folds.length
                                    ? `skips ${verdict.folds.join(', ')}`
                                    : verdict.warns
                                        ? 'warns, then runs everything'
                                        : 'runs everything'}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function Step({ step, onOpenNode }: { step: PipelineStep; onOpenNode: Props['onOpenNode'] }) {
    const changed = step.changes.added.length || step.changes.removed.length
        || step.changes.reordered || step.changes.hooks || step.changes.decisions.length
        || step.template;
    return (
        <section class={`pb-step ${changed ? 'pb-step--changed' : ''}`}>
            <header class="pb-step-head">
                <span class="pb-step-kicker">STEP</span>
                <h2 class="pb-step-name">{step.name}</h2>
                {step.template && (
                    <span class="pb-template" title={
                        step.template.sections.length
                            ? `replaced: ${step.template.sections.join(', ')}`
                            : 'used as it ships'
                    }>
                        {step.template.file}
                        {step.template.sections.length ? ` · § ${step.template.sections.length}` : ''}
                    </span>
                )}
                <span class="pb-step-counts">
                    {step.phases.length} phases ·{' '}
                    {step.phases.reduce((n, phase) => n + phase.nodes.length, 0)} nodes
                </span>
            </header>

            {step.phases.map(phase => (
                <Phase key={phase.name} phase={phase} step={step.name} onOpenNode={onOpenNode} />
            ))}

            <Decisions step={step} />

            {step.artifacts.length > 0 && (
                <footer class="pb-artifacts">
                    produces {step.artifacts.join(', ')}
                </footer>
            )}
        </section>
    );
}

export function Canvas({ graph, onOpenNode }: Props) {
    return (
        <main class="pb-canvas">
            {graph.steps.map((step, index) => (
                <div key={step.name} class="pb-chain-item">
                    <Step step={step} onOpenNode={onOpenNode} />
                    {index < graph.steps.length - 1 && (
                        <div class="pb-link" aria-hidden="true" />
                    )}
                </div>
            ))}
        </main>
    );
}
