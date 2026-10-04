/** Direction B, Record: dense and IDE-native. Property rows, tables and hairlines; colour only on state. */

import type { ComponentChildren } from 'preact';
import { ANALYSIS_ORIGIN, Inline, Md, StyleShell, analysisChrome, bugChrome, ideaChrome } from './StyleShell';
import type { AnalysisReport, BugStory, IdeaDecision, Tone } from './model';

const GLYPH: Record<Tone, string> = { success: 'pass', warning: 'warning', error: 'error', info: 'info', neutral: 'circle-large-outline' };

function State({ tone, glyph, children }: { tone: Tone; glyph?: string; children: ComponentChildren }) {
    return (
        <span class={`psb-state ps-tone--${tone}`}>
            <span class={`codicon codicon-${glyph ?? GLYPH[tone]}`} aria-hidden="true" />
            {children}
        </span>
    );
}

function Props({ rows }: { rows: Array<[string, ComponentChildren]> }) {
    return (
        <dl class="psb-props">
            {rows.map(([key, value]) => (
                <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function Block({ title, meta, children }: { title: string; meta?: string; children: ComponentChildren }) {
    return (
        <section class="psb-block">
            <header class="psb-block__head">
                <h2>{title}</h2>
                {meta && <span>{meta}</span>}
            </header>
            {children}
        </section>
    );
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
    return (
        <dl class="psb-rows">
            {rows.map(([key, md]) => (
                <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                        <Md md={md} />
                    </dd>
                </div>
            ))}
        </dl>
    );
}

export function BugB({ bug }: { bug: BugStory }) {
    return (
        <StyleShell chrome={bugChrome(bug)} direction="b">
            <p class="psb-status">
                <strong>Fixed, not tested yet.</strong> <Inline md={bug.fixLead} />
            </p>
            <Props
                rows={[
                    ['Verdict', <State tone="success">{bug.verdict}</State>],
                    ['Severity', <State tone="error">{bug.severity}</State>],
                    ['Confidence', bug.confidence],
                    ['Location', <Inline md={bug.where} />],
                    ['Reported', `${bug.created}, ${bug.source}`],
                    ['Folder', bug.path],
                ]}
            />

            <Block title="Steps" meta="2 of 3 done">
                <table class="psb-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>State</th>
                            <th>When</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="psb-strong">Assess</td>
                            <td>
                                <State tone="success">{bug.verdict}</State>
                            </td>
                            <td class="psb-mono">{bug.created}</td>
                            <td>
                                <Inline md={bug.rootCause.split(/(?<=\.)\s+/)[0]} />
                            </td>
                        </tr>
                        <tr>
                            <td class="psb-strong">Fix</td>
                            <td>
                                <State tone="success">{bug.fixStatus}</State>
                            </td>
                            <td class="psb-mono">{bug.fixed}</td>
                            <td>{bug.changes.length} files changed, local tests pass.</td>
                        </tr>
                        <tr class="psb-pending">
                            <td class="psb-strong">Test</td>
                            <td>
                                <State tone="neutral">not run</State>
                            </td>
                            <td class="psb-mono">–</td>
                            <td>
                                <Inline md={`Test fix sends \`${bug.testCommand}\` and writes \`test.md\`.`} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </Block>

            <Block title="Cause">
                <Rows
                    rows={[
                        ['Symptom', bug.symptom],
                        ['Root cause', bug.rootCause],
                        ['Evidence', `Confidence ${bug.confidence}: ${bug.confidenceWhy}.`],
                    ]}
                />
            </Block>

            <Block title="Changes" meta={`${bug.changes.length} files`}>
                <table class="psb-table">
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Change</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bug.changes.map((c) => (
                            <tr key={c.file}>
                                <td>
                                    <Inline md={c.file} />
                                </td>
                                <td class="psb-mono">{c.change}</td>
                                <td>
                                    <Inline md={c.note} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Md md={bug.diff} class="psb-code" />
            </Block>

            <Block title="Open" meta={`${bug.risks.length} risks, ${bug.questions.length} question`}>
                <table class="psb-table psb-table--open">
                    <tbody>
                        {bug.risks.map((r) => (
                            <tr key={r}>
                                <td>
                                    <State tone="warning">risk</State>
                                </td>
                                <td>
                                    <Inline md={r} />
                                </td>
                            </tr>
                        ))}
                        {bug.questions.map((q) => (
                            <tr key={q}>
                                <td>
                                    <span class="psb-state ps-tone--info">
                                        <span class="codicon codicon-question" aria-hidden="true" />
                                        question
                                    </span>
                                </td>
                                <td>
                                    <Inline md={q} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Block>
        </StyleShell>
    );
}

export function AnalysisB({ report }: { report: AnalysisReport }) {
    const count = (severity: string) => report.findings.filter((f) => f.severity === severity).length;
    return (
        <StyleShell chrome={analysisChrome(report)} direction="b">
            <p class="psb-status">
                <strong>{report.headline}</strong> <Inline md={report.lead} />
            </p>
            <Props
                rows={[
                    ['Findings', `${report.findings.length}`],
                    ['Critical', <State tone="success">{count('critical')}</State>],
                    ['Medium', <State tone="warning">{count('medium')}</State>],
                    ['Low', <State tone="neutral" glyph="info">{count('low')}</State>],
                    ['Coverage', `${report.covered}/${report.total} requirements`],
                    ['Saved as', ANALYSIS_ORIGIN],
                ]}
            />

            <Block title="Findings" meta={`${report.findings.length}`}>
                <table class="psb-table psb-table--findings">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Finding</th>
                            <th>Category</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    {report.groups.map((g) => (
                        <tbody key={g.severity}>
                            <tr class="psb-group">
                                <th colSpan={4} scope="rowgroup">
                                    <State tone={g.tone} glyph={g.tone === 'neutral' ? 'info' : undefined}>
                                        {g.severity}
                                    </State>
                                    <span class="psb-group__n">{g.rows.length}</span>
                                </th>
                            </tr>
                            {g.rows.map((f) => (
                                <tr key={f.id}>
                                    <td class="psb-mono psb-strong">{f.id}</td>
                                    <td>
                                        <Inline md={f.summary} />
                                        <span class="psb-fix">
                                            <span class="codicon codicon-arrow-right" aria-hidden="true" />
                                            <Inline md={f.recommendation} />
                                        </span>
                                    </td>
                                    <td>{f.category}</td>
                                    <td class="psb-mono">{f.location}</td>
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </Block>

            <Block title="Checks">
                <Rows rows={[...report.notes.map((n): [string, string] => [n.label, n.md]), ['Next', report.next]]} />
            </Block>
        </StyleShell>
    );
}

export function IdeaB({ idea }: { idea: IdeaDecision }) {
    return (
        <StyleShell chrome={ideaChrome(idea)} direction="b">
            <p class="psb-status">
                <strong>Go.</strong> <Inline md={idea.rationale} />
            </p>
            <Props
                rows={[
                    ['Verdict', <State tone="success">{idea.verdict}</State>],
                    ['Decided', idea.decided],
                    ['Criteria', `${idea.scorecard.length} rated`],
                    ['Ratings', idea.tally.map((t) => `${t.count} ${t.rating}`).join(', ')],
                    ['Reviewed', idea.artifacts.join(', ')],
                    ['Folder', idea.path],
                ]}
            />

            <Block title="Scorecard" meta={`${idea.scorecard.length} criteria`}>
                <table class="psb-table">
                    <thead>
                        <tr>
                            <th>Criterion</th>
                            <th>Rating</th>
                            <th>Justification</th>
                        </tr>
                    </thead>
                    <tbody>
                        {idea.scorecard.map((s) => (
                            <tr key={s.criterion}>
                                <td class="psb-strong">{s.criterion}</td>
                                <td>
                                    <State tone={s.tone} glyph={s.tone === 'neutral' ? 'check' : undefined}>
                                        {s.rating}
                                    </State>
                                </td>
                                <td>
                                    <Inline md={s.why} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Block>

            <Block title="Handoff to /speckit-specify" meta={`${idea.handoff.length} fields`}>
                <Rows rows={idea.handoff.map((field): [string, string] => [field.label, field.value])} />
            </Block>
        </StyleShell>
    );
}
