/**
 * Draws one Spec Kit artifact from its markdown and a recipe. A recipe names
 * which heading gets which shared component; anything it does not name falls
 * back to the stock markdown rendering, so no content is ever dropped.
 */

import type { ComponentChildren } from 'preact';
import {
    parseChecks,
    metaValue,
    parseDoc,
    parseFields,
    parseItems,
    parseQa,
    parseTable,
    splitId,
    unwrap,
    type ArtifactDoc,
    type Section,
    type Table,
} from './parse';
import {
    CardGrid,
    CheckGroup,
    FactCard,
    MetaStrip,
    Prose,
    RecordList,
    SectionCard,
    StepTimeline,
    SummaryStrip,
    toneFor,
    type Fact,
    type FactCardProps,
    type RecordRow,
    type Stat,
    type Tone,
} from './components';

export interface RecordsBlock {
    as: 'records';
    title?: string;
    id?: string;
    detail?: string;
    chips?: string[];
    extra?: string[];
    groupBy?: string;
    order?: string[];
    rest?: boolean;
    hideBefore?: boolean;
}

export type Block =
    | { as: 'prose' }
    | { as: 'callout'; tone: Tone }
    | { as: 'quote' }
    | { as: 'steps' }
    | { as: 'list' }
    | RecordsBlock
    | { as: 'card'; eyebrow?: string; chipField?: string; leadField?: string }
    | { as: 'cards'; eyebrow?: string; chipField?: string; leadField?: string; wide?: boolean; pickFrom?: string }
    | { as: 'entity' }
    | { as: 'checks' }
    | { as: 'qa' }
    | { as: 'step' }
    | { as: 'hide' };

export interface Rule {
    match: RegExp;
    block: Block;
    tone?: Tone;
    toneFrom?: string;
}

export interface Summary {
    stats: Stat[];
    ring?: { done: number; total: number; label: string };
    lead?: string;
}

export interface Recipe {
    chips?: string[];
    hideMeta?: RegExp;
    summary?: (doc: ArtifactDoc) => Summary | null;
    rules: Rule[];
    hideIntro?: boolean;
    trailingMeta?: boolean;
    restAsOne?: boolean;
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

function column(table: Table, name: string | undefined): number {
    if (!name) return -1;
    const wanted = name.toLowerCase();
    const headers = table.headers.map((h) => h.toLowerCase().replace(/[*`]/g, '').trim());
    const exact = headers.indexOf(wanted);
    return exact >= 0 ? exact : headers.findIndex((h) => h.startsWith(wanted));
}

export function countBy(table: Table, name: string): Map<string, number> {
    const col = column(table, name);
    const out = new Map<string, number>();
    if (col < 0) return out;
    for (const row of table.rows) {
        const key = (row[col] ?? '').replace(/[*`]/g, '').trim();
        if (key) out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
}

export function severityStats(counts: Map<string, number>): Stat[] {
    const keys = [...counts.keys()].sort((a, b) => {
        const ia = SEVERITY_ORDER.indexOf(a.toLowerCase());
        const ib = SEVERITY_ORDER.indexOf(b.toLowerCase());
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map((k) => ({ value: counts.get(k)!, label: k, tone: toneFor(k) }));
}

function tableRecords(table: Table, block: RecordsBlock) {
    const idCol = column(table, block.id);
    const titleCol = Math.max(column(table, block.title), idCol === 0 ? 1 : 0);
    const groupCol = column(table, block.groupBy);
    const chipCols = (block.chips ?? []).map((c) => column(table, c)).filter((c) => c >= 0 && c !== groupCol);
    const named = column(table, block.detail);
    const taken = [idCol, titleCol, groupCol, ...chipCols];
    const detailCol = named >= 0 ? named : block.rest ? table.headers.findIndex((_h, i) => !taken.includes(i)) : -1;
    const extraCols = block.rest
        ? table.headers.map((_h, i) => i).filter((i) => ![...taken, detailCol].includes(i))
        : (block.extra ?? []).map((c) => column(table, c)).filter((c) => c >= 0);

    const grouped = new Map<string, RecordRow[]>();
    for (const cells of table.rows) {
        const rawTitle = cells[titleCol] ?? '';
        const split = idCol < 0 && block.id === undefined ? splitId(rawTitle) : { id: '', rest: rawTitle };
        const row: RecordRow = {
            id: idCol >= 0 ? cells[idCol]?.replace(/[*`]/g, '') : split.id,
            title: split.rest,
            detail: detailCol >= 0 ? cells[detailCol] : undefined,
            chips: chipCols.filter((c) => cells[c]?.trim()).map((c) => ({ label: cells[c] })),
            extra: extraCols
                .filter((c) => cells[c]?.trim() && cells[c].trim() !== '—' && cells[c].trim() !== '-')
                .map((c) => ({ label: table.headers[c], value: cells[c] })),
        };
        const key = groupCol >= 0 ? (cells[groupCol] ?? '').replace(/[*`]/g, '').trim() : '';
        grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }

    const order = (block.order ?? SEVERITY_ORDER).map((o) => o.toLowerCase());
    const keys = [...grouped.keys()].sort((a, b) => {
        const ia = order.indexOf(a.toLowerCase());
        const ib = order.indexOf(b.toLowerCase());
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map((k) => ({ label: k || undefined, rows: grouped.get(k)! }));
}

function listRecords(body: string): { rows: RecordRow[]; before: string; after: string } {
    const { items, before, after } = parseItems(body);
    const rows = items.map((item): RecordRow => {
        const [head, ...tail] = item.split('\n');
        const m = /^(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))\s*(?::|—|-)\s*(.*)$/.exec(head);
        const nested = tail.join('\n').trim();
        if (m) return { title: m[1], detail: [m[2], nested].filter(Boolean).join(' ') };
        return { title: head, detail: nested || undefined };
    });
    return { rows, before, after };
}

function cardFrom(section: Section, block: { eyebrow?: string; chipField?: string; leadField?: string }): FactCardProps {
    const { fields, rest } = parseFields(section.body);
    const numbered = /^(Option [A-Z]|[A-Z]{1,2}\d{1,3}|[IVX]{1,4}|\d{1,2})(?:[.:]|\s+—)\s+(.+)$/.exec(section.heading);
    const eyebrow = numbered ? numbered[1] : block.eyebrow;
    const title = numbered ? numbered[2] : section.heading;
    const take = (name: string | undefined): Fact | undefined => {
        if (!name) return undefined;
        const i = fields.findIndex((f) => f.label.toLowerCase().startsWith(name.toLowerCase()));
        return i >= 0 ? fields.splice(i, 1)[0] : undefined;
    };
    const chip = take(block.chipField);
    const lead = take(block.leadField);
    const paragraphs = unwrap(rest.replace(/\n(?=Rationale:)/g, '\n\n')).split(/\n{2,}/);
    const rationale = fields.length ? -1 : paragraphs.findIndex((p) => /^Rationale:/.test(p));
    if (rationale >= 0) {
        fields.push({ label: 'Rationale', value: paragraphs[rationale].replace(/^Rationale:\s*/, '') });
        paragraphs.splice(rationale, 1);
    }
    return {
        eyebrow: eyebrow || undefined,
        title,
        chip: chip ? { label: chip.value.split(/[.(]/)[0].trim() } : undefined,
        lead: lead?.value ?? (rationale >= 0 ? paragraphs.join(' ') : undefined),
        fields,
        body: rationale >= 0 && !lead ? '' : paragraphs.join('\n\n'),
    };
}

function entityCard(section: Section): FactCardProps {
    const table = parseTable(section.body);
    const m = /^([^:]+):\s*(.+)$/.exec(section.heading);
    if (!table) return { eyebrow: m?.[1], title: m?.[2] ?? section.heading, body: section.body };
    const fields = table.rows.map((cells) => ({
        label: cells[0].replace(/[*`]/g, ''),
        value: cells
            .slice(1)
            .filter((c) => c && c !== '—')
            .join(' · '),
    }));
    return {
        eyebrow: m?.[1],
        title: m?.[2] ?? section.heading,
        lead: table.before || undefined,
        fields,
        body: table.after,
    };
}

function renderBlock(section: Section, rule: Rule | undefined, doc: ArtifactDoc): ComponentChildren {
    const block: Block = rule?.block ?? { as: 'prose' };
    const tone = rule?.tone;
    const nested = section.children.map((c) => `### ${c.heading}\n\n${c.body}`).join('\n\n');
    const whole = [section.body, nested].filter(Boolean).join('\n\n');

    switch (block.as) {
        case 'hide':
            return null;
        case 'callout':
            return (
                <SectionCard title={section.heading} tone={rule?.toneFrom ? toneFor(metaValue(doc, rule.toneFrom) ?? '') : block.tone}>
                    <Prose md={whole} />
                </SectionCard>
            );
        case 'quote':
            return (
                <SectionCard title={section.heading}>
                    <blockquote class="ag-quote">
                        <Prose md={whole.replace(/^>\s?/gm, '')} />
                    </blockquote>
                </SectionCard>
            );
        case 'steps': {
            const { items, before, after } = parseItems(section.body);
            if (!items.length) break;
            return (
                <SectionCard title={section.heading} tone={tone}>
                    <Prose md={before} />
                    <StepTimeline steps={items.map((md) => ({ md }))} />
                    <Prose md={[after, nested].filter(Boolean).join('\n\n')} />
                </SectionCard>
            );
        }
        case 'list': {
            const { rows, before, after } = listRecords(section.body);
            if (!rows.length) break;
            return (
                <SectionCard title={section.heading} tone={tone} count={String(rows.length)}>
                    <Prose md={before} />
                    <RecordList groups={[{ rows }]} />
                    <Prose md={[after, nested].filter(Boolean).join('\n\n')} />
                </SectionCard>
            );
        }
        case 'records': {
            const table = parseTable(section.body);
            if (!table) break;
            return (
                <SectionCard title={section.heading} tone={tone} count={String(table.rows.length)}>
                    {!block.hideBefore && <Prose md={table.before} />}
                    <RecordList groups={tableRecords(table, block).map((g) => ({ ...g, tone: g.label ? toneFor(g.label) : undefined }))} />
                    <Prose md={[table.after, nested].filter(Boolean).join('\n\n')} />
                </SectionCard>
            );
        }
        case 'cards': {
            if (!section.children.length) break;
            return (
                <SectionCard title={section.heading} tone={tone} count={String(section.children.length)}>
                    <Prose md={section.body} />
                    <CardGrid wide={block.wide}>
                        {section.children.map((c) => {
                            const card = cardFrom(c, block);
                            const picked = block.pickFrom && card.eyebrow ? metaValue(doc, block.pickFrom)?.startsWith(card.eyebrow.split(' ').pop()!) : false;
                            return <FactCard key={c.heading} {...card} tone={picked ? 'success' : undefined} badge={picked ? 'Recommended' : undefined} />;
                        })}
                    </CardGrid>
                </SectionCard>
            );
        }
        case 'checks': {
            const items = parseChecks(section.body);
            if (!items.length) break;
            return <CheckGroup title={section.heading} items={items} />;
        }
        case 'qa': {
            const sessions = section.children.length ? section.children : [section];
            const pairs = sessions.flatMap((s) => parseQa(s.body).map((p) => ({ ...p, session: s.heading.replace(/^Session\s*/, '') })));
            if (!pairs.length) break;
            return (
                <SectionCard title={section.heading} count={`${pairs.length} answered`}>
                    <CardGrid wide>
                        {pairs.map((p, i) => (
                            <FactCard key={i} eyebrow={`Q${i + 1} · ${p.session}`} title={p.question} lead={p.answer} tone="success" />
                        ))}
                    </CardGrid>
                </SectionCard>
            );
        }
        default:
            break;
    }

    return (
        <SectionCard title={section.heading} tone={tone}>
            <Prose md={whole} />
        </SectionCard>
    );
}

type Run =
    | { kind: 'card' | 'entity' | 'step'; sections: Array<{ section: Section; rule: Rule }> }
    | { kind: 'single'; section: Section; rule?: Rule }
    | { kind: 'rest'; md: string };

function sectionMarkdown(section: Section): string {
    const hashes = '#'.repeat(section.level);
    return [`${hashes} ${section.heading}`, section.body, ...section.children.map(sectionMarkdown)].filter(Boolean).join('\n\n');
}

const TRAILING_META = /\n?^\*\*[^*]+\*\*\s*:.*$\s*$/m;

function liftTrailingMeta(doc: ArtifactDoc): void {
    const last = doc.sections[doc.sections.length - 1];
    const line = last?.body.split('\n').pop() ?? '';
    if (!last || !/^\*\*[^*]+\*\*\s*:/.test(line)) return;
    for (const part of line.split(/\s+\|\s+/)) {
        const m = /^\*\*([^*]+?)\*\*\s*:\s*(.*)$/.exec(part.trim());
        if (m) doc.meta.push({ key: m[1].trim(), value: m[2].trim() });
    }
    last.body = last.body.replace(TRAILING_META, '').trim();
}

function groupRuns(doc: ArtifactDoc, recipe: Recipe): Run[] {
    const runs: Run[] = [];
    for (const section of doc.sections) {
        const rule = recipe.rules.find((r) => r.match.test(section.heading));
        const kind = rule?.block.as;
        if (!rule && recipe.restAsOne) {
            const last = runs[runs.length - 1];
            if (last && last.kind === 'rest') last.md += `\n\n${sectionMarkdown(section)}`;
            else runs.push({ kind: 'rest', md: sectionMarkdown(section) });
            continue;
        }
        if (rule && (kind === 'card' || kind === 'entity' || kind === 'step')) {
            const last = runs[runs.length - 1];
            if (last && last.kind === kind) last.sections.push({ section, rule });
            else runs.push({ kind, sections: [{ section, rule }] });
        } else {
            runs.push({ kind: 'single', section, rule });
        }
    }
    return runs;
}

export function ArtifactView({ md, recipe, origin }: { md: string; recipe: Recipe; origin?: string }) {
    const doc = parseDoc(md);
    if (recipe.trailingMeta) liftTrailingMeta(doc);
    const chipKeys = (recipe.chips ?? []).map((c) => c.toLowerCase());
    const shown = doc.meta.filter((m) => !recipe.hideMeta?.test(m.key));
    const chips = shown
        .filter((m) => chipKeys.includes(m.key.toLowerCase()))
        .map((m) => ({ kind: m.key, label: m.value.split(/\s+[—(]/)[0] }));
    const rest = shown.filter((m) => !chipKeys.includes(m.key.toLowerCase()));
    const facts = rest.filter((m) => m.value.length <= 90);
    const notes = rest.filter((m) => m.value.length > 90).map((m) => ({ label: m.key, value: m.value }));
    const summary = recipe.summary?.(doc) ?? null;

    return (
        <div class="ag-view">
            {origin && <p class="ag-origin">{origin}</p>}
            <MetaStrip chips={chips} facts={facts.map((m) => ({ label: m.key, value: m.value }))} notes={notes} />
            {summary && <SummaryStrip {...summary} />}
            {!recipe.hideIntro && <Prose md={doc.intro} />}
            {groupRuns(doc, recipe).map((run, i) => {
                if (run.kind === 'rest') return <Prose key={i} md={run.md} />;
                if (run.kind === 'single') return renderBlock(run.section, run.rule, doc);
                if (run.kind === 'step') {
                    return (
                        <StepTimeline
                            key={i}
                            asSections
                            steps={run.sections.map(({ section }) => ({
                                title: section.heading.replace(/^\d+[.)]\s*/, ''),
                                md: [section.body, ...section.children.map((c) => `### ${c.heading}\n\n${c.body}`)].join('\n\n'),
                            }))}
                        />
                    );
                }
                return (
                    <CardGrid key={i} wide>
                        {run.sections.map(({ section, rule }) => (
                            <FactCard
                                key={section.heading}
                                asSection
                                {...(run.kind === 'entity'
                                    ? entityCard(section)
                                    : cardFrom(section, rule.block as { eyebrow?: string; chipField?: string; leadField?: string }))}
                            />
                        ))}
                    </CardGrid>
                );
            })}
        </div>
    );
}
