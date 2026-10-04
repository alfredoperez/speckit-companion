/** Direction A, Document: one reading column, prose first, a quiet timeline down the left edge. */

import type { ComponentChildren } from 'preact';
import { ANALYSIS_ORIGIN, Inline, Md, StyleShell, analysisChrome, bugChrome, ideaChrome } from './StyleShell';
import type { AnalysisReport, BugStory, IdeaDecision } from './model';

function Step({ state, id, title, when, children }: { state: 'done' | 'next'; id: string; title: string; when: string; children: ComponentChildren }) {
    return (
        <li class={`psa-step psa-step--${state}`}>
            <span class="psa-step__mark" aria-hidden="true" />
            <p class="psa-step__when">{when}</p>
            <h2 id={id}>{title}</h2>
            {children}
        </li>
    );
}

export function BugA({ bug }: { bug: BugStory }) {
    return (
        <StyleShell chrome={bugChrome(bug)} direction="a" toc>
            <p class="psa-lead">
                <strong>Fixed, not tested yet.</strong> <Inline md={bug.fixLead} />
            </p>
            <p class="psa-meta">
                Reported {bug.created} from {bug.source} · assessed {bug.verdict}, {bug.severity} severity · fix {bug.fixStatus} {bug.fixed}
            </p>

            <ol class="psa-line">
                <Step state="done" id="what-was-wrong" title="What was wrong" when={`Assess · ${bug.created}`}>
                    <Md md={bug.symptom} />
                    <Md md={bug.rootCause} />
                    <p class="psa-aside">
                        Confidence {bug.confidence}: {bug.confidenceWhy}.
                    </p>
                </Step>
                <Step state="done" id="what-changed" title="What changed" when={`Fix · ${bug.fixed}`}>
                    <Md md={bug.fixSummary} />
                    <ul class="psa-rows">
                        {bug.changes.map((c) => (
                            <li key={c.file}>
                                <span class="psa-rows__key">
                                    <Inline md={c.file} />
                                </span>
                                <span class="psa-rows__value">
                                    <Inline md={c.note} />
                                </span>
                                <span class="psa-rows__note">{c.change}</span>
                            </li>
                        ))}
                    </ul>
                    <Md md={bug.diff} />
                </Step>
                <Step state="next" id="how-it-was-verified" title="How it was verified" when="Test · not run">
                    <p>
                        It has not been verified yet. <strong>Test fix</strong> sends <Inline md={`\`${bug.testCommand}\``} /> and the assistant writes{' '}
                        <Inline md="`test.md`" /> with each check and its result.
                    </p>
                </Step>
            </ol>

            <h2 id="risks-and-open-questions">Risks and open questions</h2>
            <ul>
                {bug.risks.map((r) => (
                    <li key={r}>
                        <Inline md={r} />
                    </li>
                ))}
                {bug.questions.map((q) => (
                    <li key={q}>
                        <strong>Open question.</strong> <Inline md={q} />
                    </li>
                ))}
            </ul>
        </StyleShell>
    );
}

export function AnalysisA({ report }: { report: AnalysisReport }) {
    return (
        <StyleShell chrome={analysisChrome(report)} direction="a" toc>
            <p class="psa-lead">
                <strong>{report.headline}</strong> <Inline md={report.lead} />
            </p>
            <p class="psa-meta">
                {report.findings.length} findings: {report.groups.map((g) => `${g.rows.length} ${g.severity}`).join(', ')} · {report.covered} of {report.total}{' '}
                requirements have tasks · saved as {ANALYSIS_ORIGIN}
            </p>

            {report.groups.flatMap((g) => [
                <h2 key={`${g.severity}-h`} id={`${g.severity}-findings`}>
                    {g.severity.replace(/^./, (c) => c.toUpperCase())} findings
                </h2>,
                <ol key={g.severity} class="psa-findings">
                        {g.rows.map((f) => (
                            <li key={f.id} class={`psa-finding psa-finding--${g.tone}`}>
                                <span class="psa-finding__id">{f.id}</span>
                                <div>
                                    <p>
                                        <Inline md={f.summary} />
                                    </p>
                                    <p class="psa-finding__fix">
                                        <span class="ps-label">Recommended.</span> <Inline md={f.recommendation} />
                                    </p>
                                    <p class="psa-aside">
                                        {f.category} · {f.location}
                                    </p>
                                </div>
                            </li>
                        ))}
                </ol>,
            ])}

            <h2 id="coverage-and-checks">Coverage and checks</h2>
            <dl class="psa-defs">
                {report.notes.map((n) => (
                    <div key={n.label}>
                        <dt>{n.label}</dt>
                        <dd>
                            <Md md={n.md} />
                        </dd>
                    </div>
                ))}
            </dl>

            <h2 id="next">Next</h2>
            <Md md={report.next} />
        </StyleShell>
    );
}

export function IdeaA({ idea }: { idea: IdeaDecision }) {
    const [first, ...rest] = idea.rationale.split(/(?<=\.)\s+/);
    return (
        <StyleShell chrome={ideaChrome(idea)} direction="a" toc>
            <p class="psa-lead">
                <strong>Go.</strong> <Inline md={first} />
            </p>
            <p class="psa-meta">
                Decided {idea.decided} · reviewed {idea.artifacts.join(', ')}
            </p>
            <Md md={rest.join(' ')} />

            <h2 id="scorecard">Scorecard</h2>
            <p class="psa-meta psa-meta--under">{idea.tally.map((t) => `${t.count} ${t.rating}`).join(', ')}</p>
            <ul class="psa-score">
                {idea.scorecard.map((s) => (
                    <li key={s.criterion}>
                        <span class="psa-score__name">{s.criterion}</span>
                        <span class={`psa-score__rating ps-tone--${s.tone}`}>{s.rating}</span>
                        <span class="psa-score__why">
                            <Inline md={s.why} />
                        </span>
                    </li>
                ))}
            </ul>

            <h2 id="handoff">Handoff to /speckit-specify</h2>
            <dl class="psa-defs">
                {idea.handoff.map((field) => (
                    <div key={field.label}>
                        <dt>{field.label}</dt>
                        <dd>
                            <Md md={field.value} />
                        </dd>
                    </div>
                ))}
            </dl>
        </StyleShell>
    );
}
