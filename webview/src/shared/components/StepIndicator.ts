/**
 * StepIndicator component — circular status indicator for steppers and nav tabs.
 *
 * CSS classes: .step-status (nav tabs), .step-indicator (phase stepper)
 */

import { Component } from '../component';

export type StepIndicatorVariant = 'nav' | 'stepper';

export interface StepIndicatorProps {
    /** Display content: number, checkmark, percentage, etc. */
    content: string;
    /** 'nav' = .step-status (compact), 'stepper' = .step-indicator (larger) */
    variant?: StepIndicatorVariant;
}

export class StepIndicator extends Component<StepIndicatorProps> {
    constructor(props: StepIndicatorProps) {
        const cls = (props.variant ?? 'nav') === 'nav' ? 'step-status' : 'step-indicator';
        super(props, { tag: 'span', className: cls });
    }

    protected render(): string {
        return this.props.content;
    }
}
