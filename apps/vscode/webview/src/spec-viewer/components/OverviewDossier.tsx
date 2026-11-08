import type { ViewerState, ViewerCoverageRow, ViewerVerification } from '../types';
import { formatElapsed, formatAbsolute } from '../relativeTime';
import { LivingSpecLinks, livingSpecChips } from './cards/LivingSpecsCard';
import { coverageState, isTraced } from '../coverageState';
import { STEP_NAMES } from '../../../../src/core/types/specContext';
import { safeUrl } from '../markdown/inline';

/**
 * The Overview's sections, ordered by what a future session needs:
 * Intent → Expectations → Verified → Decisions → Coverage. Each renders only
 * when its data exists; ActivityPanel composes them.
 */

const CONSTRAINT_PREFIX = 'constraint: ';
const AREA_PREFIX = 'area: ';
// The canonical step order, imported rather than restated — this was one of
// three copies that had to be found and edited to add a step.
const PHASE_ORDER: readonly string[] = STEP_NAMES;

function phaseNames(state: ViewerState): string[] {
    const keys = Object.keys(state.stepHistory ?? {});
    const known = PHASE_ORDER.filter(step => keys.includes(step));
    return [...known, ...keys.filter(step => !PHASE_ORDER.includes(step))];
}

function capitalize(phase: string): string {
    return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/** The phase a fold collapsed into: the nearest earlier non-folded phase. */
function foldAnchor(phases: string[], stepHistory: ViewerState['stepHistory'], index: number): string | null {
    for (let i = index - 1; i >= 0; i--) {
        if (stepHistory[phases[i]]?.folded !== true) return phases[i];
    }
    return null;
}

/** Compact lifecycle signal for the top of Overview; task events stay in Run Log. */
export function OverviewTiming({ state }: { state: ViewerState }) {
    const phases = phaseNames(state);
    if (phases.length === 0) return null;
    const round = waitingRound(state.converge);

    const timing = state.timing;
    const complete = timing?.complete === true && timing.elapsedMs !== undefined;
    const summary = complete
        ? `${formatElapsed(timing.elapsedMs!)} active`
        : timing
            ? `Timing coverage: ${timing.measuredPhases} of ${timing.expectedPhases} phases`
            : 'Timing not recorded';

    return (
        <section class="dossier-timing" aria-label="Run timing overview">
            <div class="dossier-timing__head">
                <span class="dossier-kicker">Run overview</span>
                {summary && <strong>{summary}</strong>}
            </div>
            <div class="dossier-timing__phases" role="list">
                {phases.map((phase, index) => {
                    const entry = state.stepHistory[phase];
                    const pill = phase === 'converge' ? convergePill(state.converge) : null;
                    if (pill) {
                        return (
                            <div
                                key={phase}
                                role="listitem"
                                class={`dossier-timing__phase dossier-timing__converge is-${pill.tone}`}
                            >
                                {index > 0 && <span class="dossier-timing__connector" aria-hidden="true" />}
                                <span class="dossier-timing__pill">
                                    <LoopIcon />
                                    <span class="dossier-timing__name">Converge</span>
                                    <span class="dossier-timing__duration">{pill.label}</span>
                                </span>
                            </div>
                        );
                    }
                    const inFlight = entry.completedAt === null;
                    const folded = entry.folded === true;
                    const anchor = folded ? foldAnchor(phases, state.stepHistory, index) : null;
                    const duration = !folded && entry.durationTrusted && entry.completedAt
                        ? formatElapsed(Date.parse(entry.completedAt) - Date.parse(entry.startedAt))
                        : null;
                    return (
                        <div
                            key={phase}
                            role="listitem"
                            class={`dossier-timing__phase${inFlight ? ' is-in-flight' : ''}${folded ? ' is-folded' : ''}`}
                        >
                            {index > 0 && <span class="dossier-timing__connector" aria-hidden="true" />}
                            <span class="dossier-timing__dot" aria-hidden="true" />
                            <span class="dossier-timing__name">{capitalize(phase)}</span>
                            {folded && (
                                <span class="dossier-timing__duration dossier-timing__duration--folded">
                                    {anchor ? `folded into ${capitalize(anchor)}` : 'folded'}
                                </span>
                            )}
                            {duration && <span class="dossier-timing__duration">{duration}</span>}
                        </div>
                    );
                })}
                {round && (
                    <div key="implement-round" role="listitem" class="dossier-timing__phase is-waiting">
                        <span class="dossier-timing__connector" aria-hidden="true" />
                        <span class="dossier-timing__dot" aria-hidden="true" />
                        <span class="dossier-timing__name">Implement</span>
                        <span class="dossier-timing__duration">{round}</span>
                    </div>
                )}
            </div>
        </section>
    );
}

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function LoopIcon() {
    return (
        <svg class="dossier-timing__loop" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M13 8a5 5 0 1 1-1.5-3.6" />
            <path d="M13 2.5v2.5h-2.5" />
        </svg>
    );
}

type Converge = NonNullable<ViewerState['converge']>;

function convergePill(c: ViewerState['converge']): { tone: 'gaps' | 'clean'; label: string } | null {
    if (!c) return null;
    const latest = c.passes[c.passes.length - 1];
    if (c.outcome === 'gaps') {
        const gaps = plural(latest.addedIds.length, 'gap');
        return { tone: 'gaps', label: latest.durationMs !== undefined ? `${formatElapsed(latest.durationMs)} · ${gaps}` : gaps };
    }
    if (c.outcome === 'clean') {
        return { tone: 'clean', label: c.passCount > 1 ? `${c.passCount} passes · clean` : 'clean' };
    }
    return null;
}

/** The implement round converge sent the spec back to, while its added tasks are open. */
function waitingRound(c: ViewerState['converge']): string | null {
    if (!c || c.outcome !== 'gaps' || c.openAdded === 0) return null;
    const round = c.passes.filter(p => p.outcome === 'gaps').length + 1;
    const done = c.addedTasks.length - c.openAdded;
    return done === 0 ? `round ${round}, waiting` : `round ${round}, ${done} of ${c.addedTasks.length}`;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

function addedRange(ids: string[]): string {
    if (ids.length <= 1) return ids[0] ?? '';
    if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
    return `${ids[0]} to ${ids[ids.length - 1]}`;
}

function passLine(p: Converge['passes'][number]): string {
    if (p.outcome === 'gaps') return `${plural(p.addedIds.length, 'gap')}, added as ${addedRange(p.addedIds)}`;
    if (p.outcome === 'clean') return 'nothing added';
    if (p.outcome === 'running') return 'running';
    return 'not recorded';
}

function completedLine(at: string, by: string): string {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return `written by the ${by}`;
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${date} at ${time}, written by the ${by}`;
}

/** What the latest converge pass found: the tasks it added, or a clean finish. */
export function ConvergeCard({ state }: { state: ViewerState }) {
    const c = state.converge;
    if (!c) return null;

    if (c.outcome === 'gaps' && c.addedTasks.length > 0) {
        const n = c.addedTasks.length;
        return (
            <section class="dossier-converge dossier-converge--gaps" aria-label="Converge result">
                <p class="dossier-kicker">{`CONVERGE FOUND ${n} GAP${n === 1 ? '' : 'S'}`}</p>
                <p class="dossier-converge__lead">
                    Converge checked the code against the spec, plan and tasks, and added these to the end of tasks.md. The spec did not change. Implement them, and converge runs again.
                </p>
                <ul class="dossier-converge__tasks">
                    {c.addedTasks.map(t => (
                        <li key={t.id} class={t.checked ? 'is-done' : undefined}>
                            <code>{t.id}</code>
                            <span>{t.title}</span>
                        </li>
                    ))}
                </ul>
            </section>
        );
    }

    if (c.outcome === 'clean' && state.status === 'completed') {
        const which = c.passCount > 1 ? `The ${ORDINALS[c.passCount - 1] ?? 'last'} converge pass` : 'Converge';
        return (
            <section class="dossier-converge dossier-converge--clean" aria-label="Converge result">
                <p class="dossier-kicker">DONE, BY A CLEAN CONVERGE</p>
                <p class="dossier-converge__lead">
                    {`${which} found nothing missing, so the spec is completed.`}
                </p>
                <dl class="dossier-converge__passes">
                    {c.passes.map(p => (
                        <div key={p.index}>
                            <dt>{`PASS ${p.index}`}</dt>
                            <dd>{passLine(p)}</dd>
                        </div>
                    ))}
                    {c.completedBy && (
                        <div>
                            <dt>COMPLETED</dt>
                            <dd>{completedLine(c.completedBy.at, c.completedBy.by)}</dd>
                        </div>
                    )}
                </dl>
            </section>
        );
    }

    return null;
}

function sizingLine(c: NonNullable<ViewerState['classification']>): string {
    const parts: string[] = [];
    if (typeof c.projectedFiles === 'number') parts.push(`${c.projectedFiles} files`);
    if (typeof c.projectedTasks === 'number') parts.push(`${c.projectedTasks} tasks`);
    const inputs = parts.join(', ');
    return inputs ? `Sized ${c.verdict}: ${inputs} projected` : `Sized ${c.verdict}`;
}

/** A ticket URL becomes a link; an id such as TODO-42 stays text. */
function SourceValue({ source }: { source: string }) {
    const url = source.trim();
    if (/^https?:\/\//i.test(url) && safeUrl(url) !== '#') {
        return <a class="dossier-intent__source-link" href={url} title={url}>{url}</a>;
    }
    return <>{source}</>;
}

function SectionHead({ kicker, title, count, tone }: {
    kicker: string;
    title: string;
    count?: string;
    tone?: 'good' | 'warn';
}) {
    return (
        <header class="dossier-section__head">
            <div>
                <p class="dossier-kicker">{kicker}</p>
                <h2 class="dossier-section__title">{title}</h2>
            </div>
            {count && (
                <span class={`dossier-count${tone ? ` dossier-count--${tone}` : ''}`}>{count}</span>
            )}
        </header>
    );
}

export function IntentSection({ state }: { state: ViewerState }) {
    const { intent, request, approach, context, classification, source, supersedes } = state;
    const extendsFolder = state.extends;
    const area = context?.find(item => item.startsWith(AREA_PREFIX))?.slice(AREA_PREFIX.length);
    const livingSpecs = state.livingSpecs;
    const livingSpecsCount = livingSpecs ? livingSpecChips(livingSpecs).length : 0;
    const hasTiming = phaseNames(state).length > 0;
    const lineage = Boolean(source || extendsFolder || supersedes);
    const hasIntentContent = Boolean(intent || request || approach || area || classification || lineage || livingSpecsCount > 0);
    if (!hasIntentContent && !hasTiming) return null;

    return (
        <section class="dossier-intent" aria-label={hasIntentContent ? 'Intent' : 'Run overview'}>
            {hasIntentContent && <p class="dossier-kicker">Intent</p>}
            {intent && <p class="dossier-intent__statement">{intent}</p>}
            {request && (
                <div class="dossier-intent__request-block">
                    <span class="dossier-meta-label">Your request, word for word</span>
                    <p class="dossier-intent__request" tabIndex={0}>{request}</p>
                </div>
            )}
            <OverviewTiming state={state} />
            <ConvergeCard state={state} />
            {(approach || area || classification || lineage || livingSpecsCount > 0) && (
                <div class="dossier-intent__meta">
                    {(approach || (livingSpecs && livingSpecsCount > 0)) && (
                        <div class="dossier-intent__approach">
                            {approach && (
                                <>
                                    <span class="dossier-meta-label">Approach</span>
                                    <p>{approach}</p>
                                </>
                            )}
                            {livingSpecs && livingSpecsCount > 0 && (
                                <div class="dossier-intent__living-specs">
                                    <span class="dossier-meta-label">Living specs</span>
                                    <LivingSpecLinks livingSpecs={livingSpecs} />
                                </div>
                            )}
                        </div>
                    )}
                    {(area || classification || lineage) && (
                        <div class="dossier-intent__context">
                            {source && (
                                <>
                                    <span class="dossier-meta-label">Source</span>
                                    <p><SourceValue source={source} /></p>
                                </>
                            )}
                            {extendsFolder && (
                                <>
                                    <span class="dossier-meta-label">Extends</span>
                                    <p>{extendsFolder}</p>
                                </>
                            )}
                            {supersedes && (
                                <>
                                    <span class="dossier-meta-label">Replaces</span>
                                    <p>{supersedes}</p>
                                </>
                            )}
                            {area && (
                                <>
                                    <span class="dossier-meta-label">Working area</span>
                                    <p>{area}</p>
                                </>
                            )}
                            {classification && (
                                <>
                                    <span class="dossier-meta-label">Size</span>
                                    <p>{sizingLine(classification)}</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

export function ExpectationsSection({ state }: { state: ViewerState }) {
    const constraints = (state.context ?? [])
        .filter(item => item.startsWith(CONSTRAINT_PREFIX))
        .map(item => item.slice(CONSTRAINT_PREFIX.length));
    const outOfScope = state.expectations ?? [];
    if (constraints.length === 0 && outOfScope.length === 0) return null;

    return (
        <section class="dossier-section" aria-label="Expectations">
            <SectionHead
                kicker="Expectations"
                title="The fence around the work"
                count={String(constraints.length + outOfScope.length)}
            />
            <div class="dossier-fence-grid">
                {constraints.length > 0 && (
                    <div class="dossier-fence dossier-fence--scope">
                        <h3>Must stay true</h3>
                        <ul>
                            {constraints.map(item => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                )}
                {outOfScope.length > 0 && (
                    <div class="dossier-fence dossier-fence--out">
                        <h3>Deliberately out of scope</h3>
                        <ul>
                            {outOfScope.map(item => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}

export function VerifiedSection({ state }: { state: ViewerState }) {
    const items = state.verified ?? [];
    const risk = state.risk;
    // A depth line alone would read as verification, so the section waits for a check.
    if (items.length === 0) return null;
    // Derived means something other than the agent produced the outcome. Everything written
    // before that field existed was the agent's own account, so an absent source is a claim
    // rather than an unknown, and rendering the two alike is what let a sentence wear a check.
    const checked = items.filter(v => v.source === 'derived');
    const reported = items.filter(v => v.source !== 'derived');
    const failed = checked.filter(v => v.exitCode !== undefined && v.exitCode !== 0).length;
    const stale = checked.some(v => (v.changedSince ?? 0) > 0);
    const count = reported.length === 0
        ? `${checked.length} checked`
        : `${checked.length} checked · ${reported.length} reported`;
    const raisedBy = risk?.raised && (risk.raised.by === 'ai' || risk.raised.by === 'agent' ? 'the agent' : risk.raised.by);
    const depth = risk && (risk.raised
        ? `Review depth: ${risk.tier} · raised by ${raisedBy}: "${risk.raised.reason}"`
        : `Review depth: ${risk.tier}`);
    const depthLine = risk && (
        <p
            class={`dossier-depth dossier-depth--${risk.tier}`}
            title={risk.reasons.length > 0 ? risk.reasons.join('; ') : undefined}
        >{depth}</p>
    );

    return (
        <section class="dossier-section" aria-label="Verified">
            <SectionHead
                kicker="Verified"
                title="What was checked, and what happened"
                count={count}
                tone={failed > 0 || stale ? 'warn' : checked.length > 0 ? 'good' : undefined}
            />
            {depthLine}
            {checked.length > 0 && <EvidenceRows items={checked} />}
            {reported.length > 0 && (
                <>
                    {checked.length > 0 && (
                        <p class="dossier-evidence__label">Reported — the run's own account</p>
                    )}
                    <EvidenceRows items={reported} />
                </>
            )}
        </section>
    );
}

function EvidenceRows({ items }: { items: ViewerVerification[] }) {
    return (
        <div class="dossier-evidence">
            {items.map((v, i) => {
                const hasWarnings = !!(v.warnings && v.warnings.length > 0);
                const claimed = v.source !== 'derived';
                const mark = hasWarnings ? '⚠' : claimed ? '\u201D' : '✓';
                const changed = !claimed ? v.changedSince ?? 0 : 0;
                const isStale = changed > 0;
                const atLine = !claimed && v.commit
                    ? isStale
                        ? `at ${v.commit}, ${changed} ${changed === 1 ? 'file' : 'files'} changed since`
                        : `at ${v.commit}`
                    : undefined;
                const rowClass = claimed
                    ? 'dossier-evidence__row dossier-evidence__row--claimed'
                    : isStale
                        ? 'dossier-evidence__row dossier-evidence__row--stale'
                        : 'dossier-evidence__row';
                const checkClass = hasWarnings
                    ? 'dossier-check dossier-check--warn'
                    : claimed
                        ? 'dossier-check dossier-check--claimed'
                        : 'dossier-check';
                return (
                    <article class={rowClass} key={i}>
                        <span class={checkClass} aria-hidden="true">{mark}</span>
                        <div class="dossier-evidence__body">
                            <h3>
                                {v.what}
                                {isStale && <span class="dossier-evidence__stale">OUT OF DATE</span>}
                            </h3>
                            {v.result && <p>{v.result}</p>}
                            {hasWarnings && (
                                <p class="dossier-evidence__warnings">{v.warnings!.join('; ')}</p>
                            )}
                            {atLine && <p class="dossier-evidence__at">{atLine}</p>}
                        </div>
                        {v.command && <code>{v.command}</code>}
                    </article>
                );
            })}
        </div>
    );
}

const DECISIONS_SHOWN = 3;

function whoWhen(by?: string, at?: string): string[] {
    const when = at ? formatAbsolute(at) : '';
    return [by, when && when !== 'unknown' ? when : undefined].filter((x): x is string => Boolean(x));
}

function Decision({ d, num }: { d: NonNullable<ViewerState['decisions']>[number]; num: number }) {
    const answered = d.by ? whoWhen(d.by, d.at) : [];
    const heading = <h3>{d.decision}</h3>;
    return (
        <article class="dossier-decision">
            <span class="dossier-decision__num" aria-hidden="true">
                {String(num).padStart(2, '0')}
            </span>
            <div>
                {answered.length > 0 ? (
                    <div class="dossier-decision__head">
                        {heading}
                        <span class="dossier-decision__meta">answered by {answered.join(' · ')}</span>
                    </div>
                ) : heading}
                {d.why && <p><b>Why</b> {d.why}</p>}
                {d.rejected && <p class="dossier-decision__rejected"><b>Rejected</b> {d.rejected}</p>}
                {d.earlier && d.earlier.length > 0 && (
                    <ul class="dossier-decision__earlier">
                        {d.earlier.map((e, i) => (
                            <li key={i}>
                                <s>{e.decision}</s>
                                <span class="dossier-decision__meta">
                                    {['earlier answer', ...whoWhen(e.by, e.at), 'reopened'].join(' · ')}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </article>
    );
}

export function DecisionsSection({ state }: { state: ViewerState }) {
    const items = state.decisions;
    if (!items || items.length === 0) return null;
    const rest = items.slice(DECISIONS_SHOWN);

    return (
        <section class="dossier-section" aria-label="Decisions">
            <SectionHead
                kicker="Decisions"
                title="Choices future work should not have to rediscover"
                count={String(items.length)}
            />
            <div class="dossier-decisions">
                {items.slice(0, DECISIONS_SHOWN).map((d, i) => (
                    <Decision key={i} d={d} num={i + 1} />
                ))}
            </div>
            {rest.length > 0 && (
                <details class="dossier-more">
                    <summary>Show {rest.length} more decision{rest.length === 1 ? '' : 's'}</summary>
                    <div class="dossier-more__body">
                        {rest.map((d, i) => (
                            <Decision key={i} d={d} num={DECISIONS_SHOWN + i + 1} />
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

const COVERAGE_SHOWN = 6;

function CoverageRow({ row }: { row: NonNullable<ViewerState['coverage']>[number] }) {
    return (
        <article class="dossier-coverage__row">
            <div class="dossier-coverage__req">
                <b>{row.req}</b>
                {row.title && <span>{row.title}</span>}
                {row.weak && <span class="dossier-coverage__assumes">tested, but a planted bug passed</span>}
                {row.assumes && <span class="dossier-coverage__assumes">{row.assumes}</span>}
            </div>
            <div class="dossier-coverage__tasks">
                {row.tasks.map(task => <code key={task}>{task}</code>)}
            </div>
            <div class={coverageStateClass(row)}>
                <i aria-hidden="true" /> {coverageStateLabel(row)}
            </div>
        </article>
    );
}

/**
 * Three states, not two. A named test that is not on disk is the case this table
 * used to render exactly like a real one — and it is worse than no test at all,
 * because it reads as coverage that exists.
 */
function coverageStateClass(row: ViewerCoverageRow): string {
    return `dossier-coverage__state is-${{ missing: 'missing', weak: 'weak', tested: 'traced', assumed: 'assumed', untraced: 'untraced' }[coverageState(row)]}`;
}

function coverageStateLabel(row: ViewerCoverageRow): string {
    if (coverageState(row) === 'assumed') { return 'Assumed'; }
    if (coverageState(row) === 'weak') { return 'Weak'; }
    const missing = row.missingTests?.length ?? 0;
    if (missing) {
        return missing === row.tests.length
            ? `${missing} test${missing === 1 ? '' : 's'} not found`
            : `${row.tests.length - missing} of ${row.tests.length} found`;
    }
    return row.tests.length > 0
        ? `${row.tests.length} test${row.tests.length === 1 ? '' : 's'}`
        : 'No test linked';
}

export function CoverageSection({ state }: { state: ViewerState }) {
    const rows = state.coverage;
    if (!rows || rows.length === 0) return null;

    const traced = rows.filter(isTraced).length;
    // The section used to hide itself when nothing was traced, on the reasoning
    // that a bare zero reads as failure when the pipeline simply never mapped
    // tests. But the header strip goes on showing "0 of N traced" two inches
    // above, so the page reported the zero and hid the explanation at once. Zero
    // requirements traced is not an unknown — it is the most important finding
    // the page can carry, so it is stated.
    // Untraced requirements lead — the gaps are the signal.
    const ordered = [
        ...rows.filter(r => coverageState(r) === 'untraced'),
        ...rows.filter(r => coverageState(r) === 'weak'),
        ...rows.filter(r => coverageState(r) === 'assumed'),
        ...rows.filter(r => { const k = coverageState(r); return k === 'tested' || k === 'missing'; }),
    ];
    const rest = ordered.slice(COVERAGE_SHOWN);

    return (
        <section class="dossier-section" aria-label="Coverage">
            <SectionHead
                kicker="Coverage"
                title="Requirement → task → test"
                count={`${traced}/${rows.length} traced`}
                tone={rows.every(r => coverageState(r) === 'tested') ? 'good' : 'warn'}
            />
            <div class="dossier-coverage__head" aria-hidden="true">
                <span>Requirement</span><span>Delivery</span><span>Evidence</span>
            </div>
            <div class="dossier-coverage">
                {ordered.slice(0, COVERAGE_SHOWN).map(row => <CoverageRow key={row.req} row={row} />)}
            </div>
            {rest.length > 0 && (
                <details class="dossier-more">
                    <summary>Show all {rows.length} requirements</summary>
                    <div class="dossier-coverage">
                        {rest.map(row => <CoverageRow key={row.req} row={row} />)}
                    </div>
                </details>
            )}
        </section>
    );
}
