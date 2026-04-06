/**
 * TabBar component — container for a row of Tab components.
 *
 * CSS classes: .step-tabs, .related-tabs
 */

import { Component } from '../component';

export type TabBarVariant = 'step' | 'related';

export interface TabBarProps {
    variant: TabBarVariant;
}

const VARIANT_CLASS: Record<TabBarVariant, string> = {
    step: 'step-tabs',
    related: 'related-tabs',
};

export class TabBar extends Component<TabBarProps> {
    constructor(props: TabBarProps) {
        super(props, { className: VARIANT_CLASS[props.variant] });
    }

    protected render(): string {
        // Children are mounted by the parent component into this.el
        return '';
    }
}
