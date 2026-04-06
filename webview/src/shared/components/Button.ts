/**
 * Button component — wraps all button variants used across webviews.
 *
 * Renders the same CSS classes as the existing markup:
 *   .primary, .secondary, .ghost, .enhancement
 */

import { Component } from '../component';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'enhancement';

export interface ButtonProps {
    /** Button label text */
    label: string;
    /** Visual variant */
    variant?: ButtonVariant;
    /** Optional icon (HTML string, e.g. codicon span or emoji) */
    icon?: string;
    /** DOM id attribute */
    id?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Tooltip text */
    tooltip?: string;
    /** data-command attribute (for enhancement buttons) */
    command?: string;
    /** Click handler */
    onClick?: () => void;
}

export class Button extends Component<ButtonProps> {
    constructor(props: ButtonProps) {
        super(props, { tag: 'button', className: props.variant ?? 'secondary' });
    }

    protected render(): string {
        const { label, icon, id, disabled, tooltip, command } = this.props;
        if (id) this.el.id = id;
        if (disabled) {
            (this.el as HTMLButtonElement).disabled = true;
        } else {
            (this.el as HTMLButtonElement).disabled = false;
        }
        if (tooltip) this.el.title = tooltip;
        if (command) this.el.dataset.command = command;
        this.el.className = this.props.variant ?? 'secondary';

        return icon
            ? `<span class="icon">${icon}</span>${label}`
            : label;
    }

    protected onMount(): void {
        if (this.props.onClick) {
            this.listen(this.el, 'click', this.props.onClick);
        }
    }
}
