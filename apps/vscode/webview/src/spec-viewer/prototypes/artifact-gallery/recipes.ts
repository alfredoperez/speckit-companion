/**
 * One recipe per artifact kind: which headings become which shared component,
 * and what the at-a-glance summary counts.
 */

import { countBy, severityStats, type Recipe, type Summary } from './ArtifactView';
import { toneFor, type Stat } from './components';
import { findSection, parseChecks, parseTable, type ArtifactDoc } from './parse';

function tableStats(doc: ArtifactDoc, heading: RegExp, columnName: string): Stat[] {
    const section = findSection(doc, heading);
    const table = section ? parseTable(section.body) : null;
    if (!table) return [];
    return [...countBy(table, columnName)].map(([label, value]) => ({ value, label, tone: toneFor(label) }));
}

function checklistSummary(doc: ArtifactDoc): Summary | null {
    const items = doc.sections.flatMap((s) => parseChecks(s.body));
    if (!items.length) return null;
    const done = items.filter((i) => i.checked).length;
    const tagCounts = new Map<string, number>();
    for (const item of items.filter((i) => !i.checked)) {
        for (const tag of item.tags.filter((t) => /^(gap|ambiguity|conflict|consistency|measurability|clarity)$/i.test(t))) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
    }
    const top = [...tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
        ring: { done, total: items.length, label: 'items checked' },
        lead: done === items.length ? 'Every item is checked.' : `**${items.length - done}** of ${items.length} items still need a reviewer.`,
        stats: [
            { value: done, label: 'checked', tone: 'success' },
            { value: items.length - done, label: 'open', tone: done === items.length ? 'neutral' : 'warning' },
            ...top.map(([label, value]): Stat => ({ value, label: `open: ${label}`, tone: 'neutral' })),
        ],
    };
}

export const bugAssessment: Recipe = {
    chips: ['Verdict', 'Severity'],
    rules: [
        { match: /^Report/i, block: { as: 'quote' } },
        { match: /^Reproduction/i, block: { as: 'steps' } },
        { match: /^Suspected Code Paths/i, block: { as: 'list' } },
        { match: /^Root Cause/i, block: { as: 'callout', tone: 'error' } },
        { match: /^Proposed Remediation/i, block: { as: 'callout', tone: 'success' } },
        { match: /^Risks/i, block: { as: 'list' } },
        { match: /^Open Questions/i, block: { as: 'callout', tone: 'warning' } },
    ],
};

export const bugFix: Recipe = {
    chips: ['Status'],
    rules: [
        { match: /^Changes/i, block: { as: 'records', title: 'File', detail: 'Notes', chips: ['Change'] } },
        { match: /^Tests Added/i, block: { as: 'list' } },
        { match: /^Local Verification/i, block: { as: 'callout', tone: 'success' } },
        { match: /^Follow-ups/i, block: { as: 'callout', tone: 'warning' } },
    ],
};

export const bugTest: Recipe = {
    chips: ['Result'],
    summary: (doc) => {
        const stats = tableStats(doc, /^Checks Performed/i, 'Result');
        return stats.length ? { stats, lead: findSection(doc, /^Summary/i)?.body.split('\n')[0] } : null;
    },
    rules: [
        { match: /^Summary/i, block: { as: 'hide' } },
        { match: /^Checks Performed/i, block: { as: 'records', title: 'Check', detail: 'Notes', chips: ['Result'], extra: ['Command'] } },
        { match: /^Residual Risks/i, block: { as: 'callout', tone: 'warning' } },
        { match: /^Recommendation/i, block: { as: 'callout', tone: 'success' } },
    ],
};

export const constitution: Recipe = {
    trailingMeta: true,
    chips: ['Version'],
    rules: [{ match: /Principles/i, block: { as: 'cards', eyebrow: 'Principle' } }],
};

export const clarify: Recipe = {
    chips: ['Status'],
    hideMeta: /^Input$/i,
    restAsOne: true,
    rules: [{ match: /^Clarifications/i, block: { as: 'qa' } }],
};

export const checklist: Recipe = {
    summary: checklistSummary,
    rules: [
        { match: /^Notes$/i, block: { as: 'callout', tone: 'info' } },
        { match: /.*/, block: { as: 'checks' } },
    ],
};

export const research: Recipe = {
    rules: [{ match: /^D\d+\./, block: { as: 'card', leadField: 'Decision' } }],
};

export const dataModel: Recipe = {
    rules: [
        { match: /^(Entity|Derived value)\b/i, block: { as: 'entity' } },
        { match: /^Validation rules/i, block: { as: 'records', title: 'Rule', detail: 'Behavior', chips: ['Source'] } },
    ],
};

export const quickstart: Recipe = {
    rules: [
        { match: /^Prerequisites/i, block: { as: 'callout', tone: 'info' } },
        { match: /^\d+[.)]\s/, block: { as: 'step' } },
    ],
};

export const contract: Recipe = {
    rules: [
        { match: /^Not part of/i, block: { as: 'callout', tone: 'info' } },
        { match: /.*/, block: { as: 'records', chips: ['Source'], rest: true } },
    ],
};

export const analyze: Recipe = {
    summary: (doc) => {
        const section = doc.sections[0];
        const table = section ? parseTable(section.body) : null;
        if (!table) return null;
        const coverage = /\*\*Coverage:?\*\*:?\s*(\d+) of (\d+)/i.exec(section.body);
        return {
            ring: coverage ? { done: Number(coverage[1]), total: Number(coverage[2]), label: 'requirements covered by tasks' } : undefined,
            lead: table.before.split('\n')[0],
            stats: [{ value: table.rows.length, label: 'findings' }, ...severityStats(countBy(table, 'Severity'))],
        };
    },
    rules: [
        {
            match: /Analysis Report/i,
            block: { as: 'records', id: 'ID', title: 'Summary', chips: ['Category'], extra: ['Recommendation', 'Location'], groupBy: 'Severity', hideBefore: true },
        },
    ],
};

export const converge: Recipe = {
    summary: (doc) => {
        const section = findSection(doc, /Convergence Findings/i);
        const table = section ? parseTable(section.body) : null;
        if (!table) return null;
        return {
            stats: [
                { value: table.rows.length, label: 'gaps' },
                ...severityStats(countBy(table, 'Severity')),
                ...[...countBy(table, 'Gap')].map(([label, value]): Stat => ({ value, label, tone: 'neutral' })),
            ],
        };
    },
    rules: [
        {
            match: /Convergence Findings/i,
            block: { as: 'records', id: 'ID', title: 'Evidence', chips: ['Gap'], groupBy: 'Severity', extra: ['Source', 'Already tracked by', 'Remaining Work'] },
        },
    ],
};

export const tasksToIssues: Recipe = {
    chips: ['Status'],
    summary: (doc) => {
        const stats = tableStats(doc, /^Issues/i, 'Issue');
        const phases = tableStats(doc, /^Issues/i, 'Phase').length;
        return stats.length ? { stats: [...stats, { value: phases, label: 'phases' }] } : null;
    },
    rules: [{ match: /^Issues/i, block: { as: 'records', title: 'Issue title', chips: ['Issue'], groupBy: 'Phase', order: [] } }],
};

export const assessStage: Recipe = {
    chips: ['Confidence', 'Overall confidence'],
    rules: [
        { match: /Unknowns|Open Questions|Gaps/i, block: { as: 'callout', tone: 'warning' } },
        { match: /^Evidence Against/i, block: { as: 'callout', tone: 'error' } },
        { match: /^Idea \(as captured\)/i, block: { as: 'quote' } },
        { match: /^(Goals|Non-Goals|Sources|Constraints)/i, block: { as: 'list' } },
    ],
};

export const assessConcept: Recipe = {
    rules: [
        { match: /^Options/i, block: { as: 'cards', chipField: 'Appetite', leadField: 'Sketch', wide: true, pickFrom: 'Recommended option' } },
        { match: /^Recommendation/i, block: { as: 'callout', tone: 'success' } },
        { match: /^Assumptions/i, block: { as: 'callout', tone: 'warning' } },
    ],
};

export const assessDecision: Recipe = {
    chips: ['Verdict'],
    summary: (doc) => {
        const stats = tableStats(doc, /^Scorecard/i, 'Rating');
        const rationale = findSection(doc, /^Verdict/i)?.body ?? '';
        return stats.length ? { stats, lead: rationale.split(/(?<=\.)\s+/).slice(0, 2).join(' ') } : null;
    },
    rules: [
        { match: /^Scorecard/i, block: { as: 'records', title: 'Criterion', detail: 'Justification', chips: ['Rating'] } },
        { match: /^Verdict/i, block: { as: 'callout', tone: 'neutral' }, toneFrom: 'Verdict' },
        { match: /^Revisit/i, block: { as: 'callout', tone: 'info' } },
    ],
};
