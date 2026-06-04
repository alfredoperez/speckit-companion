import type { ComponentChildren, JSX } from 'preact';

/**
 * Card primitive — the container shape every ActivityPanel card was
 * independently reinventing via `.activity-card` + custom header/body
 * markup. Lifted here so the structure is one place.
 *
 * Slots:
 *   - `title`    — header text (rendered as `<h3 class="card-title">`)
 *   - `actions`  — optional header-right buttons (e.g. "Run refinement")
 *   - `children` — body content (the existing card-body markup)
 *
 * The component intentionally doesn't impose padding or border colors —
 * those live in `_primitives.css` (additive partial added in this phase) and
 * cards inherit the existing `.activity-card` look for visual continuity.
 */
export interface CardProps extends Omit<JSX.HTMLAttributes<HTMLElement>, 'title'> {
    title?: ComponentChildren;
    actions?: ComponentChildren;
    children?: ComponentChildren;
    /** Add extra class names without losing the base `.card` class. */
    class?: string;
}

export function Card({ title, actions, children, class: cls, ...rest }: CardProps) {
    const className = ['card', cls].filter(Boolean).join(' ');
    return (
        <section class={className} {...rest}>
            {(title !== undefined || actions !== undefined) && (
                <header class="card-header">
                    {title !== undefined && <h3 class="card-title">{title}</h3>}
                    {actions !== undefined && <div class="card-actions">{actions}</div>}
                </header>
            )}
            <div class="card-body">{children}</div>
        </section>
    );
}
