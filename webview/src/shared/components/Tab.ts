/**
 * Tab component — individual tab button for navigation.
 *
 * CSS classes: .step-tab, .related-tab, .overview-tab
 */

import { Component } from '../component';

export type TabVariant = 'step' | 'related' | 'overview';

export interface TabProps {
    /** Tab label text */
    label: string;
    /** Visual variant determines CSS class */
    variant: TabVariant;
    /** Whether this tab is currently active/selected */
    active?: boolean;
    /** Whether this tab is disabled */
    disabled?: boolean;
    /** data-phase or data-doc attribute value */
    dataKey?: string;
    /** Additional CSS classes (e.g., 'exists', 'viewing', 'working') */
    stateClasses?: string[];
    /** Slot for child elements (status icon, badges) rendered before the label */
    beforeLabel?: string;
    /** Slot for child elements rendered after the label */
    afterLabel?: string;
    /** Click handler */
    onClick?: () => void;
}

const VARIANT_CLASS: Record<TabVariant, string> = {
    step: 'step-tab',
    related: 'related-tab',
    overview: 'overview-tab',
};

const DATA_ATTR: Record<TabVariant, string> = {
    step: 'data-phase',
    related: 'data-doc',
    overview: 'data-doc',
};

export class Tab extends Component<TabProps> {
    constructor(props: TabProps) {
        super(props, { tag: 'button' });
        this.syncClasses();
    }

    protected render(): string {
        const { label, beforeLabel, afterLabel, dataKey, disabled } = this.props;
        const dataAttr = DATA_ATTR[this.props.variant];
        if (dataKey) this.el.setAttribute(dataAttr, dataKey);
        if (disabled) {
            (this.el as HTMLButtonElement).disabled = true;
        } else {
            (this.el as HTMLButtonElement).disabled = false;
        }
        this.syncClasses();
        return `${beforeLabel ?? ''}<span class="step-label">${label}</span>${afterLabel ?? ''}`;
    }

    protected onMount(): void {
        if (this.props.onClick) {
            this.listen(this.el, 'click', this.props.onClick);
        }
    }

    private syncClasses(): void {
        const base = VARIANT_CLASS[this.props.variant];
        const active = this.props.active ? 'active' : '';
        const disabled = this.props.disabled ? 'disabled' : '';
        const extra = this.props.stateClasses?.join(' ') ?? '';
        this.el.className = [base, active, disabled, extra].filter(Boolean).join(' ');
    }
}
