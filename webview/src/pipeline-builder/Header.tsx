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

/** `1 step`, `3 phases`. A pipeline with one of something said "1 steps". */
function tally(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The one fact about this pipeline you cannot get by looking at it.
 *
 * The header used to read `5 steps · 16 phases · 24 nodes · 0 hooks`. Three of
 * those four are on screen, in columns, countable — restating them is chrome.
 * The fourth was the only one worth having and it was WRONG: it counted the
 * project's own hooks and ignored every hook an installed extension registers,
 * so a board visibly carrying four of them said zero.
 *
 * Hooks are the thing you genuinely cannot total by eye — they sit at boundaries
 * scattered down five lanes. So that is what the line says, and it says how many
 * are the project's, because that is the part a reader is deciding about.
 */
function hookTally(graph: PipelineGraph): string {
    const total = graph.counts.hooks + graph.counts.stockHooks;
    if (total === 0) { return 'nothing attached'; }
    return graph.counts.hooks > 0
        ? `${tally(total, 'hook')} · ${graph.counts.hooks} yours`
        : tally(total, 'hook');
}

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
        if (step.changes.phases.length) {
            bits.push(`phases: ${step.changes.phases.join(', ')}`);
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
                <span class="builder-count"
                    title={`${tally(graph.counts.steps, 'step')}, `
                        + `${tally(graph.counts.phases, 'phase')}, `
                        + `${tally(graph.counts.nodes, 'node')}`
                        + (graph.counts.stockHooks
                            ? `\n${tally(graph.counts.stockHooks, 'hook')} from installed `
                              + 'spec-kit extensions, which this panel shows but does not edit'
                            : '')}>
                    {hookTally(graph)}
                </span>
                {/* Every one of these says what it does. The filename alone was a
                    noun among verbs, and it is the same action the error screen
                    already calls "Open companion.yml". */}
                <button class="builder-action builder-action--quiet" onClick={onOpenConfig}>
                    Open companion.yml
                </button>
                <button class="builder-action builder-action--quiet" disabled={busy}
                    onClick={onPreview}>
                    Preview
                </button>
                {/* "Build" — this runs the project's own build and writes the
                    command files. Claude is who reads them afterwards, not who
                    does this, and naming it here promised a step that never ran. */}
                <button class="builder-action builder-action--primary" disabled={busy}
                    onClick={onBuild}>
                    {busy ? 'Building…' : 'Build'}
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
