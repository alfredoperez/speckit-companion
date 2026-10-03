/**
 * The three prototype viewers: a bug (landing view plus its reports), an idea
 * (its stages and the decision), and a spec with a report tab. Each reads its
 * state from the documents it is given, the way the extension would.
 */

import { useState } from 'preact/hooks';
import { renderMarkdown } from '../../markdown';
import { ArtifactView, type Recipe } from '../artifact-gallery/ArtifactView';
import { CardGrid, FactCard, Prose, SectionCard, SummaryStrip, toneFor, type Stat, type Tone } from '../artifact-gallery/components';
import { findSection, metaValue, parseDoc, parseTable, type ArtifactDoc } from '../artifact-gallery/parse';
import * as recipes from '../artifact-gallery/recipes';
import { ProcessShell, type RailItem, type ShellFooter } from './ProcessShell';

function clean(value: string | undefined): string {
    return (value ?? '').replace(/[*`]/g, '').trim();
}

function body(doc: ArtifactDoc | null, heading: RegExp): string {
    return (doc && findSection(doc, heading)?.body) || '';
}

function formatDate(iso: string | undefined): string | undefined {
    if (!iso) return undefined;
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface BugDocs {
    assessment: string;
    fix?: string;
    test?: string;
}

function BugGlance({ assessment, fix, test, slug }: { assessment: ArtifactDoc; fix: ArtifactDoc | null; test: ArtifactDoc | null; slug: string }) {
    const changes = fix ? parseTable(body(fix, /^Changes/i)) : null;
    const checks = test ? parseTable(body(test, /^Checks Performed/i)) : null;

    const changeList = (changes?.rows ?? []).map((r) => `- ${r[0]} (${r[1]}): ${r[2]}`).join('\n');
    const checkList = (checks?.rows ?? []).map((r) => `- ${r[0]}: **${r[2]}**. ${r[3]}`).join('\n');

    const counts = new Map<string, number>();
    for (const row of checks?.rows ?? []) counts.set(row[2], (counts.get(row[2]) ?? 0) + 1);
    const stats: Stat[] = test
        ? [...counts].map(([label, value]) => ({ value, label: `checks ${label}`, tone: toneFor(label) }))
        : fix
          ? [{ value: changes?.rows.length ?? 0, label: 'files changed' }]
          : [];

    const lead = test
        ? body(test, /^Summary/i)
        : fix
          ? `**Fix applied, not verified yet.** ${body(fix, /^Summary/i).split(/(?<=\.)\s+/)[0]}`
          : '**Assessed, not fixed yet.** The assessment names a root cause and a proposed fix. Nothing in the code has changed.';

    const risks = test ? body(test, /^Residual Risks/i) : [body(assessment, /^Risks/i), body(assessment, /^Open Questions/i)].filter(Boolean).join('\n');

    return (
        <div class="ag-view pp-glance">
            <SummaryStrip lead={lead} stats={stats} />
            <CardGrid>
                <FactCard eyebrow="1 · Assess" title="Symptom" body={body(assessment, /^Symptom/i)} />
                <FactCard
                    eyebrow="2 · Assess"
                    title="Root cause"
                    tone="error"
                    chip={{ label: clean(metaValue(assessment, 'Verdict')) }}
                    body={body(assessment, /^Root Cause/i)}
                />
                {fix ? (
                    <FactCard
                        eyebrow="3 · Fix"
                        title="What changed"
                        tone="success"
                        chip={{ label: clean(metaValue(fix, 'Status')) }}
                        body={[body(fix, /^Summary/i), changeList].join('\n\n')}
                    />
                ) : (
                    <FactCard
                        eyebrow="3 · Fix"
                        title="What changed"
                        chip={{ label: 'not run', tone: 'neutral' }}
                        body={`Nothing yet. **Fix bug** sends \`/speckit-bug-fix slug=${slug}\` and the assistant writes \`fix.md\`.`}
                    />
                )}
                {test ? (
                    <FactCard
                        eyebrow="4 · Test"
                        title="How it was verified"
                        tone="success"
                        chip={{ label: clean(metaValue(test, 'Result')) }}
                        body={checkList}
                    />
                ) : (
                    <FactCard
                        eyebrow="4 · Test"
                        title="How it was verified"
                        chip={{ label: 'not run', tone: 'neutral' }}
                        body={
                            fix
                                ? `Not verified yet. **Test fix** sends \`/speckit-bug-test slug=${slug}\` and the assistant writes \`test.md\`.`
                                : 'Not verified yet. Test comes after the fix.'
                        }
                    />
                )}
            </CardGrid>
            <SectionCard title={test ? 'Residual risks' : 'Risks and open questions'} tone="warning">
                <Prose md={risks} />
            </SectionCard>
        </div>
    );
}

const BUG_RECIPES: Record<string, Recipe> = {
    assessment: recipes.bugAssessment,
    fix: recipes.bugFix,
    test: recipes.bugTest,
};

export function BugViewer({ docs, initial = 'overview' }: { docs: BugDocs; initial?: string }) {
    const [active, setActive] = useState(initial);
    const assessment = parseDoc(docs.assessment);
    const fix = docs.fix ? parseDoc(docs.fix) : null;
    const test = docs.test ? parseDoc(docs.test) : null;

    const slug = clean(metaValue(assessment, 'Slug'));
    const verdict = clean(metaValue(assessment, 'Verdict'));
    const severity = clean(metaValue(assessment, 'Severity'));
    const status = fix ? clean(metaValue(fix, 'Status')) : '';
    const result = test ? clean(metaValue(test, 'Result')) : '';

    const steps: RailItem[] = [
        { id: 'assessment', label: 'Assess', mark: 'done', result: verdict, tone: toneFor(verdict) },
        { id: 'fix', label: 'Fix', mark: fix ? 'done' : 'pending', result: status || 'not run', tone: status ? toneFor(status) : 'neutral' },
        { id: 'test', label: 'Test', mark: test ? 'done' : 'pending', result: result || 'not run', tone: result ? toneFor(result) : 'neutral' },
    ];

    const footer: ShellFooter = test
        ? { context: `Test result: ${result}`, right: [{ label: 'Test again', title: `/speckit-bug-test slug=${slug}` }] }
        : fix
          ? {
                context: 'Next: Test fix',
                left: [{ label: 'Fix again', title: `/speckit-bug-fix slug=${slug}` }],
                right: [{ label: 'Test fix', variant: 'primary', title: `/speckit-bug-test slug=${slug}` }],
            }
          : {
                context: 'Next: Fix bug',
                left: [{ label: 'Assess again', title: `/speckit-bug-assess slug=${slug}` }],
                right: [{ label: 'Fix bug', variant: 'primary', title: `/speckit-bug-fix slug=${slug}` }],
            };

    const md = active === 'fix' ? docs.fix : active === 'test' ? docs.test : docs.assessment;

    return (
        <ProcessShell
            header={{
                title: assessment.title.replace(/^Bug Assessment:\s*/, ''),
                chips: [
                    { kind: 'verdict', label: verdict },
                    { kind: 'severity', label: severity },
                    ...(status ? [{ kind: 'fix', label: status }] : []),
                    ...(result ? [{ kind: 'test', label: result }] : []),
                ],
                path: { icon: 'bug', text: `.specify/bugs/${slug}` },
                date: formatDate(metaValue(assessment, 'Created')),
            }}
            overview
            groups={[{ label: 'Steps', items: steps }]}
            active={active}
            onSelect={setActive}
            footer={footer}
            wide={active === 'overview'}
        >
            {active === 'overview' ? (
                <BugGlance assessment={assessment} fix={fix} test={test} slug={slug} />
            ) : (
                <ArtifactView md={md ?? ''} recipe={BUG_RECIPES[active]} />
            )}
        </ProcessShell>
    );
}

const IDEA_STAGES: Array<[id: string, label: string, recipe: Recipe]> = [
    ['intake', 'Intake', recipes.assessStage],
    ['research', 'Research', recipes.assessStage],
    ['problem', 'Problem', recipes.assessStage],
    ['concept', 'Concept', recipes.assessConcept],
    ['decision', 'Decision', recipes.assessDecision],
];

const DECISION_RECIPE: Recipe = {
    ...recipes.assessDecision,
    rules: [
        ...recipes.assessDecision.rules,
        { match: /^If go/i, block: { as: 'callout', tone: 'success' } },
        { match: /^If needs-clarification/i, block: { as: 'callout', tone: 'warning' } },
    ],
};

const VERDICT_TONE: Record<string, Tone> = { go: 'success', 'needs-clarification': 'warning', kill: 'error' };

/** `docs.decision` is required; a stage with no document stays on the rail as done but does not open. */
export function IdeaViewer({ docs }: { docs: Record<string, string> }) {
    const [active, setActive] = useState('decision');
    const decision = parseDoc(docs.decision);
    const slug = clean(metaValue(decision, 'Slug'));
    const verdict = clean(metaValue(decision, 'Verdict'));
    const tone = VERDICT_TONE[verdict] ?? 'neutral';
    const revisit = clean(/\*\*Revisit stage\*\*:\s*(.+)/.exec(docs.decision)?.[1]);

    const footer: ShellFooter =
        verdict === 'go'
            ? {
                  context: 'Next: Create spec from this idea',
                  right: [{ label: 'Create spec from this idea', variant: 'primary', title: 'Opens Create Spec with the handoff filled in' }],
              }
            : verdict === 'needs-clarification'
              ? {
                    context: `Blocked on open questions. Revisit: ${revisit}`,
                    right: [{ label: 'Continue assessment', variant: 'primary', title: `/speckit-assess-${revisit} slug=${slug}` }],
                }
              : { context: 'Closed. Kept for the record', right: [{ label: 'Reopen from intake', title: `/speckit-assess-intake slug=${slug}` }] };

    const stage = IDEA_STAGES.find(([id]) => id === active) ?? IDEA_STAGES[4];

    return (
        <ProcessShell
            header={{
                title: decision.title.replace(/^Decision:\s*/, ''),
                chips: [{ kind: 'verdict', label: verdict, tone }],
                path: { icon: 'lightbulb', text: `.specify/assessments/${slug}` },
                date: formatDate(metaValue(decision, 'Decided')),
            }}
            groups={[
                {
                    label: 'Stages',
                    items: IDEA_STAGES.map(([id, label]) => ({
                        id,
                        label,
                        mark: 'done' as const,
                        result: id === 'decision' ? verdict.replace('needs-clarification', 'clarify') : undefined,
                        tone,
                    })),
                },
            ]}
            active={active}
            onSelect={(id) => docs[id] && setActive(id)}
            footer={footer}
        >
            <div class={`pp-verdict pp-verdict--${tone}`}>
                <ArtifactView md={docs[stage[0]]} recipe={stage[0] === 'decision' ? DECISION_RECIPE : stage[2]} />
            </div>
        </ProcessShell>
    );
}

export interface SpecReport {
    id: string;
    label: string;
    icon: string;
    md: string;
    recipe: Recipe;
    result: string;
    origin: string;
}

export function SpecReportViewer({
    docs,
    report,
    initial,
    footer,
}: {
    docs: { spec: string; plan: string; tasks: string };
    report: SpecReport;
    initial: string;
    footer: ShellFooter;
}) {
    const [active, setActive] = useState(initial);
    const core: Record<string, string> = docs;
    const onReport = active === report.id;

    return (
        <ProcessShell
            header={{
                title: 'Dark Mode Toggle',
                badge: 'Active',
                path: { icon: 'git-branch', text: '001-dark-mode-toggle' },
                date: 'Oct 3, 2026',
            }}
            groups={[
                {
                    label: 'Pipeline',
                    items: [
                        { id: 'spec', label: 'Specification', mark: 'done', children: ['Checklist: Requirements', 'Checklist: Ux'] },
                        { id: 'plan', label: 'Plan', mark: 'done', children: ['Research', 'Data Model', 'Quickstart'] },
                        { id: 'tasks', label: 'Tasks', mark: 'done' },
                    ],
                },
                {
                    label: 'Reports',
                    items: [{ id: report.id, label: report.label, mark: 'icon', icon: report.icon, result: report.result, tone: 'warning' }],
                },
            ]}
            active={active}
            onSelect={setActive}
            footer={footer}
            html={onReport ? undefined : renderMarkdown(core[active] ?? '')}
        >
            {onReport && <ArtifactView md={report.md} recipe={report.recipe} origin={report.origin} />}
        </ProcessShell>
    );
}
