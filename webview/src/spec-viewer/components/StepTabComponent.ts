/**
 * StepTab — a single step in the navigation bar (Spec, Plan, Tasks).
 * Composes Tab primitive with step-specific state logic.
 */

import { Component } from '../../shared/component';
import type { VSCodeApi, SpecDocument, StalenessMap } from '../types';

declare const vscode: VSCodeApi;

export interface StepTabProps {
    doc: SpecDocument;
    index: number;
    totalSteps: number;
    currentDoc: string;
    workflowPhase: string;
    taskCompletionPercent: number;
    isViewingRelatedDoc: boolean;
    parentPhaseForRelated: string;
    activeStep?: string | null;
    stepHistory?: Record<string, { completedAt?: string | null }>;
    stalenessMap?: StalenessMap;
    hasRelatedChildren?: boolean;
}

export class StepTabComponent extends Component<StepTabProps> {
    constructor(props: StepTabProps) {
        super(props, { tag: 'button' });
        this.syncState();
    }

    protected render(): string {
        const { doc, taskCompletionPercent, index, totalSteps } = this.props;
        const isLastStep = index === totalSteps - 1;
        const inProgress = isLastStep && taskCompletionPercent > 0 && taskCompletionPercent < 100;
        const exists = this.isExists();
        const statusIcon = inProgress ? `${taskCompletionPercent}%` : (exists ? '✓' : '');
        const isStale = this.props.stalenessMap?.[doc.type]?.isStale ?? false;
        const staleBadge = isStale ? '<span class="stale-badge">!</span>' : '';

        return `<span class="step-status">${statusIcon}</span>
            <span class="step-label">${doc.label}</span>${staleBadge}`;
    }

    protected onMount(): void {
        this.listen(this.el, 'click', () => {
            if ((this.el as HTMLButtonElement).disabled) return;
            const phase = this.props.doc.type;
            if (phase !== 'done') {
                vscode.postMessage({ type: 'stepperClick', phase });
            }
        });
    }

    update(newProps: Partial<StepTabProps>): void {
        super.update(newProps);
        this.syncState();
    }

    private isExists(): boolean {
        return this.props.doc.exists || !!this.props.hasRelatedChildren;
    }

    private syncState(): void {
        const { doc, index, totalSteps, currentDoc, workflowPhase,
            taskCompletionPercent, isViewingRelatedDoc, parentPhaseForRelated,
            activeStep, stepHistory } = this.props;

        const phase = doc.type;
        const exists = this.isExists();
        const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
        const isLastStep = index === totalSteps - 1;
        const inProgress = isLastStep && taskCompletionPercent > 0 && taskCompletionPercent < 100;
        const isReviewing = isViewing && exists && phase !== workflowPhase && !isViewingRelatedDoc;
        const isTasksActive = isLastStep && isViewing && inProgress;
        const isStale = this.props.stalenessMap?.[phase]?.isStale ?? false;
        const isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt;
        const isClickable = exists || index === 0;

        const classes = [
            'step-tab',
            exists ? 'exists' : '',
            isReviewing ? 'reviewing' : (isViewing ? 'viewing' : ''),
            isTasksActive ? 'tasks-active' : '',
            workflowPhase === phase && !isViewing ? 'workflow' : '',
            isWorking ? 'working' : '',
            !isClickable ? 'disabled' : '',
            inProgress && !isTasksActive ? 'in-progress' : '',
            isStale ? 'stale' : '',
        ].filter(Boolean).join(' ');

        this.el.className = classes;
        this.el.setAttribute('data-phase', phase);
        (this.el as HTMLButtonElement).disabled = !isClickable;
    }
}
