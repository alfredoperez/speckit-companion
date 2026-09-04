/**
 * The page-chrome band: what this pipeline is, whether it needs rebuilding, and
 * the one forward action.
 *
 * The divergence chip is a mark that navigates. It used to print the same list
 * the board already draws, one lane per line, so the panel said everything
 * twice; now it says how much changed and takes you to the first of it.
 */

import { useState } from 'preact/hooks';
import { BuildReport, PipelineBuildKind, PipelineGraph } from '../../../src/protocol/pipeline';
import { changed } from './changes';
import { PipelineTotals, totals } from './counts';
import { Menu, MenuOption } from './Menu';

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
    /** Append a step to the run. The board's seams pass the step to follow. */
    onNewStep?: () => void;
    /** Take the reader to a changed lane. The DOM lookup belongs to the panel. */
    onShowChanged?: (step: string) => void;
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
 * Hooks sit at boundaries scattered down five lanes, so they are the thing you
 * genuinely cannot total by eye. Everything else the panel knows about itself —
 * steps, phases, nodes, whose hooks these are — was a native `title` on a line
 * of grey mono text, which is to say it was unfindable. It is a chip that opens
 * now, and this is what the closed chip says.
 *
 * Counted from the steps the canvas draws, not from `graph.counts`: those two
 * disagreed, and a board showing five hooks was topped by a header saying
 * nothing was attached.
 */
function hookTally(counts: PipelineTotals): string {
    const total = counts.hooks + counts.stockHooks;
    return total === 0 ? 'no hooks' : tally(total, 'hook');
}

/**
 * What the tally chip opens onto — the counts, each one a line of its own.
 *
 * Every line is `disabled`, which is what makes them read as facts: a menu of
 * three focusable rows that close the sheet and do nothing is the same
 * fires-and-changes-nothing control this round took out elsewhere.
 */
function tallyOptions(counts: PipelineTotals): MenuOption[] {
    const options: MenuOption[] = [{
        id: 'shape',
        disabled: true,
        label: `${tally(counts.steps, 'step')} · ${tally(counts.phases, 'phase')} · `
            + tally(counts.nodes, 'node'),
    }];
    if (counts.hooks) {
        options.push({
            id: 'yours',
            disabled: true,
            label: `${tally(counts.hooks, 'hook')} yours`,
            note: 'Attached by this project',
        });
    }
    if (counts.stockHooks) {
        options.push({
            id: 'extensions',
            disabled: true,
            label: `${tally(counts.stockHooks, 'hook')} from extensions`,
            note: 'Registered by installed spec-kit extensions, which this panel '
                + 'shows but does not edit',
        });
    }
    return options;
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

export function Header(props: Props) {
    const { graph, buildState, busy, report, onBuild, onPreview, onOpenConfig } = props;
    const counts = totals(graph);
    const [showingLog, setShowingLog] = useState(false);
    const changedSteps = graph.steps.filter(changed).length;
    const firstChanged = graph.steps.find(changed)?.name ?? '';
    const differs = changedSteps === 1
        ? '1 step differs from shipped'
        : `${changedSteps} steps differ from shipped`;
    // On a fresh project a filled, disabled Build was the loudest thing on
    // screen, over the first-run line that is the actual entry point. It takes
    // the fill when there is work in it and stays outlined otherwise.
    const somethingToBuild = changedSteps > 0
        || buildState === 'stale' || buildState === 'never-built';
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
            </div>

            {/* The band people already read, so the two marks and the way in
                sit here rather than out at the right edge with the actions. */}
            <div class="builder-tools">
                {/* Nothing changed is a whole fact, so it states it and stops.
                    Something changed is a place on the board, so the chip goes
                    there — a `›` rather than a `▾`, because it moves you.

                    It says "differs from shipped" rather than "changed": the
                    stale-build notice two lines below also says "changed", and
                    meant something else entirely by it. */}
                {changedSteps === 0 ? (
                    <span class="builder-chip builder-chip--flat">No changes</span>
                ) : (
                    <button class="builder-chip builder-chip--customised"
                        title={`Go to ${firstChanged}`}
                        aria-label={`${differs} — go to ${firstChanged}`}
                        onClick={() => props.onShowChanged?.(firstChanged)}
                    >
                        {differs}
                        <span class="builder-chip-caret" aria-hidden="true">›</span>
                    </button>
                )}

                <Menu
                    class="builder-chip builder-tally"
                    trigger={hookTally(counts)}
                    label={`What this pipeline holds: ${hookTally(counts)}`}
                    title="What this pipeline holds"
                    options={tallyOptions(counts)}
                    onPick={() => undefined} />

                {/* A run grows at its end, so the way to grow it belongs in the
                    band that names the run. It was parked past the last lane,
                    behind a horizontal scroll. */}
                <button class="builder-action builder-action--add"
                    onClick={() => props.onNewStep?.()}>
                    + Add step
                </button>
            </div>

            <div class="builder-facts">
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
                <button class={`builder-action${
                    somethingToBuild ? ' builder-action--primary' : ''}`}
                    disabled={busy} onClick={onBuild}>
                    {busy ? 'Building…' : 'Build'}
                </button>
                {/* Narrow only. Row one keeps the name, the workflow and the
                    forward action; row two holds the two chips, which at this
                    width is all it holds — so `+ Add step` folds in here with
                    the two quiet actions rather than taking a third row. */}
                <div class="builder-overflow">
                    <Menu class="builder-action"
                        trigger="⋯" caret={false} align="right"
                        label="More pipeline actions" title="More"
                        options={[
                            { id: 'step', label: 'Add step' },
                            ...(graph.configured
                                ? [{ id: 'open', label: 'Open companion.yml' }] : []),
                            { id: 'preview', label: 'Preview build', disabled: busy },
                        ]}
                        onPick={id => {
                            if (id === 'step') { props.onNewStep?.(); }
                            else if (id === 'open') { onOpenConfig(); }
                            else { onPreview(); }
                        }} />
                </div>
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
        </header>
    );
}
