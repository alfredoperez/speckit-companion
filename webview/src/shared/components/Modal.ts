/**
 * Modal component — backdrop + centered content panel.
 *
 * CSS classes: .refine-backdrop, .refine-popover (reused for any modal)
 */

import { Component } from '../component';

export interface ModalProps {
    /** HTML content for the modal body */
    content: string;
    /** Whether the modal is visible */
    visible?: boolean;
    /** Called when backdrop is clicked */
    onClose?: () => void;
    /** CSS class for the backdrop (default: 'refine-backdrop') */
    backdropClass?: string;
    /** CSS class for the popover (default: 'refine-popover') */
    popoverClass?: string;
    /** DOM id for the backdrop */
    backdropId?: string;
    /** DOM id for the popover */
    popoverId?: string;
}

export class Modal extends Component<ModalProps> {
    constructor(props: ModalProps) {
        super(props);
    }

    protected render(): string {
        const {
            content,
            visible,
            backdropClass = 'refine-backdrop',
            popoverClass = 'refine-popover',
            backdropId,
            popoverId,
        } = this.props;
        const display = visible ? '' : 'style="display: none;"';

        return `<div class="${backdropClass}" ${backdropId ? `id="${backdropId}"` : ''} ${display}></div>
                <div class="${popoverClass}" ${popoverId ? `id="${popoverId}"` : ''} ${display}>${content}</div>`;
    }

    protected onMount(): void {
        if (this.props.onClose) {
            const backdrop = this.query(`.${this.props.backdropClass ?? 'refine-backdrop'}`);
            if (backdrop) {
                this.listen(backdrop, 'click', this.props.onClose);
            }
        }
    }

    show(): void {
        this.queryAll<HTMLElement>('[style*="display: none"]').forEach(el => {
            el.style.display = '';
        });
        const backdrop = this.query(`.${this.props.backdropClass ?? 'refine-backdrop'}`);
        const popover = this.query(`.${this.props.popoverClass ?? 'refine-popover'}`);
        if (backdrop) backdrop.style.display = '';
        if (popover) popover.style.display = '';
    }

    hide(): void {
        const backdrop = this.query(`.${this.props.backdropClass ?? 'refine-backdrop'}`);
        const popover = this.query(`.${this.props.popoverClass ?? 'refine-popover'}`);
        if (backdrop) backdrop.style.display = 'none';
        if (popover) popover.style.display = 'none';
    }
}
