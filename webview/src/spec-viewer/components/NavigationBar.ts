/**
 * NavigationBar — the compact nav bar containing step tabs and connectors.
 * Replaces the step-tabs portion of updateNavState().
 */

import { Component } from '../../shared/component';
import { StepTabComponent } from './StepTabComponent';
import type { NavState, SpecDocument, VSCodeApi } from '../types';
import { viewerStore } from '../viewerStore';

declare const vscode: VSCodeApi;

export interface NavigationBarProps {
    navState: NavState;
}

export class NavigationBar extends Component<NavigationBarProps> {
    private stepTabs: StepTabComponent[] = [];
    private unsubscribe: (() => void) | null = null;

    constructor(props: NavigationBarProps) {
        super(props, { className: 'nav-primary' });
    }

    protected render(): string {
        return '<div class="step-tabs"></div>';
    }

    protected onMount(): void {
        this.rebuildTabs();
        this.unsubscribe = viewerStore.on('navState', (ns) => {
            if (ns) this.updateFromNavState(ns);
        });
    }

    protected onUnmount(): void {
        this.unsubscribe?.();
    }

    private updateFromNavState(navState: NavState): void {
        const { coreDocs } = navState;

        // If document count changed, rebuild tabs
        if (coreDocs.length !== this.stepTabs.length) {
            this.props.navState = navState;
            this.el.innerHTML = this.render();
            this.rebuildTabs();
            return;
        }

        // Otherwise update existing tabs
        const commonProps = this.buildCommonProps(navState);
        for (let i = 0; i < this.stepTabs.length; i++) {
            const doc = coreDocs[i];
            const hasRelatedChildren = navState.relatedDocs.some(d => d.parentStep === doc.type);
            this.stepTabs[i].update({
                doc,
                ...commonProps,
                index: i,
                hasRelatedChildren,
            });
        }
    }

    private rebuildTabs(): void {
        const container = this.query('.step-tabs')!;
        this.stepTabs.forEach(t => t.unmount());
        this.stepTabs = [];

        const navState = this.props.navState;
        const { coreDocs } = navState;
        const commonProps = this.buildCommonProps(navState);

        for (let i = 0; i < coreDocs.length; i++) {
            const doc = coreDocs[i];
            const hasRelatedChildren = navState.relatedDocs.some(d => d.parentStep === doc.type);
            const tab = new StepTabComponent({
                doc,
                ...commonProps,
                index: i,
                hasRelatedChildren,
            });
            tab.mount(container);
            this.stepTabs.push(tab);
            this.addChild(tab);

            // Connector between steps
            if (i < coreDocs.length - 1) {
                const connector = document.createElement('span');
                const exists = doc.exists || hasRelatedChildren;
                connector.className = `step-connector ${exists ? 'filled' : ''}`;
                container.appendChild(connector);
            }
        }
    }

    private buildCommonProps(navState: NavState) {
        const { coreDocs, relatedDocs, currentDoc, workflowPhase,
            taskCompletionPercent, isViewingRelatedDoc, activeStep,
            stepHistory, stalenessMap } = navState;

        const viewingRelatedDoc = isViewingRelatedDoc
            ? relatedDocs.find(d => d.type === currentDoc)
            : undefined;
        const parentPhaseForRelated = viewingRelatedDoc?.parentStep || coreDocs?.[0]?.type || 'spec';

        return {
            totalSteps: coreDocs.length,
            currentDoc,
            workflowPhase,
            taskCompletionPercent,
            isViewingRelatedDoc,
            parentPhaseForRelated,
            activeStep,
            stepHistory,
            stalenessMap,
        };
    }
}
