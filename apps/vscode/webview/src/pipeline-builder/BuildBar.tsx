/**
 * The bar at the foot of the panel that carries Build.
 *
 * It appears only when there is something to build, says what is waiting, and
 * opens upward into the list of it. After a build it says so briefly and goes;
 * a build that failed stays, saying nothing was written.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
    BuildReport, PipelineBuildKind, PipelineGraph, PipelineHook, PipelineStatus,
    needsBuild,
} from '../../../src/protocol/pipeline';
import { changeSummary, changed } from './changes';
import { StatusIcon, tally } from './Header';
import { HookIcon } from './HookIcon';

/** How long the built confirmation stays before it leaves. */
const BUILT_FOR = 4000;

/** Reports already seen off. The bar unmounts while a sheet is open, so its own state cannot hold this. */
const seenOff = new WeakSet<BuildReport>();

interface Props {
    graph: PipelineGraph;
    buildState: PipelineBuildKind;
    busy: boolean;
    report: BuildReport | null;
    /** What the last write did, said here while the bar is up. */
    status: PipelineStatus | null;
    onBuild: () => void;
    onPreview: () => void;
    onUndo: (token: string) => void;
    onDismissStatus: () => void;
    onEditHook: (step: string, hook: PipelineHook) => void;
    onRemoveHook: (step: string, hook: PipelineHook) => void;
    onShowStep: (step: string) => void;
}

export interface ProblemHook { step: string; hook: PipelineHook }

/** Every hook that will do nothing in a run, once each. */
export function problemHooks(graph: PipelineGraph): ProblemHook[] {
    const seen = new Set<string>();
    const found: ProblemHook[] = [];
    for (const step of graph.steps) {
        const hooks = [
            ...step.hooks,
            ...step.phases.flatMap(p => [...p.hooks, ...p.nodes.flatMap(n => n.hooks)]),
        ];
        for (const hook of hooks) {
            const key = `${step.name}/${hook.when}/${hook.anchor}/${hook.index}`;
            if (!hook.problem || seen.has(key)) { continue; }
            seen.add(key);
            found.push({ step: step.name, hook });
        }
    }
    return found;
}

/** `a`, `a and b`, `a, b and c` — a list read the way it would be said. */
function readList(names: string[]): string {
    if (names.length < 2) { return names.join(''); }
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function waitingHeadline(state: PipelineBuildKind): string {
    return state === 'never-built' ? 'Never built' : 'The build is out of date';
}

/** Which commands a preview says the build rewrites. */
function previewLine(report: BuildReport): string {
    if (report.changed.length === 0) {
        return `Nothing would change in ${tally(report.commands, 'command')}.`;
    }
    const others = report.commands - report.changed.length;
    return `Rewrites the ${readList(report.changed)} ${
        report.changed.length === 1 ? 'command' : 'commands'}.${
        others > 0 ? ` ${tally(others, 'other')} ${others === 1 ? 'stays' : 'stay'} as ${
            others === 1 ? 'it is' : 'they are'}.` : ''}`;
}

export function BuildBar(props: Props) {
    const { graph, buildState, busy, report, status } = props;
    const [open, setOpen] = useState(false);
    const [showingLog, setShowingLog] = useState(false);
    // The report the person has seen off: a built line that timed out, a
    // preview they hid. A new report is a new object, so it shows again.
    const [, setGoneCount] = useState(0);
    const setGone = (seen: BuildReport | null) => {
        if (seen) { seenOff.add(seen); }
        setGoneCount(count => count + 1);
    };
    const [checking, setChecking] = useState(false);
    const toggle = useRef<HTMLButtonElement>(null);

    const built = report?.ok === true && !report.dryRun ? report : null;
    useEffect(() => {
        if (!built || seenOff.has(built)) { return; }
        const timer = setTimeout(() => setGone(built), BUILT_FOR);
        return () => clearTimeout(timer);
    }, [built]);
    useEffect(() => { if (!busy) { setChecking(false); } }, [busy]);

    const waiting = needsBuild(buildState);
    const failed = report && !report.ok ? report : null;
    const preview = report?.ok && report.dryRun ? report : null;
    const live = report && !seenOff.has(report) ? report : null;

    if (built && live && !waiting) {
        return (
            <div class="builder-bar builder-bar--built" role="status">
                <StatusIcon tone="done" />
                <span><strong>Built</strong>{' '}
                    <span class="builder-bar-quiet">
                        · {tally(built.commands, 'command file')} written, matches companion.yml
                    </span>
                </span>
            </div>
        );
    }

    if (!waiting && !(failed && live) && !(preview && live)) { return null; }

    const changedSteps = graph.steps.filter(changed);
    const problems = problemHooks(graph);
    const warnings = (report?.warnings ?? []).filter(warning =>
        !problems.some(p => p.hook.problem && warning.includes(p.hook.problem)));

    const setReview = (next: boolean) => {
        setOpen(next);
        // A failure's reason is in its log, so the log opens with the review.
        if (next && failed) { setShowingLog(true); }
        if (next && !preview && !busy && waiting) {
            setChecking(true);
            props.onPreview();
        }
    };

    let headline: string;
    let detail: string;
    if (failed) {
        headline = failed.dryRun ? 'The preview failed' : 'Not built. Nothing was written.';
        detail = failed.warnings?.[0]
            ?? (failed.dryRun ? 'The configuration could not be read.'
                : `The build failed at ${failed.at}.`);
    } else if (waiting) {
        headline = waitingHeadline(buildState);
        detail = problems.length
            ? `${tally(problems.length, 'hook')} will do nothing. Review before you build.`
            : buildState === 'never-built'
                ? 'The assistant still reads the shipped commands'
                : 'The assistant still reads the old commands';
    } else {
        headline = 'Preview';
        detail = previewLine(preview!);
    }

    const building = busy && !checking;
    const listId = 'builder-bar-review';
    const hasLog = Boolean(report?.output);

    return (
        <section class={`builder-bar${failed ? ' builder-bar--failed' : ''}${
            open ? ' builder-bar--open' : ''}`}
            aria-label="Build"
            onKeyDown={event => {
                if (event.key === 'Escape' && open) {
                    event.stopPropagation();
                    setOpen(false);
                    toggle.current?.focus();
                }
            }}>
            {open && (
                <div class="builder-bar-review" id={listId}>
                    <h2 class="sr-only">What the build would change</h2>
                    <ul class="builder-bar-list">
                        {status && (
                            <li class="builder-bar-row">
                                <StatusIcon tone={status.tone} />
                                <span class="builder-bar-text">{status.text}</span>
                                {status.undo && (
                                    <button class="builder-bar-link"
                                        onClick={() => props.onUndo(status.undo!.token)}>
                                        {status.undo.label ?? 'Undo'}
                                    </button>
                                )}
                            </li>
                        )}
                        {problems.map(({ step, hook }) => (
                            <li class="builder-bar-row builder-bar-row--problem"
                                key={`${step}/${hook.when}/${hook.anchor}/${hook.index}`}>
                                <div class="builder-bar-row-head">
                                    <HookIcon type={hook.type} />
                                    <span class="builder-bar-text">
                                        <strong>{hook.summary}</strong>{' '}
                                        <span class="builder-bar-quiet">
                                            {hook.when} {hook.anchor} · {step}
                                        </span>
                                    </span>
                                </div>
                                <div class="builder-bar-problem">
                                    <StatusIcon tone="warning" />
                                    <span class="builder-bar-text">{hook.problem}</span>
                                    <button class="builder-action"
                                        onClick={() => props.onEditHook(step, hook)}>
                                        Edit hook
                                    </button>
                                    <button class="builder-action builder-action--quiet"
                                        onClick={() => props.onRemoveHook(step, hook)}>
                                        Remove hook
                                    </button>
                                </div>
                            </li>
                        ))}
                        {warnings.map(warning => (
                            <li class="builder-bar-row" key={warning}>
                                <StatusIcon tone="warning" />
                                <span class="builder-bar-text">{warning}</span>
                            </li>
                        ))}
                        {changedSteps.length > 0 && (
                            <li class="builder-bar-row builder-bar-row--label">
                                <span class="builder-bar-text builder-bar-quiet">
                                    Differs from what Companion ships
                                </span>
                            </li>
                        )}
                        {changedSteps.map(step => (
                            <li class="builder-bar-row" key={step.name}>
                                <span class="builder-bar-text">
                                    <strong>{step.name}</strong>{' '}
                                    <span class="builder-bar-quiet">
                                        {changeSummary(step).join(' · ')}
                                    </span>
                                </span>
                                <button class="builder-bar-link"
                                    aria-label={`Show ${step.name} on the board`}
                                    onClick={() => props.onShowStep(step.name)}>
                                    Show
                                </button>
                            </li>
                        ))}
                        <li class="builder-bar-row builder-bar-row--files">
                            <span class="builder-bar-text builder-bar-quiet">
                                {preview ? previewLine(preview)
                                    : checking ? 'Checking which commands change…'
                                        : 'Preview the build to see which commands change.'}
                            </span>
                            {hasLog && (
                                <button class="builder-bar-link" aria-expanded={showingLog}
                                    onClick={() => setShowingLog(!showingLog)}>
                                    {showingLog ? 'Hide the log' : 'Show the log'}
                                </button>
                            )}
                        </li>
                    </ul>
                    {hasLog && showingLog && (
                        <pre class="builder-report-log">{report!.output}</pre>
                    )}
                </div>
            )}

            {!open && status && (
                <div class="builder-bar-status">
                    <StatusIcon tone={status.tone} />
                    <span class="builder-bar-text">{status.text}</span>
                    {status.undo && (
                        <button class="builder-bar-link"
                            onClick={() => props.onUndo(status.undo!.token)}>
                            {status.undo.label ?? 'Undo'}
                        </button>
                    )}
                    <button class="builder-bar-close" aria-label="Dismiss"
                        title="Dismiss" onClick={props.onDismissStatus}>×</button>
                </div>
            )}

            <div class="builder-bar-main">
                {failed && <StatusIcon tone="warning" />}
                <div class="builder-bar-says" role="status">
                    <span class="builder-bar-headline">{headline}</span>
                    <span class="builder-bar-detail">{detail}</span>
                </div>
                <div class="builder-bar-actions">
                    <button class="builder-action" ref={toggle}
                        aria-expanded={open} aria-controls={open ? listId : undefined}
                        onClick={() => setReview(!open)}>
                        {open ? 'Hide' : 'Review'}
                    </button>
                    {(waiting || failed) && (
                        <button class="builder-action builder-action--primary"
                            disabled={busy} onClick={props.onBuild}>
                            {building ? 'Building…' : failed ? 'Try again' : 'Build'}
                        </button>
                    )}
                    {!waiting && !failed && (
                        <button class="builder-action builder-action--quiet"
                            onClick={() => { setOpen(false); setGone(report); }}>
                            Close
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
