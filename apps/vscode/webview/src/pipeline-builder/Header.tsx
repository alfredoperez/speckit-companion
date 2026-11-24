/**
 * The page-chrome band: what this pipeline is called and which workflow runs.
 *
 * Build lives in the bar at the foot, which appears when there is something to
 * build. Everything else the band offered folds into one menu, and one quiet
 * line says the build is current so the state is never invisible.
 */

import { PipelineBuildKind, PipelineGraph } from '../../../src/protocol/pipeline';
import { changed } from './changes';
import { PipelineTotals, totals } from './counts';
import { Menu, MenuOption } from './Menu';
import { WorkflowMenu } from './WorkflowMenu';

interface Props {
    graph: PipelineGraph;
    buildState: PipelineBuildKind;
    busy: boolean;
    onPreview: () => void;
    onOpenConfig: () => void;
    /** Switch the whole configuration to another saved workflow. */
    onSelectWorkflow: (name: string) => void;
    /** Start a new workflow, seeded from the one in force. */
    onNewWorkflow: () => void;
    /** Append a step to the run. The board's seams pass the step to follow. */
    onNewStep?: () => void;
    /** Open the Spec Kit presets installed here. */
    onOpenPresets?: () => void;
    /** The first-run line has been read. Absent outside the panel. */
    onDismissFirstRun?: () => void;
    /** The workflow was switched to from this panel and has not been built since. */
    selectedNotBuilt?: boolean;
    /** Render the workflow list open, for a story or a capture. */
    workflowsOpen?: boolean;
}

/**
 * The mark a line carries, drawn rather than typed.
 *
 * A glyph takes a font's idea of the shape and none of the semantic hue; these
 * take the tone's colour. Exported because the build bar and the status line
 * say the same three kinds of thing, in the same marks.
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
export function tally(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The one fact about this pipeline you cannot get by looking at it.
 *
 * Counted from the steps the canvas draws, not from `graph.counts`: those two
 * disagreed, and a board showing five hooks was topped by a header saying
 * nothing was attached.
 */
function hookTally(counts: PipelineTotals): string {
    const total = counts.hooks + counts.stockHooks;
    if (total > 0) { return tally(total, 'hook'); }
    // Parked hooks are drawn and do not run, so "no hooks" over a board holding
    // ten of them is the same contradiction this tally was written to end.
    return counts.parked ? 'no hooks running' : 'no hooks';
}

/** The counts, as inert rows: facts, not choices. */
function tallyOptions(counts: PipelineTotals): MenuOption[] {
    const options: MenuOption[] = [{
        id: 'shape',
        disabled: true,
        label: `${tally(counts.steps, 'step')} · ${tally(counts.phases, 'phase')} · `
            + tally(counts.nodes, 'node'),
        note: hookTally(counts),
    }];
    if (counts.hooks) {
        options.push({
            id: 'yours',
            disabled: true,
            label: `${tally(counts.hooks, 'hook')} yours`,
            note: 'Attached by this project',
        });
    }
    if (counts.parked) {
        options.push({
            id: 'parked',
            disabled: true,
            label: `${tally(counts.parked, 'hook')} parked`,
            note: 'Written by this project, kept, and not running while the pipeline '
                + 'is the shipped one',
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

/** The build state when the bar has nothing to say. */
function quietState(state: PipelineBuildKind): string {
    if (state === 'current') { return 'Built, up to date'; }
    if (state === 'unconfigured') { return 'Nothing to build'; }
    return '';
}

export function Header(props: Props) {
    const { graph, buildState, busy, onPreview, onOpenConfig } = props;
    const counts = totals(graph);
    const changedSteps = graph.steps.filter(changed).length;
    const onShipped = graph.workflows.active === 'shipped';
    const parked = onShipped ? graph.workflows.parked : null;
    // Editing a node writes a project file and no configuration at all, so
    // keying on the configuration alone let the panel say a step changed and,
    // one line below, that this is the pipeline as it ships.
    const firstRun = graph.firstRun === true && !graph.configured && changedSteps === 0
        && !onShipped;
    const selected = Boolean(props.selectedNotBuilt) && !busy;
    const quiet = busy || selected ? '' : quietState(buildState);

    return (
        <header class="builder-header">
            <div class="builder-identity">
                <span class="builder-title">Workflow</span>
                <div class={`builder-workflow${selected ? ' builder-workflow--selected' : ''}`}>
                    <WorkflowMenu
                        available={graph.workflows.available}
                        active={graph.workflows.active}
                        buildState={buildState}
                        defaultOpen={props.workflowsOpen}
                        onSelect={props.onSelectWorkflow}
                        onNew={props.onNewWorkflow} />
                </div>
                {selected && (
                    <span class="builder-state builder-state--selected" role="status">
                        <span class="builder-state-dot" aria-hidden="true" />
                        Selected, not built
                    </span>
                )}
                {quiet && (
                    <span class="builder-state">
                        {buildState === 'current' && <StatusIcon tone="done" />}
                        {quiet}
                    </span>
                )}
            </div>

            <div class="builder-overflow">
                <Menu class="builder-action builder-more"
                    trigger="⋯" caret={false} align="right"
                    label="More pipeline actions" title="More"
                    options={[
                        { id: 'step', label: 'Add step' },
                        // Offered only when there is a file to open: a project
                        // running the shipped pipeline has none of its own.
                        ...(graph.configured || onShipped
                            ? [{ id: 'open', label: 'Open companion.yml' }] : []),
                        { id: 'preview', label: 'Preview build', disabled: busy },
                        { id: 'presets', label: 'Spec Kit presets' },
                        ...tallyOptions(counts),
                    ]}
                    onPick={id => {
                        if (id === 'step') { props.onNewStep?.(); }
                        else if (id === 'open') { onOpenConfig(); }
                        else if (id === 'presets') { props.onOpenPresets?.(); }
                        else if (id === 'preview') { onPreview(); }
                    }} />
            </div>

            {/* Running the pipeline as it ships is a choice, and while it is on,
                everything this project wrote is switched off. Both halves of
                that have to be on the page: what is running, and the way back. */}
            {onShipped && (
                <div class="builder-notice builder-notice--warning" role="status">
                    <StatusIcon tone="warning" />
                    <span>
                        Running the pipeline <strong>as it ships</strong>. Nothing in{' '}
                        <code class="builder-notice-file">
                            {parked?.file ?? '.specify/companion.yml'}
                        </code>{' '}
                        is running.{counts.parked
                            ? ` ${tally(counts.parked, 'hook')} of yours ${counts.parked === 1
                                ? 'is' : 'are'} parked on the board, kept exactly as written.`
                            : ''}
                        {parked?.unplaceable
                            ? ` ${tally(parked.unplaceable, 'hook')} ${parked.unplaceable === 1
                                ? 'attaches' : 'attach'} to something the shipped pipeline does`
                                + ' not have, so there is nowhere to draw it.'
                            : ''}
                        {parked?.warnings?.length
                            ? ` ${parked.warnings.length === 1 ? 'One hook' : 'Some hooks'} could`
                                + ' not be resolved at all: ' + parked.warnings.join('; ')
                            : ''}
                    </span>
                    <button class="builder-link"
                        onClick={() => props.onSelectWorkflow('')}>
                        Use this project&rsquo;s pipeline
                    </button>
                </div>
            )}

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

            {graph.warnings.length > 0 && (
                <div class="builder-notice builder-notice--warning">
                    {graph.warnings.map(warning => <div key={warning}>{warning}</div>)}
                </div>
            )}
        </header>
    );
}
