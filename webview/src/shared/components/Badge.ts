/**
 * Badge component — status, warning, and info badges.
 *
 * CSS classes: .spec-badge, .stale-badge
 */

import { Component } from '../component';

export type BadgeVariant = 'status' | 'stale';

export interface BadgeProps {
    /** Badge text content */
    text: string;
    /** Visual variant */
    variant?: BadgeVariant;
    /** Additional CSS classes */
    className?: string;
}

export class Badge extends Component<BadgeProps> {
    constructor(props: BadgeProps) {
        const variant = props.variant ?? 'status';
        const cls = variant === 'stale' ? 'stale-badge' : 'spec-badge';
        super(props, { tag: 'span', className: `${cls} ${props.className ?? ''}`.trim() });
    }

    protected render(): string {
        return this.props.text;
    }
}
