import type { IdeaClosing, IdeaDecision } from '../../../../src/features/reports/reportPageModel';
import { Inline, Prose } from './fragments';

const VERDICT_SENTENCE: Record<IdeaDecision['verdict'], string> = {
    go: 'Go.',
    'needs-clarification': 'Needs clarification.',
    kill: 'Kill.',
};

function capitalise(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function Closing({ closing }: { closing: IdeaClosing }) {
    if (closing.verdict === 'go') {
        if (!closing.fields.length) return null;
        return (
            <>
                <h2 id="handoff">Handoff</h2>
                <dl class="rp-defs">
                    {closing.fields.map((field, index) => (
                        <div key={index}>
                            <dt>{field.term}</dt>
                            <dd>
                                <Prose md={field.text} />
                            </dd>
                        </div>
                    ))}
                </dl>
            </>
        );
    }
    if (closing.verdict === 'needs-clarification') {
        if (!closing.questions.length && !closing.revisit) return null;
        return (
            <>
                <h2 id="what-is-blocking">What is blocking</h2>
                {closing.questions.length > 0 && (
                    <ul>
                        {closing.questions.map((question, index) => (
                            <li key={index}>
                                <Inline md={question} />
                            </li>
                        ))}
                    </ul>
                )}
                {closing.revisit && <p>Revisit the {capitalise(closing.revisit)} stage.</p>}
            </>
        );
    }
    if (!closing.trigger.trim()) return null;
    return (
        <>
            <h2 id="revisit-trigger">Revisit trigger</h2>
            <Prose md={closing.trigger} />
        </>
    );
}

export function IdeaDecisionPage({ decision }: { decision: IdeaDecision }) {
    return (
        <>
            <p class="rp-lead">
                <strong>{VERDICT_SENTENCE[decision.verdict]}</strong>
                {decision.lead && ' '}
                {decision.lead && <Inline md={decision.lead} />}
            </p>
            <Prose md={decision.rationale} />
            {decision.scorecard.length > 0 && (
                <>
                    <h2 id="scorecard">Scorecard</h2>
                    <ul class="rp-score">
                        {decision.scorecard.map((row, index) => (
                            <li key={index}>
                                <Inline md={row.criterion} />
                                {row.rating && (
                                    <span class={row.tone ? `rp-score__rating rp-tone--${row.tone}` : 'rp-score__rating'}>
                                        {row.rating}
                                    </span>
                                )}
                                {row.reason && <Inline md={row.reason} />}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {decision.closing && <Closing closing={decision.closing} />}
        </>
    );
}
