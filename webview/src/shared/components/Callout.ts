/**
 * Callout component — styled alert/info boxes.
 *
 * CSS classes: .callout, .callout-{type}
 */

import { Component } from '../component';

export type CalloutType = 'purpose' | 'note' | 'tip' | 'checkpoint' | 'warning' | 'important' | 'critical';

export interface CalloutProps {
    /** Callout type determines color/icon */
    type: CalloutType;
    /** Label text (default: type name uppercased) */
    label?: string;
    /** Body content (HTML string) */
    content: string;
}

export class Callout extends Component<CalloutProps> {
    constructor(props: CalloutProps) {
        super(props, { className: `callout callout-${props.type}` });
    }

    protected render(): string {
        const label = this.props.label ?? this.props.type.toUpperCase();
        return `<div class="callout-label">${label}</div>
                <div class="callout-content">${this.props.content}</div>`;
    }
}
