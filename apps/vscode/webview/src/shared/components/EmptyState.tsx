import type { ComponentChildren, JSX } from 'preact';

/**
 * EmptyState primitive — the "no data yet" panel shape.
 *
 * Today every empty-list message is a plain `<div>No activity recorded
 * yet</div>` or similar inline markup. This primitive gives all empties a
 * consistent look + accessible role (`status`), and a slot for an optional
 * action affordance (e.g. "Create your first spec" CTA on the sidebar's
 * blank state).
 */
export interface EmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {
    /** Optional leading icon (emoji or icon component) rendered above the label. */
    icon?: ComponentChildren;
    label: string;
    /** Optional sub-text under the label (1–2 lines). */
    description?: string;
    /** Optional CTA — typically a `<Button>` instance from the shared layer. */
    action?: ComponentChildren;
    class?: string;
}

export function EmptyState({ icon, label, description, action, class: cls, ...rest }: EmptyStateProps) {
    const className = ['empty-state', cls].filter(Boolean).join(' ');
    return (
        <div class={className} role="status" {...rest}>
            {icon && <div class="empty-state-icon" aria-hidden="true">{icon}</div>}
            <div class="empty-state-label">{label}</div>
            {description && <div class="empty-state-description">{description}</div>}
            {action && <div class="empty-state-action">{action}</div>}
        </div>
    );
}
