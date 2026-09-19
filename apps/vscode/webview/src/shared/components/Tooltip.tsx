import type { ComponentChildren, JSX } from 'preact';

/**
 * Tooltip primitive — minimal, native-title-attribute wrapper.
 *
 * The 20+ `title="…"` attrs scattered across components were each a
 * one-off native tooltip; this primitive exists so future work can swap
 * to a real positioned tooltip (delay, arrow, custom trigger) in one
 * place without touching every callsite.
 *
 * Today this is essentially a typed wrapper around the native attribute —
 * the value is being able to grep for `<Tooltip>` rather than `title=`,
 * and consistent semantics (every label is treated the same way).
 */
export interface TooltipProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'title'> {
    label: string;
    children: ComponentChildren;
}

export function Tooltip({ label, children, ...rest }: TooltipProps) {
    return (
        <span title={label} {...rest}>
            {children}
        </span>
    );
}
