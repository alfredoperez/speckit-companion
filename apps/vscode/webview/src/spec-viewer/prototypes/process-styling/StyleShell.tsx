/**
 * The viewer frame every styling direction sits in. Same markup and class
 * names as the real viewer (page-chrome, run-strip, doc-rail, step-tab,
 * actions), so the shipped styles draw it and only the page body differs.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Button } from '../../../shared/components/Button';
import { parseInline, renderMarkdown } from '../../markdown';
import { applyHighlighting } from '../../highlighting';
import { buildToc } from '../../toc';
import { unwrap } from '../artifact-gallery/parse';
import type { RailGroup, RailItem, ShellFooter } from '../processes/ProcessShell';
import type { AnalysisReport, BugStory, IdeaDecision } from './model';

export function Inline({ md }: { md: string }) {
    return <span dangerouslySetInnerHTML={{ __html: parseInline(md) }} />;
}

export function Md({ md, class: cls }: { md: string; class?: string }) {
    if (!md.trim()) return null;
    return <div class={cls ?? 'ps-md'} dangerouslySetInnerHTML={{ __html: renderMarkdown(unwrap(md)) }} />;
}

export interface Chrome {
    title: string;
    badge: { label: string; kind: string };
    path: { icon: string; text: string };
    date: string;
    facts: Array<{ value: string; warning?: boolean }>;
    overview?: boolean;
    groups: RailGroup[];
    active: string;
    footer: ShellFooter;
}

function RailTab({ item, active }: { item: RailItem; active: string }) {
    const pending = item.mark === 'pending';
    const classes = ['step-tab', item.mark === 'done' && 'done', item.id === active && 'current'].filter(Boolean).join(' ');
    return (
        <div class="step-tab-group">
            <button type="button" class={classes} aria-current={item.id === active ? 'page' : undefined} aria-disabled={pending} disabled={pending}>
                {item.mark === 'icon' ? (
                    <span class={`codicon codicon-${item.icon} pp-rail-icon`} aria-hidden="true" />
                ) : (
                    <span class="step-status">{item.mark === 'done' ? '✓' : ''}</span>
                )}
                <span class="step-label">{item.label}</span>
                {item.result && <span class={`pp-step-result pp-tone--${item.tone ?? 'neutral'}`}>{item.result}</span>}
            </button>
            {item.children && item.children.length > 0 && (
                <ul class="step-substeps" aria-label={`${item.label} files`}>
                    {item.children.map((child) => (
                        <li key={child}>
                            <button type="button" class="step-child">
                                {child}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function StyleShell({ chrome, toc, direction, children }: { chrome: Chrome; toc?: boolean; direction: string; children: ComponentChildren }) {
    const area = useRef<HTMLElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const outline = useRef<HTMLElement>(null);
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            if (toc) buildToc(area.current, content.current, outline.current);
        });
        return () => cancelAnimationFrame(id);
    }, [toc]);

    const onOverview = chrome.active === 'overview';
    return (
        <div class={`viewer-container ps-dir ps-dir--${direction}`}>
            <header class="page-chrome">
                <div class="spec-header" data-has-context="true">
                    <div class="spec-header-row">
                        <div class="spec-header-main">
                            <h1 class="spec-header-title">{chrome.title}</h1>
                            <div class="spec-header-badges">
                                <span class={`spec-badge spec-badge--${chrome.badge.kind}`}>{chrome.badge.label}</span>
                                <span class="spec-header-branch" title={chrome.path.text}>
                                    <span class={`codicon codicon-${chrome.path.icon}`} aria-hidden="true" />
                                    <span class="spec-header-branch__name">{chrome.path.text}</span>
                                </span>
                                <span class="spec-header-date">{chrome.date}</span>
                            </div>
                        </div>
                    </div>
                </div>
                {chrome.facts.length > 0 && (
                    <div class="run-strip" aria-label="Context">
                        {chrome.facts.map((f) => (
                            <span key={f.value} class={`run-strip__fact${f.warning ? ' run-strip__fact--warning' : ''}`}>
                                {f.value}
                            </span>
                        ))}
                    </div>
                )}
            </header>
            <div class="shell-grid">
                <nav class="doc-rail" aria-label="Documents">
                    {chrome.overview && (
                        <div class="rail-group">
                            <button type="button" class={`rail-overview${onOverview ? ' current' : ''}`} aria-current={onOverview ? 'page' : undefined}>
                                <span class="codicon codicon-book" aria-hidden="true" />
                                Overview
                            </button>
                        </div>
                    )}
                    {chrome.groups.map((group) => (
                        <div class="rail-group" key={group.label}>
                            <p class="rail-label">{group.label}</p>
                            <div class="step-tabs">
                                {group.items.map((item) => (
                                    <RailTab key={item.id} item={item} active={chrome.active} />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
                <div class="main-column">
                    <main class="content-area" ref={area}>
                        <div id="markdown-content" ref={content} class={toc ? undefined : 'ps-wide'}>
                            {children}
                        </div>
                        {toc && <aside class="spec-toc" ref={outline} aria-label="Table of contents" />}
                    </main>
                </div>
            </div>
            <footer class="actions">
                {chrome.footer.context && <span class="footer-context">{chrome.footer.context}</span>}
                <div class="actions-left">
                    {chrome.footer.left?.map((b) => (
                        <Button key={b.label} label={b.label} variant={b.variant ?? 'secondary'} title={b.title} />
                    ))}
                </div>
                <div class="actions-right">
                    {chrome.footer.right?.map((b) => (
                        <Button key={b.label} label={b.label} variant={b.variant ?? 'secondary'} title={b.title} />
                    ))}
                </div>
            </footer>
        </div>
    );
}

export function bugChrome(bug: BugStory): Chrome {
    return {
        title: bug.title,
        badge: { label: `Fix ${bug.fixStatus}`, kind: 'active' },
        path: { icon: 'bug', text: bug.path },
        date: bug.created,
        facts: [{ value: `${bug.verdict} bug` }, { value: `${bug.severity} severity` }, { value: 'not tested', warning: true }],
        overview: true,
        groups: [
            {
                label: 'Steps',
                items: [
                    { id: 'assessment', label: 'Assess', mark: 'done', result: bug.verdict, tone: 'success' },
                    { id: 'fix', label: 'Fix', mark: 'done', result: bug.fixStatus, tone: 'success' },
                    { id: 'test', label: 'Test', mark: 'pending', result: 'not run', tone: 'neutral' },
                ],
            },
        ],
        active: 'overview',
        footer: {
            context: 'Next: Test fix',
            left: [{ label: 'Fix again', title: bug.fixCommand }],
            right: [{ label: 'Test fix', variant: 'primary', title: bug.testCommand }],
        },
    };
}

export function analysisChrome(report: AnalysisReport): Chrome {
    return {
        title: 'Dark Mode Toggle',
        badge: { label: 'Active', kind: 'active' },
        path: { icon: 'git-branch', text: '001-dark-mode-toggle' },
        date: 'Oct 3, 2026',
        facts: [],
        groups: [
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
                items: [{ id: 'analysis', label: 'Analysis', mark: 'icon', icon: 'search', result: `${report.findings.length} findings`, tone: 'warning' }],
            },
        ],
        active: 'analysis',
        footer: {
            context: 'Next: Implement',
            left: [
                { label: 'Regenerate', title: 'Re-run only the current step' },
                { label: 'Analyze', title: '/speckit-analyze: cross-check spec, plan, and tasks for consistency' },
                { label: 'Other actions' },
            ],
            right: [{ label: 'Implement', variant: 'primary' }],
        },
    };
}

export function ideaChrome(idea: IdeaDecision): Chrome {
    return {
        title: idea.title,
        badge: { label: idea.verdict, kind: 'completed' },
        path: { icon: 'lightbulb', text: idea.path },
        date: idea.decided,
        facts: [],
        groups: [
            {
                label: 'Stages',
                items: ['Intake', 'Research', 'Problem', 'Concept', 'Decision'].map((label) => ({
                    id: label.toLowerCase(),
                    label,
                    mark: 'done' as const,
                    result: label === 'Decision' ? idea.verdict : undefined,
                    tone: 'success' as const,
                })),
            },
        ],
        active: 'decision',
        footer: {
            context: 'Next: Create spec from this idea',
            right: [{ label: 'Create spec from this idea', variant: 'primary', title: 'Opens Create Spec with the handoff filled in' }],
        },
    };
}

export const ANALYSIS_ORIGIN = 'specs/001-dark-mode-toggle/analysis.md';
