import type { ViewerState } from '../types';
import { formatElapsed } from '../relativeTime';
import { LivingSpecLinks, livingSpecChips } from './cards/LivingSpecsCard';

/**
 * The Overview's sections, ordered by what a future session needs:
 * Intent → Expectations → Verified → Decisions → Coverage. Each renders only
 * when its data exists; ActivityPanel composes them.
 */

const CONSTRAINT_PREFIX = 'constraint: ';
const AREA_PREFIX = 'area: ';
const PHASE_ORDER = ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement'];

function phaseNames(state: ViewerState): string[] {
    const keys = Object.keys(state.stepHistory ?? {});
    const known = PHASE_ORDER.filter(step => keys.includes(step));
    return [...known, ...keys.filter(step => !PHASE_ORDER.includes(step))];
}

/** Compact lifecycle signal for the top of Overview; task events stay in Run Log. */
export function OverviewTiming({ state }: { state: ViewerState }) {
    const phases = phaseNames(state);
    if (phases.length === 0) return null;

    const timing = state.timing;
    const complete = timing?.complete === true && timing.elapsedMs !== undefined;
    const summary = complete
        ? `${formatElapsed(timing.elapsedMs!)} elapsed`
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
                    const inFlight = entry.completedAt === null;
                    const duration = entry.durationTrusted && entry.completedAt
                        ? formatElapsed(Date.parse(entry.completedAt) - Date.parse(entry.startedAt))
                        : null;
                    return (
                        <div
                            key={phase}
                            role="listitem"
                            class={`dossier-timing__phase${inFlight ? ' is-in-flight' : ''}`}
                        >
                            {index > 0 && <span class="dossier-timing__connector" aria-hidden="true" />}
                            <span class="dossier-timing__dot" aria-hidden="true" />
                            <span class="dossier-timing__name">
                                {phase.charAt(0).toUpperCase() + phase.slice(1)}
                            </span>
                            {duration && <span class="dossier-timing__duration">{duration}</span>}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function sizingLine(c: NonNullable<ViewerState['classification']>): string {
    const parts: string[] = [];
    if (typeof c.projectedFiles === 'number') parts.push(`${c.projectedFiles} files`);
    if (typeof c.projectedTasks === 'number') parts.push(`${c.projectedTasks} tasks`);
    const inputs = parts.join(', ');
    return inputs ? `Sized ${c.verdict} — ${inputs} projected` : `Sized ${c.verdict}`;
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
    const { intent, approach, context, classification } = state;
    const area = context?.find(item => item.startsWith(AREA_PREFIX))?.slice(AREA_PREFIX.length);
    const livingSpecs = state.livingSpecs;
    const livingSpecsCount = livingSpecs ? livingSpecChips(livingSpecs).length : 0;
    const hasTiming = phaseNames(state).length > 0;
    if (!intent && !approach && !area && !classification && livingSpecsCount === 0 && !hasTiming) return null;

    return (
        <section class="dossier-intent" aria-label="Intent">
            <p class="dossier-kicker">Intent</p>
            {intent && <p class="dossier-intent__statement">{intent}</p>}
            <OverviewTiming state={state} />
            {(approach || area || classification || livingSpecsCount > 0) && (
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
                    {(area || classification) && (
                        <div class="dossier-intent__context">
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
    const items = state.verified;
    if (!items || items.length === 0) return null;
    const warned = items.filter(v => v.warnings && v.warnings.length > 0).length;

    return (
        <section class="dossier-section" aria-label="Verified">
            <SectionHead
                kicker="Verified"
                title="What was checked — and what happened"
                count={warned > 0 ? `${items.length - warned} passed · ${warned} warned` : `${items.length} passed`}
                tone={warned > 0 ? 'warn' : 'good'}
            />
            <div class="dossier-evidence">
                {items.map((v, i) => {
                    const hasWarnings = !!(v.warnings && v.warnings.length > 0);
                    return (
                        <article class="dossier-evidence__row" key={i}>
                            <span class={hasWarnings ? 'dossier-check dossier-check--warn' : 'dossier-check'} aria-hidden="true">
                                {hasWarnings ? '⚠' : '✓'}
                            </span>
                            <div class="dossier-evidence__body">
                                <h3>{v.what}</h3>
                                {v.result && <p>{v.result}</p>}
                                {hasWarnings && (
                                    <p class="dossier-evidence__warnings">{v.warnings!.join('; ')}</p>
                                )}
                            </div>
                            {v.command && <code>{v.command}</code>}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

const DECISIONS_SHOWN = 3;

function Decision({ d, num }: { d: NonNullable<ViewerState['decisions']>[number]; num: number }) {
    return (
        <article class="dossier-decision">
            <span class="dossier-decision__num" aria-hidden="true">
                {String(num).padStart(2, '0')}
            </span>
            <div>
                <h3>{d.decision}</h3>
                {d.why && <p><b>Why</b> {d.why}</p>}
                {d.rejected && <p class="dossier-decision__rejected"><b>Rejected</b> {d.rejected}</p>}
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
    const tested = row.tests.length > 0;
    return (
        <article class="dossier-coverage__row">
            <div class="dossier-coverage__req">
                <b>{row.req}</b>
                {row.title && <span>{row.title}</span>}
            </div>
            <div class="dossier-coverage__tasks">
                {row.tasks.map(task => <code key={task}>{task}</code>)}
            </div>
            <div class={tested ? 'dossier-coverage__state is-traced' : 'dossier-coverage__state is-untraced'}>
                <i aria-hidden="true" /> {tested ? `${row.tests.length} test${row.tests.length === 1 ? '' : 's'}` : 'No test linked'}
            </div>
        </article>
    );
}

export function CoverageSection({ state }: { state: ViewerState }) {
    const rows = state.coverage;
    if (!rows || rows.length === 0) return null;

    const traced = rows.filter(r => r.tests.length > 0).length;
    // Untraced requirements lead — the gaps are the signal.
    const ordered = [...rows.filter(r => r.tests.length === 0), ...rows.filter(r => r.tests.length > 0)];
    const rest = ordered.slice(COVERAGE_SHOWN);

    return (
        <section class="dossier-section" aria-label="Coverage">
            <SectionHead
                kicker="Coverage"
                title="Requirement → task → test"
                count={`${traced}/${rows.length} traced`}
                tone={traced === rows.length ? 'good' : 'warn'}
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
