import type { BugLead, BugMeta, BugStep, BugStepId, BugStory } from '../../../../src/features/reports/reportPageModel';
import { Inline, Prose } from './fragments';

const LEADS: Record<BugLead, string> = {
    assessed: 'Assessed, not fixed yet.',
    'fixed-untested': 'Fixed, not tested yet.',
    verified: 'Fixed and verified.',
    'test-failed': 'The fix did not hold.',
    'test-unclear': 'Tested, result unclear.',
    closed: 'Closed without a fix.',
};

const STEPS: Record<BugStepId, { anchor: string; title: string; stage: string; missing?: string }> = {
    wrong: { anchor: 'what-was-wrong', title: 'What was wrong', stage: 'Assess' },
    changed: { anchor: 'what-changed', title: 'What changed', stage: 'Fix', missing: 'It has not been fixed yet.' },
    verified: { anchor: 'how-it-was-verified', title: 'How it was verified', stage: 'Test', missing: 'It has not been verified yet.' },
};

const FIX_STATUS = { applied: 'fix applied', partial: 'fix partly applied', 'not-applied': 'fix not applied' } as const;
const CHECK_RESULT = { pass: 'pass', fail: 'fail', 'not-run': 'not run' } as const;

function metaFacts(meta: BugMeta): string[] {
    const facts: string[] = [];
    if (meta.reported && meta.source) facts.push(`Reported ${meta.reported} from ${meta.source}`);
    else if (meta.reported) facts.push(`Reported ${meta.reported}`);
    else if (meta.source) facts.push(`Reported from ${meta.source}`);
    if (meta.verdict) facts.push(meta.verdict);
    if (meta.severity) facts.push(`${meta.severity} severity`);
    if (meta.fixStatus) facts.push(FIX_STATUS[meta.fixStatus]);
    return facts;
}

function isEmpty(step: BugStep): boolean {
    return !step.body?.trim() && !step.files?.length && !step.diffs?.length && !step.checks?.length;
}

function FilePath({ path }: { path: string }) {
    const quoted = /^`([^`]+)`$/.exec(path.trim());
    return quoted ? <code>{quoted[1]}</code> : <span>{path}</span>;
}

function Row({ name, path, word, note }: { name?: string; path?: string; word?: string; note?: string }) {
    return (
        <li>
            {path ? <FilePath path={path} /> : <Inline md={name ?? ''} />}
            {word ? <Inline md={word} /> : note ? <span /> : null}
            {note ? <Inline md={note} /> : null}
        </li>
    );
}

function Step({ step, nextAction }: { step: BugStep; nextAction?: string }) {
    const { anchor, title, stage, missing } = STEPS[step.id];
    const next = step.state === 'next';

    return (
        <li class={`rp-step rp-step--${next ? 'next' : 'done'}`}>
            <span class="rp-step__mark" aria-hidden="true" />
            <span class="sr-only">{next ? 'Next:' : 'Done:'}</span>
            {step.when ? <p class="rp-step__when">{`${stage} · ${step.when}`}</p> : null}
            <h2 id={anchor}>{title}</h2>
            {next && isEmpty(step) && missing ? (
                <p class="rp-next">
                    {missing}
                    {nextAction ? (
                        <>
                            {' '}
                            <strong>{nextAction}</strong> in the footer hands this step to your assistant.
                        </>
                    ) : null}
                </p>
            ) : null}
            <Prose md={step.body} />
            {step.files?.length ? (
                <ul class="rp-rows">
                    {step.files.map((file, index) => (
                        <Row key={index} path={file.path} word={file.change} note={file.note} />
                    ))}
                </ul>
            ) : null}
            {step.diffs?.map((diff, index) => (
                <pre key={index} class="code-block" data-language={diff.language || undefined}>
                    <code class={diff.language ? `language-${diff.language}` : undefined}>{diff.code}</code>
                </pre>
            ))}
            {step.checks?.length ? (
                <ul class="rp-rows">
                    {step.checks.map((check, index) => (
                        <Row key={index} name={check.name} word={check.result && CHECK_RESULT[check.result]} note={check.note} />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

export function BugStoryPage({ story }: { story: BugStory }) {
    const facts = metaFacts(story.meta ?? {});
    const steps = story.lead === 'closed' ? story.steps.slice(0, 1) : story.steps;
    const firstNext = steps.find(step => step.state === 'next');
    const risks = story.risks ?? [];

    return (
        <>
            <p class="rp-lead">
                <strong>{LEADS[story.lead]}</strong>
            </p>
            {facts.length ? <p class="rp-meta">{facts.join(' · ')}</p> : null}
            <ol class="rp-line">
                {steps.map(step => (
                    <Step key={step.id} step={step} nextAction={step === firstNext ? story.nextAction : undefined} />
                ))}
            </ol>
            {risks.length ? (
                <>
                    <h2 id="risks-and-open-questions">Risks and open questions</h2>
                    <ul>
                        {risks.map((risk, index) => (
                            <li key={index}>
                                <Inline md={risk} />
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
        </>
    );
}
