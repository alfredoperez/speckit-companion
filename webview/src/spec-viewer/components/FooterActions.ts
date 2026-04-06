/**
 * FooterActions — footer bar with action buttons.
 * Replaces the footer portion of updateNavState() and setupFooterActions().
 */

import { Component } from '../../shared/component';
import type { NavState, EnhancementButton, VSCodeApi } from '../types';
import { viewerStore } from '../viewerStore';

declare const vscode: VSCodeApi;

export interface FooterActionsProps {
    navState: NavState;
    specStatus: string;
    enhancementButtons: EnhancementButton[];
}

export class FooterActions extends Component<FooterActionsProps> {
    private unsubscribe: (() => void) | null = null;

    constructor(props: FooterActionsProps) {
        super(props, { tag: 'footer', className: 'actions' });
    }

    protected render(): string {
        const { specStatus, enhancementButtons } = this.props;
        const ns = this.props.navState;

        // Enhancement buttons in left area
        const enhancementHtml = (ns.footerState?.enhancementButtons ?? enhancementButtons).map((btn, i) =>
            `<button class="enhancement" data-command="${btn.command}" title="${btn.tooltip || ''}" id="enhance-${i}">
                <span class="icon">${btn.icon}</span>
                ${btn.label}
            </button>`
        ).join('');

        // Determine right-side buttons from spec status
        const status = ns.footerState?.specStatus || ns.specStatus || specStatus;
        const isTasksDone = status === 'tasks-done';
        const isCompleted = status === 'completed';
        const isArchived = status === 'archived';

        let rightButtons = '';
        if (isArchived || isCompleted) {
            rightButtons = '<button id="reactivateSpec" class="secondary">Reactivate</button>';
        } else if (isTasksDone) {
            rightButtons = '<button id="completeSpec" class="primary">Complete</button>';
        } else {
            const showApprove = ns.footerState?.showApproveButton ?? false;
            const approveText = ns.footerState?.approveText ?? '';
            rightButtons = `<button id="regenerate" class="secondary">Regenerate</button>
                ${showApprove ? `<button id="approve" class="primary">${approveText}</button>` : ''}`;
        }

        return `<div class="actions-left">
                <button id="editSource" class="secondary">Edit Source</button>
                ${!isArchived ? '<button id="archiveSpec" class="secondary">Archive</button>' : ''}
                <span class="action-toast" id="action-toast"></span>
                ${enhancementHtml}
            </div>
            <div class="actions-right">
                ${rightButtons}
            </div>`;
    }

    protected onMount(): void {
        // Delegate all button clicks
        this.listen(this.el, 'click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
            if (!target) return;

            switch (target.id) {
                case 'editSource':
                    vscode.postMessage({ type: 'editSource' });
                    break;
                case 'regenerate':
                    vscode.postMessage({ type: 'regenerate' });
                    break;
                case 'approve':
                    vscode.postMessage({ type: 'approve' });
                    break;
                case 'completeSpec':
                    vscode.postMessage({ type: 'completeSpec' });
                    break;
                case 'archiveSpec':
                    vscode.postMessage({ type: 'archiveSpec' });
                    break;
                case 'reactivateSpec':
                    vscode.postMessage({ type: 'reactivateSpec' });
                    break;
                default:
                    // Enhancement buttons
                    if (target.classList.contains('enhancement')) {
                        const command = target.dataset.command;
                        vscode.postMessage({ type: 'clarify', command });
                    }
                    break;
            }
        });

        this.unsubscribe = viewerStore.on('navState', (ns) => {
            if (ns) this.update({ navState: ns });
        });
    }

    protected onUnmount(): void {
        this.unsubscribe?.();
    }
}
