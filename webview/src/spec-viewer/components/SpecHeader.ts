/**
 * SpecHeader — structured header with badge, date, title, branch.
 * Replaces the spec-header update portion of updateNavState().
 */

import { Component } from '../../shared/component';
import type { NavState } from '../types';
import { viewerStore } from '../viewerStore';
import { escapeHtml } from '../markdown';

export interface SpecHeaderProps {
    navState: NavState;
}

export class SpecHeader extends Component<SpecHeaderProps> {
    private unsubscribe: (() => void) | null = null;

    constructor(props: SpecHeaderProps) {
        super(props, { className: 'spec-header' });
    }

    protected render(): string {
        const ns = this.props.navState;
        const hasContext = !!(ns.badgeText || ns.specContextName);
        this.el.setAttribute('data-has-context', String(hasContext));

        if (!ns.badgeText && !ns.createdDate && !ns.specContextName) {
            return '';
        }

        const docTypeLabel = ns.docTypeLabel || 'Spec';
        const titleText = ns.specContextName
            ? `<span class="spec-header-doctype">${escapeHtml(docTypeLabel)}:</span> ${escapeHtml(ns.specContextName)}`
            : '';

        const branchHtml = ns.branch
            ? `<span class="spec-header-branch"><span class="branch-icon">&#xea68;</span> ${escapeHtml(ns.branch)}</span>`
            : '';

        return `<div class="spec-header-row-1">
                ${ns.badgeText ? `<span class="spec-badge">${escapeHtml(ns.badgeText)}</span>` : ''}
                ${ns.createdDate ? `<span class="spec-date"><span class="meta-label">Created:</span> <span class="meta-date">${escapeHtml(ns.createdDate)}</span></span>` : ''}
            </div>
            ${titleText ? `<div class="spec-header-title">${titleText}</div>` : ''}
            ${branchHtml ? `<div class="spec-header-row-3">${branchHtml}</div>` : ''}
            <hr class="spec-header-separator">`;
    }

    protected onMount(): void {
        this.unsubscribe = viewerStore.on('navState', (ns) => {
            if (ns) this.update({ navState: ns });
        });
    }

    protected onUnmount(): void {
        this.unsubscribe?.();
    }
}
