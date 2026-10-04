/** Direction C, Editorial: the state is the headline, labels sit in the margin, sections part by space. */

import type { ComponentChildren } from 'preact';
import { ANALYSIS_ORIGIN, Inline, Md, StyleShell, analysisChrome, bugChrome, ideaChrome } from './StyleShell';
import type { AnalysisReport, BugStory, IdeaDecision } from './model';

function Opening({ headline, lead, byline, children }: { headline: string; lead: string; byline: string; children?: ComponentChildren }) {
    return (
        <header class="psc-opening">
            <p class="psc-headline">{headline}</p>
            <p class="psc-lead">
                <Inline md={lead} />
            </p>
            {children}
            <p class="psc-byline">{byline}</p>
        </header>
    );
}

function Part({ label, note, children }: { label: string; note?: string; children: ComponentChildren }) {
    return (
        <section class="psc-part">
            <div class="psc-part__label">
                <h2>{label}</h2>
                {note && <p>{note}</p>}
            </div>
            <div class="psc-part__body">{children}</div>
        </section>
    );
}

function Next({ children }: { children: ComponentChildren }) {
    return (
        <section class="psc-part psc-next">
            <div class="psc-part__label">
                <h2>Next</h2>
            </div>
            <div class="psc-part__body">{children}</div>
        </section>
    );
}

export function BugC({ bug }: { bug: BugStory }) {
    return (
        <StyleShell chrome={bugChrome(bug)} direction="c">
            <Opening
                headline="Fixed. Not tested yet."
                lead={bug.fixLead}
                byline={`Reported ${bug.created} from ${bug.source} · ${bug.verdict} bug, ${bug.severity} severity`}
            >
                <ol class="psc-track" aria-label="Steps">
                    <li class="is-done">
                        Assess <span>{bug.verdict}</span>
                    </li>
                    <li class="is-done">
                        Fix <span>{bug.fixStatus}</span>
                    </li>
                    <li class="is-next">
                        Test <span>not run</span>
                    </li>
                </ol>
            </Opening>

            <Part label="What was wrong" note={`Assessed ${bug.created}`}>
                <Md md={bug.symptom} class="psc-first" />
                <Md md={bug.rootCause} />
                <p class="psc-fine">
                    Confidence {bug.confidence}: {bug.confidenceWhy}.
                </p>
            </Part>

            <Part label="What changed" note={`Fixed ${bug.fixed}`}>
                <Md md={bug.fixSummary} class="psc-first" />
                <ul class="psc-files">
                    {bug.changes.map((c) => (
                        <li key={c.file}>
                            <Inline md={c.file} />
                            <span>
                                <Inline md={c.note} />
                            </span>
                        </li>
                    ))}
                </ul>
                <Md md={bug.diff} />
            </Part>

            <Part label="Still open" note={`${bug.risks.length} risks, ${bug.questions.length} question`}>
                {bug.questions.map((q) => (
                    <p key={q} class="psc-first">
                        <Inline md={q} />
                    </p>
                ))}
                <ul class="psc-plain">
                    {bug.risks.map((r) => (
                        <li key={r}>
                            <Inline md={r} />
                        </li>
                    ))}
                </ul>
            </Part>

            <Next>
                <p>
                    Nothing has verified the fix yet. <strong>Test fix</strong> sends <Inline md={`\`${bug.testCommand}\``} /> and the assistant writes{' '}
                    <Inline md="`test.md`" /> with each check and its result.
                </p>
            </Next>
        </StyleShell>
    );
}

export function AnalysisC({ report }: { report: AnalysisReport }) {
    return (
        <StyleShell chrome={analysisChrome(report)} direction="c">
            <Opening
                headline={report.headline}
                lead={report.lead}
                byline={`${report.findings.length} findings · ${report.covered} of ${report.total} requirements have tasks · saved as ${ANALYSIS_ORIGIN}`}
            />

            {report.groups.map((g) => (
                <Part key={g.severity} label={`${g.severity.replace(/^./, (c) => c.toUpperCase())} findings`} note={`${g.rows.length}`}>
                    <ol class={`psc-findings psc-findings--${g.tone}`}>
                        {g.rows.map((f) => (
                            <li key={f.id}>
                                <p class="psc-finding__tag">
                                    <span>{f.id}</span> {f.category}
                                </p>
                                <p class="psc-finding__what">
                                    <Inline md={f.summary} />
                                </p>
                                <p class="psc-finding__fix">
                                    <span class="ps-label">Recommended.</span> <Inline md={f.recommendation} />
                                </p>
                                <p class="psc-fine">{f.location}</p>
                            </li>
                        ))}
                    </ol>
                </Part>
            ))}

            {report.notes.map((n) => (
                <Part key={n.label} label={n.label}>
                    <Md md={n.md} />
                </Part>
            ))}

            <Next>
                <Md md={report.next} />
            </Next>
        </StyleShell>
    );
}

export function IdeaC({ idea }: { idea: IdeaDecision }) {
    const [first, ...rest] = idea.rationale.split(/(?<=\.)\s+/);
    return (
        <StyleShell chrome={ideaChrome(idea)} direction="c">
            <Opening headline="Go." lead={first} byline={`Decided ${idea.decided} · reviewed ${idea.artifacts.join(', ')}`} />

            <Part label="Why">
                <Md md={rest.join(' ')} class="psc-first" />
            </Part>

            <Part label="Scorecard" note={idea.tally.map((t) => `${t.count} ${t.rating}`).join(', ')}>
                <ul class="psc-score">
                    {idea.scorecard.map((s) => (
                        <li key={s.criterion}>
                            <span class="psc-score__name">{s.criterion}</span>
                            <span class={`psc-score__rating ps-tone--${s.tone}`}>{s.rating}</span>
                            <span class="psc-score__why">
                                <Inline md={s.why} />
                            </span>
                        </li>
                    ))}
                </ul>
            </Part>

            <Part label="Handoff" note="to /speckit-specify">
                <dl class="psc-handoff">
                    {idea.handoff.map((field) => (
                        <div key={field.label}>
                            <dt>{field.label}</dt>
                            <dd>
                                <Md md={field.value} />
                            </dd>
                        </div>
                    ))}
                </dl>
            </Part>

            <Next>
                <p>
                    <strong>Create spec from this idea</strong> opens Create Spec with this handoff filled in.
                </p>
            </Next>
        </StyleShell>
    );
}
