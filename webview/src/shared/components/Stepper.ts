/**
 * Stepper component — horizontal step indicator with connectors.
 *
 * CSS classes: .phase-stepper, .step, .step-indicator, .step-label, .step-connector
 */

import { Component } from '../component';

export interface StepConfig {
    /** Unique phase key (e.g., 'spec', 'plan', 'tasks', 'done') */
    phase: string;
    /** Display label */
    label: string;
    /** Step indicator content (number, checkmark, percentage) */
    indicator: string;
    /** CSS state class(es): 'completed', 'active', 'in-progress' */
    stateClass?: string;
    /** Whether the connector BEFORE this step is filled */
    connectorFilled?: boolean;
}

export interface StepperProps {
    steps: StepConfig[];
}

export class Stepper extends Component<StepperProps> {
    constructor(props: StepperProps) {
        super(props, { tag: 'nav', className: 'phase-stepper' });
    }

    protected render(): string {
        const { steps } = this.props;
        const parts: string[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const cls = step.stateClass ? `step ${step.stateClass}` : 'step';

            parts.push(`<div class="${cls}" data-phase="${step.phase}">
                <div class="step-indicator">${step.indicator}</div>
                <div class="step-label">${step.label}</div>
            </div>`);

            // Connector between steps
            if (i < steps.length - 1) {
                const nextStep = steps[i + 1];
                const connectorClass = nextStep.connectorFilled ? 'step-connector completed' : 'step-connector';
                parts.push(`<div class="${connectorClass}"></div>`);
            }
        }

        return parts.join('\n');
    }
}
