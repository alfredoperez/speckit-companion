/**
 * The page-chrome band: what this pipeline is, whether it needs rebuilding, and
 * the one forward action.
 *
 * The divergence chip is the design's collapsed sidebar — it states whether
 * anything differs from the shipped pipeline and expands to say what, rather
 * than holding a permanent rail open for a project that changed nothing.
 */

import { useState } from 'preact/hooks';
import { PipelineBuildKind, PipelineGraph } from '../../../src/protocol/pipeline';

interface Props {
    graph: PipelineGraph;
    buildState: PipelineBuildKind;
    busy: boolean;
    onBuild: () => void;
    onPreview: () => void;
    onOpenConfig: () => void;
    /** Switch the whole configuration to another saved workflow. */
    onSelectWorkflow: (name: string) => void;
    /** Start a new workflow, seeded from the one in force. */
    onNewWorkflow: () => void;
}

/** Drawn, so it takes the warning hue rather than a font's idea of one. */
function WarningIcon() {
    return (
        <svg class="builder-notice-icon" width="14" height="14" viewBox="0 0 16 16"
            fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
            aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3.5" />
            <path d="M8 10.8h.01" />
        </svg>
    );
}

/** How a workflow reads in the switcher. The stored name is a filename. */
function workflowLabel(name: string): string {
    if (name === '') { return 'This project'; }
    if (name === 'shipped') { return 'As it ships'; }
    return name;
}

/** What the build state means, in the words a person would use. */
function buildNotice(state: PipelineBuildKind): { text: string; tone: string } | null {
    switch (state) {
        case 'stale':
            return {
                text: 'companion.yml changed since the last build — the assistant is still reading the old commands',
                tone: 'warning',
            };
        case 'never-built':
            return { text: 'This configuration has never been built', tone: 'warning' };
        case 'current':
        case 'unconfigured':
            return null;
    }
}

function changeSummary(graph: PipelineGraph): string[] {
    const lines: string[] = [];
    for (const step of graph.steps) {
        const bits: string[] = [];
        if (step.changes.removed.length) { bits.push(`−${step.changes.removed.join(', ')}`); }
        if (step.changes.added.length) { bits.push(`+${step.changes.added.join(', ')}`); }
        if (step.changes.reordered) { bits.push('reordered'); }
        if (step.changes.hooks) {
            bits.push(`${step.changes.hooks} hook${step.changes.hooks === 1 ? '' : 's'}`);
        }
        if (step.changes.replaced.length) {
            bits.push(`your own: ${step.changes.replaced.join(', ')}`);
        }
        if (step.changes.decisions.length) {
            bits.push(`routing: ${step.changes.decisions.join(', ')}`);
        }
        if (step.template) {
            bits.push(step.template.sections.length
                ? `template § ${step.template.sections.join(', ')}`
                : `template ${step.template.file}`);
        }
        if (bits.length) { lines.push(`${step.name}: ${bits.join(' · ')}`); }
    }
    return lines;
}

export function Header(props: Props) {
    const { graph, buildState, busy, onBuild, onPreview, onOpenConfig } = props;
    const [open, setOpen] = useState(false);
    const [pickingWorkflow, setPickingWorkflow] = useState(false);
    const notice = buildNotice(buildState);
    const changes = changeSummary(graph);

    return (
        <header class="builder-header">
            <div class="builder-identity">
                <span class="builder-title">Pipeline</span>

                <div class="builder-workflow">
                    <button class="builder-workflow-current"
                        aria-expanded={pickingWorkflow}
                        onClick={() => setPickingWorkflow(!pickingWorkflow)}
                        title="The way of working this project is on">
                        {workflowLabel(graph.workflows.active)}
                        <span class="builder-chip-caret" aria-hidden="true">
                            {pickingWorkflow ? '\u25b4' : '\u25be'}
                        </span>
                    </button>
                    {pickingWorkflow && (
                        <ul class="builder-workflow-menu">
                            {graph.workflows.available.map(name => (
                                <li key={name}>
                                    <button
                                        class={`builder-workflow-option ${
                                            name === graph.workflows.active
                                                ? 'builder-workflow-option--active' : ''}`}
                                        onClick={() => {
                                            setPickingWorkflow(false);
                                            props.onSelectWorkflow(name);
                                        }}>
                                        {workflowLabel(name)}
                                        {name === 'shipped' && (
                                            <span class="builder-workflow-note">
                                                Companion with nothing changed
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                            <li class="builder-workflow-new">
                                <button class="builder-workflow-option"
                                    onClick={() => {
                                        setPickingWorkflow(false);
                                        props.onNewWorkflow();
                                    }}>
                                    New workflow…
                                </button>
                            </li>
                        </ul>
                    )}
                </div>

                <button
                    class={`builder-chip ${graph.customised ? 'builder-chip--customised' : ''}`}
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                >
                    {graph.customised
                        ? `Customised · ${changes.length} step${changes.length === 1 ? '' : 's'}`
                        : 'Shipped default · no changes'}
                    <span class="builder-chip-caret">{open ? '▴' : '▾'}</span>
                </button>
            </div>

            <div class="builder-facts">
                <span class="builder-count">
                    {graph.counts.steps} steps · {graph.counts.phases} phases ·{' '}
                    {graph.counts.nodes} nodes · {graph.counts.hooks} hooks
                </span>
                <button class="builder-action builder-action--quiet" onClick={onOpenConfig}>
                    companion.yml
                </button>
                <button class="builder-action builder-action--quiet" disabled={busy} onClick={onPreview}>
                    Preview
                </button>
                <button class="builder-action builder-action--primary" disabled={busy} onClick={onBuild}>
                    {busy ? 'Building…' : 'Build with Claude'}
                </button>
            </div>

            {notice && (
                <div class={`builder-notice builder-notice--${notice.tone}`}>
                    <WarningIcon />
                    {notice.text}
                </div>
            )}

            {graph.warnings.length > 0 && (
                <div class="builder-notice builder-notice--warning">
                    {graph.warnings.map(warning => <div key={warning}>{warning}</div>)}
                </div>
            )}

            {open && (
                <div class="builder-changes">
                    {changes.length === 0 ? (
                        <p class="builder-changes-empty">
                            This project runs the pipeline exactly as it ships. Anything it
                            adds, removes or rewires will be listed here.
                        </p>
                    ) : (
                        <ul class="builder-changes-list">
                            {changes.map(line => <li key={line}>{line}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </header>
    );
}
