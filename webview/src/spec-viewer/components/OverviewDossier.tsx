import type { ViewerState } from '../types';

/**
 * The Overview as a durable-context dossier, ordered by what a future session
 * needs: Intent (why the spec exists) → Expectations (the fence around the
 * work) → Verified (what was checked) → Decisions (choices not to rediscover)
 * → Coverage (requirement → task → test). Work logs and task records live in
 * a collapsed disclosure below (ActivityPanel composes it). Every section
 * renders only when its data exists.
 */

const CONSTRAINT_PREFIX = 'constraint: ';
const AREA_PREFIX = 'area: ';

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
    if (!intent && !approach && !area) return null;

    return (
        <section class="dossier-intent" aria-label="Intent">
            <p class="dossier-kicker">Durable context · Intent</p>
            {intent && <h2 class="dossier-intent__statement">{intent}</h2>}
            {(approach || area || classification) && (
                <div class="dossier-intent__meta">
                    {approach && (
                        <div>
                            <span class="dossier-meta-label">Approach</span>
                            <p>{approach}</p>
                        </div>
                    )}
                    {(area || classification) && (
                        <div>
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
                    <article class="dossier-decision" key={i}>
                        <span class="dossier-decision__num" aria-hidden="true">
                            {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                            <h3>{d.decision}</h3>
                            {d.why && <p><b>Why</b> {d.why}</p>}
                            {d.rejected && <p class="dossier-decision__rejected"><b>Rejected</b> {d.rejected}</p>}
                        </div>
                    </article>
                ))}
            </div>
            {rest.length > 0 && (
                <details class="dossier-more">
                    <summary>Show {rest.length} more decision{rest.length === 1 ? '' : 's'}</summary>
                    <div class="dossier-more__body">
                        {rest.map((d, i) => (
                            <article class="dossier-decision" key={i}>
                                <span class="dossier-decision__num" aria-hidden="true">
                                    {String(DECISIONS_SHOWN + i + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <h3>{d.decision}</h3>
                                    {d.why && <p><b>Why</b> {d.why}</p>}
                                    {d.rejected && <p class="dossier-decision__rejected"><b>Rejected</b> {d.rejected}</p>}
                                </div>
                            </article>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

const COVERAGE_SHOWN = 6;

export function CoverageSection({ state }: { state: ViewerState }) {
    const rows = state.coverage;
    if (!rows || rows.length === 0) return null;

    const traced = rows.filter(r => r.tests.length > 0).length;
    // Untraced requirements lead — the gaps are the signal.
    const ordered = [...rows.filter(r => r.tests.length === 0), ...rows.filter(r => r.tests.length > 0)];
    const rest = ordered.slice(COVERAGE_SHOWN);

    const Row = ({ row }: { row: NonNullable<ViewerState['coverage']>[number] }) => {
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
    };

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
                {ordered.slice(0, COVERAGE_SHOWN).map(row => <Row key={row.req} row={row} />)}
            </div>
            {rest.length > 0 && (
                <details class="dossier-more">
                    <summary>Show all {rows.length} requirements</summary>
                    <div class="dossier-coverage">
                        {rest.map(row => <Row key={row.req} row={row} />)}
                    </div>
                </details>
            )}
        </section>
    );
}
