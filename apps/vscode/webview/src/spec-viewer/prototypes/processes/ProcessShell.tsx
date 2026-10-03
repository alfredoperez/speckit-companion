/**
 * Prototype viewer shell for bugs, ideas and report tabs. It mirrors the real
 * viewer's markup and class names (page-chrome, doc-rail, step-tab, actions) so
 * the shipped styles draw it; nothing the extension loads imports this file.
 */

import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Button, type ButtonVariant } from '../../../shared/components/Button';
import { applyHighlighting } from '../../highlighting';
import { buildToc } from '../../toc';
import { StatusChip, type Tone } from '../artifact-gallery/components';

export interface RailItem {
    id: string;
    label: string;
    mark: 'done' | 'pending' | 'icon';
    icon?: string;
    result?: string;
    tone?: Tone;
    children?: string[];
}

export interface RailGroup {
    label: string;
    items: RailItem[];
}

export interface FooterButton {
    label: string;
    variant?: ButtonVariant;
    title?: string;
}

export interface ShellFooter {
    context?: string;
    left?: FooterButton[];
    right?: FooterButton[];
}

export interface ShellHeader {
    title: string;
    badge?: string;
    chips?: Array<{ kind?: string; label: string; tone?: Tone }>;
    path?: { icon: string; text: string };
    date?: string;
}

export interface ProcessShellProps {
    header: ShellHeader;
    overview?: boolean;
    groups: RailGroup[];
    active: string;
    onSelect: (id: string) => void;
    footer?: ShellFooter;
    /** The landing view spans the reading column and the outline column. */
    wide?: boolean;
    html?: string;
    children?: ComponentChildren;
}

export function Stage({ caption, kind, width, children }: { caption: string; kind: 'viewer' | 'sidebar'; width?: number; children: ComponentChildren }) {
    return (
        <div class={`pp-stage pp-stage--${kind}`} style={width ? `width: ${width}px` : undefined}>
            <p class="pp-caption">
                <span class="pp-caption__tag">Decision</span>
                {caption}
            </p>
            <div class="pp-stage__body">{children}</div>
        </div>
    );
}

function RailTab({ item, active, onSelect }: { item: RailItem; active: string; onSelect: (id: string) => void }) {
    const pending = item.mark === 'pending';
    const classes = ['step-tab', item.mark === 'done' && 'done', item.id === active && 'current'].filter(Boolean).join(' ');
    return (
        <div class="step-tab-group">
            <button
                type="button"
                class={classes}
                data-phase={item.id}
                aria-current={item.id === active ? 'page' : undefined}
                aria-disabled={pending}
                disabled={pending}
                onClick={() => onSelect(item.id)}
            >
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

export function ProcessShell({ header, overview, groups, active, onSelect, footer, wide, html, children }: ProcessShellProps) {
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            if (!wide) {
                buildToc(document.getElementById('content-area'), document.getElementById('markdown-content'), document.getElementById('spec-toc'));
            }
        });
        return () => cancelAnimationFrame(id);
    }, [active, wide]);

    const onOverview = active === 'overview';
    return (
        <div class="viewer-container">
            <header class="page-chrome">
                <div class="spec-header" data-has-context="true">
                    <div class="spec-header-row">
                        <div class="spec-header-main">
                            <h1 class="spec-header-title">{header.title}</h1>
                            <div class="spec-header-badges">
                                {header.badge && <span class="spec-badge">{header.badge}</span>}
                                {header.chips?.map((c) => (
                                    <StatusChip key={`${c.kind}-${c.label}`} kind={c.kind} label={c.label} tone={c.tone} />
                                ))}
                                {header.path && (
                                    <span class="spec-header-branch" title={header.path.text}>
                                        <span class={`codicon codicon-${header.path.icon}`} aria-hidden="true" />
                                        <span class="spec-header-branch__name">{header.path.text}</span>
                                    </span>
                                )}
                                {header.date && <span class="spec-header-date">{header.date}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <div class="shell-grid">
                <nav class="doc-rail" aria-label="Documents">
                    {overview && (
                        <div class="rail-group">
                            <button
                                type="button"
                                class={`rail-overview${onOverview ? ' current' : ''}`}
                                aria-current={onOverview ? 'page' : undefined}
                                onClick={() => onSelect('overview')}
                            >
                                <span class="codicon codicon-book" aria-hidden="true" />
                                Overview
                            </button>
                        </div>
                    )}
                    {groups.map((group) => (
                        <div class="rail-group" key={group.label}>
                            <p class="rail-label">{group.label}</p>
                            <div class="step-tabs">
                                {group.items.map((item) => (
                                    <RailTab key={item.id} item={item} active={active} onSelect={onSelect} />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
                <div class="main-column">
                    <main class="content-area" id="content-area">
                        {html !== undefined ? (
                            <div id="markdown-content" key={active} dangerouslySetInnerHTML={{ __html: html }} />
                        ) : (
                            <div id="markdown-content" key={active} class={wide ? 'pp-wide' : undefined}>
                                {children}
                            </div>
                        )}
                        {!wide && <aside class="spec-toc" id="spec-toc" key={`toc-${active}`} aria-label="Table of contents" />}
                    </main>
                </div>
            </div>
            {footer && (
                <footer class="actions">
                    {footer.context && <span class="footer-context">{footer.context}</span>}
                    <div class="actions-left">
                        {footer.left?.map((b) => (
                            <Button key={b.label} label={b.label} variant={b.variant ?? 'secondary'} title={b.title} />
                        ))}
                    </div>
                    <div class="actions-right">
                        {footer.right?.map((b) => (
                            <Button key={b.label} label={b.label} variant={b.variant ?? 'secondary'} title={b.title} />
                        ))}
                    </div>
                </footer>
            )}
        </div>
    );
}
