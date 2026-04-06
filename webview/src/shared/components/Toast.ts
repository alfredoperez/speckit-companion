/**
 * Toast component — auto-fading notification message.
 *
 * CSS classes: .action-toast, .action-toast.visible
 */

import { Component } from '../component';

export interface ToastProps {
    /** DOM id */
    id?: string;
}

export class Toast extends Component<ToastProps> {
    private hideTimeout: number | undefined;

    constructor(props: ToastProps = {}) {
        super(props, { tag: 'span', className: 'action-toast' });
        if (props.id) this.el.id = props.id;
    }

    protected render(): string {
        return '';
    }

    /** Show a message that auto-fades after duration (ms). */
    show(message: string, duration = 2000): void {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        this.el.textContent = message;
        this.el.classList.add('visible');
        this.hideTimeout = window.setTimeout(() => {
            this.el.classList.remove('visible');
        }, duration);
    }

    protected onUnmount(): void {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
    }
}
