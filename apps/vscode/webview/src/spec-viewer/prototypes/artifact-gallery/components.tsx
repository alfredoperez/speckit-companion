/**
 * The shared pieces every gallery prototype is built from. Prototype only:
 * nothing the shipped viewer loads imports this file.
 */

import type { ComponentChildren } from 'preact';
import { parseInline, renderMarkdown, slugify } from '../../markdown';
import { unwrap } from './parse';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TONES: Array<[Tone, RegExp]> = [
    ['success', /^(pass(ed)?|verified|valid|applied|go|done|strong|yes|ok|closed|added|resolved|satisfied|complete[d]?)$/],
    ['error', /^(fail(ed)?|critical|high|kill|invalid|weak|missing|contradicts|blocked|no|removed|rejected)$/],
    ['warning', /^(partial|medium|adequate|not-run|not run|park|deferred|unknown|unrequested|modified|open|pending|draft|skipped)$/],
    ['info', /^(low|info|new|proposed|small|large)$/],
];

export function toneFor(value: string): Tone {
    const key = value.replace(/[*`]/g, '').trim().toLowerCase();
    return TONES.find(([, re]) => re.test(key))?.[0] ?? 'neutral';
}

export function Inline({ md }: { md: string }) {
    return <span dangerouslySetInnerHTML={{ __html: parseInline(md) }} />;
}

export function Prose({ md }: { md: string }) {
    if (!md.trim()) return null;
    return <div class="ag-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(unwrap(md)) }} />;
}

export function StatusChip({ label, tone, kind }: { label: string; tone?: Tone; kind?: string }) {
    const clean = label.replace(/[*`]/g, '').trim();
    return (
        <span class={`ag-chip ag-chip--${tone ?? toneFor(clean)}`}>
            {kind && <span class="ag-chip__kind">{kind}</span>}
            {clean}
        </span>
    );
}

export interface Fact {
    label: string;
    value: string;
}

export function MetaStrip({ chips, facts, notes }: { chips: Array<{ kind: string; label: string; tone?: Tone }>; facts: Fact[]; notes?: Fact[] }) {
    if (!chips.length && !facts.length && !notes?.length) return null;
    return (
        <header class="ag-meta">
            {chips.length > 0 && (
                <div class="ag-meta__chips">
                    {chips.map((c) => (
                        <StatusChip key={c.kind} kind={c.kind} label={c.label} tone={c.tone} />
                    ))}
                </div>
            )}
            {facts.length > 0 && (
                <dl class="ag-meta__facts">
                    {facts.map((f) => (
                        <div key={f.label} class="ag-meta__fact">
                            <dt>{f.label}</dt>
                            <dd>
                                <Inline md={f.value} />
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {notes && notes.length > 0 && (
                <details class="ag-meta__notes">
                    <summary>How to read this file</summary>
                    {notes.map((n) => (
                        <p key={n.label}>
                            <strong>{n.label}.</strong> <Inline md={n.value} />
                        </p>
                    ))}
                </details>
            )}
        </header>
    );
}

export function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const r = 26;
    const c = 2 * Math.PI * r;
    return (
        <div class="ag-ring" role="img" aria-label={`${done} of ${total} ${label}`}>
            <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
                <circle class="ag-ring__track" cx="32" cy="32" r={r} />
                <circle
                    class="ag-ring__value"
                    cx="32"
                    cy="32"
                    r={r}
                    stroke-dasharray={`${(c * pct) / 100} ${c}`}
                    transform="rotate(-90 32 32)"
                />
            </svg>
            <span class="ag-ring__pct">{pct}%</span>
        </div>
    );
}

export interface Stat {
    value: string | number;
    label: string;
    tone?: Tone;
}

export function SummaryStrip({ stats, ring, lead }: { stats: Stat[]; ring?: { done: number; total: number; label: string }; lead?: string }) {
    return (
        <div class="ag-summary">
            {ring && <ProgressRing {...ring} />}
            {lead && (
                <p class="ag-summary__lead">
                    <Inline md={lead} />
                </p>
            )}
            <ul class="ag-summary__stats">
                {stats.map((s) => (
                    <li key={s.label} class={`ag-stat ag-stat--${s.tone ?? 'neutral'}`}>
                        <span class="ag-stat__value">{s.value}</span>
                        <span class="ag-stat__label">{s.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function SectionCard({ title, tone, count, children }: { title: string; tone?: Tone; count?: string; children: ComponentChildren }) {
    const clean = title.replace(/\*\(.*?\)\*/g, '').trim();
    return (
        <section class={`ag-section${tone ? ` ag-section--${tone}` : ''}`}>
            <div class="ag-section__head">
                <h2 id={slugify(clean)} class="ag-section__title">
                    {clean}
                </h2>
                {count && <span class="ag-section__count">{count}</span>}
            </div>
            {children}
        </section>
    );
}

export function StepTimeline({ steps, asSections }: { steps: Array<{ title?: string; md: string }>; asSections?: boolean }) {
    return (
        <ol class="ag-steps">
            {steps.map((s, i) => (
                <li key={i} class="ag-step">
                    <span class="ag-step__n" aria-hidden="true">
                        {i + 1}
                    </span>
                    <div class="ag-step__body">
                        {s.title && asSections && (
                            <h2 id={slugify(s.title)} class="ag-step__title">
                                <Inline md={s.title} />
                            </h2>
                        )}
                        {s.title && !asSections && (
                            <p class="ag-step__title">
                                <Inline md={s.title} />
                            </p>
                        )}
                        <Prose md={s.md} />
                    </div>
                </li>
            ))}
        </ol>
    );
}

export interface RecordRow {
    id?: string;
    chips?: Array<{ label: string; tone?: Tone }>;
    title: string;
    detail?: string;
    extra?: Fact[];
}

export function RecordList({ groups }: { groups: Array<{ label?: string; tone?: Tone; rows: RecordRow[] }> }) {
    return (
        <div class="ag-records">
            {groups.map((g, gi) => (
                <div key={g.label ?? gi} class="ag-records__group">
                    {g.label && (
                        <h3 class="ag-records__label">
                            <StatusChip label={g.label} tone={g.tone} />
                            <span class="ag-records__n">{g.rows.length}</span>
                        </h3>
                    )}
                    <ul class="ag-records__rows">
                        {g.rows.map((r, i) => (
                            <li key={r.id || i} class="ag-record">
                                {r.id && <span class="ag-record__id">{r.id}</span>}
                                <div class="ag-record__main">
                                    <p class="ag-record__title">
                                        <Inline md={r.title} />
                                    </p>
                                    {r.detail && (
                                        <p class="ag-record__detail">
                                            <Inline md={r.detail} />
                                        </p>
                                    )}
                                    {r.extra && r.extra.length > 0 && (
                                        <dl class="ag-record__extra">
                                            {r.extra.map((e) => (
                                                <div key={e.label}>
                                                    <dt>{e.label}</dt>
                                                    <dd>
                                                        <Inline md={e.value} />
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}
                                </div>
                                {r.chips && r.chips.length > 0 && (
                                    <span class="ag-record__chips">
                                        {r.chips.map((c) => (
                                            <StatusChip key={c.label} label={c.label} tone={c.tone} />
                                        ))}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export interface CheckRow {
    checked: boolean;
    id: string;
    text: string;
    tags: string[];
}

export function CheckGroup({ title, items }: { title: string; items: CheckRow[] }) {
    const done = items.filter((i) => i.checked).length;
    return (
        <section class="ag-checks">
            <div class="ag-section__head">
                <h2 id={slugify(title)} class="ag-checks__title">
                    {title}
                </h2>
                <span class={`ag-checks__count${done === items.length ? ' ag-checks__count--done' : ''}`}>
                    {done}/{items.length}
                </span>
            </div>
            <ul class="ag-checks__items">
                {items.map((item, i) => (
                    <li key={item.id || i} class={`ag-check${item.checked ? ' ag-check--done' : ''}`}>
                        <span class="ag-check__box" aria-hidden="true">
                            {item.checked ? '✓' : ''}
                        </span>
                        <span class="sr-only">{item.checked ? 'Checked: ' : 'Not checked: '}</span>
                        <div class="ag-check__main">
                            <p class="ag-check__text">
                                <Inline md={item.text} />
                            </p>
                            {(item.id || item.tags.length > 0) && (
                                <p class="ag-check__tags">
                                    {item.id && <span class="ag-check__id">{item.id}</span>}
                                    {item.tags.map((t) => (
                                        <span key={t} class="ag-tag">
                                            {t}
                                        </span>
                                    ))}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export interface FactCardProps {
    eyebrow?: string;
    title: string;
    chip?: { label: string; tone?: Tone };
    lead?: string;
    fields?: Fact[];
    body?: string;
    tone?: Tone;
    badge?: string;
    /** A card that stands for a whole section carries the section heading, so the contents list finds it. */
    asSection?: boolean;
}

export function FactCard({ eyebrow, title, chip, lead, fields, body, tone, badge, asSection }: FactCardProps) {
    const Heading = asSection ? 'h2' : 'h3';
    return (
        <article class={`ag-card${tone ? ` ag-card--${tone}` : ''}`}>
            <header class="ag-card__head">
                {eyebrow && <span class="ag-card__eyebrow">{eyebrow}</span>}
                <Heading id={asSection ? slugify(title) : undefined} class="ag-card__title">
                    <Inline md={title} />
                </Heading>
                {badge && <StatusChip label={badge} tone={tone} />}
                {chip && <StatusChip label={chip.label} tone={chip.tone} />}
            </header>
            {lead && (
                <p class="ag-card__lead">
                    <Inline md={lead} />
                </p>
            )}
            {fields && fields.length > 0 && (
                <dl class="ag-card__fields">
                    {fields.map((f) => (
                        <div key={f.label} class="ag-card__field">
                            <dt>{f.label}</dt>
                            <dd>
                                <Prose md={f.value} />
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {body && <Prose md={body} />}
        </article>
    );
}

export function CardGrid({ children, wide }: { children: ComponentChildren; wide?: boolean }) {
    return <div class={`ag-grid${wide ? ' ag-grid--wide' : ''}`}>{children}</div>;
}
