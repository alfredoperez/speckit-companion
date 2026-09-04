/**
 * The page-chrome band: what this pipeline is, whether it needs rebuilding, and
 * the one forward action.
 *
 * The divergence chip is the design's collapsed sidebar — it states whether
 * anything differs from the shipped pipeline and expands to say what, rather
 * than holding a permanent rail open for a project that changed nothing.
 */

import { useState } from 'preact/hooks';
import { BuildReport, PipelineBuildKind, PipelineGraph } from '../../../src/protocol/pipeline';
import { changed } from './changes';
import { totals } from './counts';
import { Menu } from './Menu';

/** Starts a workflow rather than switching to one. A workflow is a `.yml`
    stem, so `#` cannot be the name of a real one. */
const NEW_WORKFLOW = '#new';

interface Props {
    graph: PipelineGraph;
    buildState: PipelineBuildKind;
    busy: boolean;
    /** What the last build or preview did. Absent until one has run. */
    report?: BuildReport | null;
    onBuild: () => void;
    onPreview: () => void;
    onOpenConfig: () => void;
    /** Switch the whole configuration to another saved workflow. */
    onSelectWorkflow: (name: string) => void;
    /** Start a new workflow, seeded from the one in force. */
    onNewWorkflow: () => void;
    /** The first-run line has been read. Absent outside the panel. */
    onDismissFirstRun?: () => void;
}

/**
 * The mark a line carries, drawn rather than typed.
 *
 * A glyph takes a font's idea of the shape and none of the semantic hue; these
 * take the tone's colour. Exported because the status line at the foot of the
 * panel says the same three kinds of thing this band does, in the same marks.
 */
export function StatusIcon({ tone }: { tone: string }) {
    if (tone === 'done') {
        return (
            <svg class="builder-notice-icon builder-notice-icon--done" width="14" height="14"
                viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true" focusable="false">
                <path d="M3 8.4 6.3 11.6 13 5" />
            </svg>
        );
    }
    return (
        <svg class={`builder-notice-icon builder-notice-icon--${tone}`} width="14" height="14"
            viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"
            stroke-linecap="round" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="6" />
            {tone === 'info'
                ? <><path d="M8 7.2v3.6" /><path d="M8 5.1h.01" /></>
                : <><path d="M8 5v3.5" /><path d="M8 10.8h.01" /></>}
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
 *
 * Counted from the steps the canvas draws, not from `graph.counts`: those two
 * disagreed, and a board showing five hooks was topped by `nothing attached`.
 */
function hookTally(graph: PipelineGraph): string {
    const { hooks, stockHooks } = totals(graph);
    const total = hooks + stockHooks;
    if (total === 0) { return 'nothing attached'; }
    return hooks > 0 ? `${tally(total, 'hook')} · ${hooks} yours` : tally(total, 'hook');
}

function workflowLabel(name: string): string {
    if (name === '') { return 'This project'; }
    if (name === 'shipped') { return 'As shipped'; }
    return name;
}

/**
 * What the build state means, in the words a person would use.
 *
 * A stale build carries the count, because "it is behind" is only worrying once
 * you know how much of your work is not in it.
 */
function buildNotice(
    state: PipelineBuildKind, changedSteps: number,
): { text: string; tone: string } | null {
    switch (state) {
        case 'stale':
            return {
                text: changedSteps
                    ? `${tally(changedSteps, 'changed step')} not built yet — the assistant `
                      + 'is still reading the old commands'
                    : 'companion.yml changed since the last build — the assistant is still '
                      + 'reading the old commands',
                tone: 'warning',
            };
        case 'never-built':
            return { text: 'This configuration has never been built', tone: 'warning' };
        case 'current':
        case 'unconfigured':
            return null;
    }
}

/** `a`, `a and b`, `a, b and c` — a list read the way it would be said. */
function readList(names: string[]): string {
    if (names.length < 2) { return names.join(''); }
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What a build or a preview did, in one line. */
function reportLine(report: BuildReport): string {
    if (!report.ok) {
        return report.dryRun
            ? `The preview failed at ${report.at} — the configuration could not be read`
            : `The build failed at ${report.at} — nothing was written`;
    }
    if (!report.dryRun) {
        return `Built ${report.at} · ${tally(report.commands, 'command')} written`;
    }
    if (report.changed.length === 0) {
        return `Preview: nothing would change in ${tally(report.commands, 'command')}`;
    }
    return `Preview: ${report.changed.length} of ${report.commands} commands would change, `
        + readList(report.changed);
}

/** A preview wrote nothing, so it is news rather than a job done. */
function reportTone(report: BuildReport): string {
    if (!report.ok) { return 'warning'; }
    return report.dryRun ? 'info' : 'done';
}

function changeSummary(graph: PipelineGraph): string[] {
    const lines: string[] = [];
    for (const step of graph.steps) {
        if (!changed(step)) { continue; }
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
        // Only a section someone pointed elsewhere. Every step that writes a
        // document has a template, so naming the file listed "template
        // spec-template.md" as a change on a step whose template nobody had
        // touched — which is why the derivation this list belongs to ignores
        // its presence too.
        if (step.template?.sections.length) {
            bits.push(`template: ${step.template.sections.join(', ')}`);
        }
        if (bits.length) { lines.push(`${step.name}: ${bits.join(' · ')}`); }
    }
    return lines;
}

export function Header(props: Props) {
    const { graph, buildState, busy, report, onBuild, onPreview, onOpenConfig } = props;
    const counts = totals(graph);
    const [open, setOpen] = useState(false);
    const [showingLog, setShowingLog] = useState(false);
    const changes = changeSummary(graph);
    const changedSteps = graph.steps.filter(changed).length;
    // A report is the newer and more specific statement about the same file, so
    // it replaces the build state rather than stacking under it — a preview that
    // answers "2 of 5 would change" does not also need an amber line saying the
    // build is behind, which is what asking for a preview already meant.
    const notice = report ? null : buildNotice(buildState, changedSteps);
    // Nothing configured AND nothing changed. Editing a node writes a project
    // file and no configuration at all, so keying on the configuration alone
    // let the panel say "Changed · 1 step" and, one line below, that this is
    // the pipeline as it ships.
    const firstRun = graph.firstRun === true && !graph.configured && changedSteps === 0;

    const workflows = [
        ...graph.workflows.available.map(name => ({
            id: name,
            label: workflowLabel(name),
            // Which one is running was a bold row before; a Menu says it in words.
            note: [
                name === 'shipped' ? 'Companion with nothing changed' : '',
                name === graph.workflows.active ? 'In force' : '',
            ].filter(Boolean).join(' · ') || undefined,
        })),
        { id: NEW_WORKFLOW, label: 'New workflow…', note: 'Starts from the one in force' },
    ];

    return (
        <header class="builder-header">
            <div class="builder-identity">
                <span class="builder-title">Pipeline</span>

                {/* Two dropdowns stood side by side, one naming a workflow and
                    one summarising the changes, with nothing to say which was
                    which. This one now says what it picks. */}
                <div class="builder-workflow">
                    <span class="builder-workflow-label">Workflow</span>
                    <Menu
                        class="builder-workflow-current"
                        trigger={workflowLabel(graph.workflows.active)}
                        label={`Workflow: ${workflowLabel(graph.workflows.active)}`}
                        title="The way of working this project is on"
                        options={workflows}
                        onPick={id => {
                            if (id === NEW_WORKFLOW) { props.onNewWorkflow(); }
                            else { props.onSelectWorkflow(id); }
                        }} />
                </div>

                {/* Nothing changed is a whole fact. Expanding it said "this
                    project runs the pipeline exactly as it ships" under a line
                    already saying the same thing, so the chip states it and
                    stops. */}
                {changedSteps === 0 ? (
                    <span class="builder-chip builder-chip--flat">No changes</span>
                ) : (
                    <button class="builder-chip builder-chip--customised"
                        aria-expanded={open}
                        onClick={() => setOpen(!open)}
                    >
                        {`Changed · ${changedSteps} step${changedSteps === 1 ? '' : 's'}`}
                        <span class="builder-chip-caret">{open ? '▴' : '▾'}</span>
                    </button>
                )}
            </div>

            <div class="builder-facts">
                <span class="builder-count"
                    title={`${tally(counts.steps, 'step')}, `
                        + `${tally(counts.phases, 'phase')}, `
                        + `${tally(counts.nodes, 'node')}`
                        + (counts.stockHooks
                            ? `\n${tally(counts.stockHooks, 'hook')} from installed `
                              + 'spec-kit extensions, which this panel shows but does not edit'
                            : '')}>
                    {hookTally(graph)}
                </span>
                {/* Named for what it does, and offered only when there is a file
                    to open — a project running the shipped pipeline has none. */}
                {graph.configured && (
                    <button class="builder-action builder-action--quiet" onClick={onOpenConfig}>
                        Open companion.yml
                    </button>
                )}
                <button class="builder-action builder-action--quiet" disabled={busy}
                    onClick={onPreview}>
                    Preview build
                </button>
                {/* "Build" — this runs the project's own build and writes the
                    command files. Claude is who reads them afterwards, not who
                    does this, and naming it here promised a step that never ran. */}
                <button class="builder-action builder-action--primary" disabled={busy}
                    onClick={onBuild}>
                    {busy ? 'Building…' : 'Build'}
                </button>
            </div>

            {/* Nothing said that a change here writes a file, so the first thing
                a project sees is what the board is and what Build does with it.
                Read once per workspace. */}
            {firstRun && (
                <div class="builder-notice builder-notice--info">
                    <StatusIcon tone="info" />
                    <span>
                        This is the pipeline as it ships. Change anything here and Build
                        writes it to <code class="builder-notice-file">companion.yml</code>.
                    </span>
                    {props.onDismissFirstRun && (
                        <button class="builder-link" onClick={props.onDismissFirstRun}>
                            Got it
                        </button>
                    )}
                </div>
            )}

            {notice && (
                <div class={`builder-notice builder-notice--${notice.tone}`}>
                    <StatusIcon tone={notice.tone} />
                    {notice.text}
                </div>
            )}

            {/* A build used to answer in the Output panel, which took the editor
                to say it had worked. It answers here, where it was asked; the
                channel still keeps the whole log. */}
            {report && (
                <div class={`builder-notice builder-report builder-notice--${
                    reportTone(report)}`} role="status">
                    <StatusIcon tone={reportTone(report)} />
                    <span class="builder-report-line">{reportLine(report)}</span>
                    {report.output && (
                        <button class="builder-link" aria-expanded={showingLog}
                            onClick={() => setShowingLog(!showingLog)}>
                            {showingLog ? 'Hide the log'
                                : report.dryRun ? 'Show what changes' : 'Show the log'}
                        </button>
                    )}
                </div>
            )}

            {report && showingLog && (
                <pre class="builder-changes builder-report-log">{report.output}</pre>
            )}

            {graph.warnings.length > 0 && (
                <div class="builder-notice builder-notice--warning">
                    {graph.warnings.map(warning => <div key={warning}>{warning}</div>)}
                </div>
            )}

            {open && (
                <div class="builder-changes">
                    {changes.length === 0 ? null : (
                        <ul class="builder-changes-list">
                            {changes.map(line => <li key={line}>{line}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </header>
    );
}
