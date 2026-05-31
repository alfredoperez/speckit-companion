import type { JSX } from 'preact';

/**
 * Visual + semantic variant. `destructive` is the danger/delete affordance
 * (red border + error color). Pair with `useInlineConfirm` for the
 * two-click confirm pattern when the destruction is irreversible.
 */
export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'enhancement'
    | 'destructive';

export interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon'> {
    label: string;
    variant?: ButtonVariant;
    icon?: string;
    disabled?: boolean;
    /** Spec 099: render a spinner and force the button disabled (e.g. "Generating…"). */
    loading?: boolean;
}

export function Button({ label, variant = 'secondary', icon, loading, disabled, class: cls, ...rest }: ButtonProps) {
    const className = [variant, loading && 'is-loading', cls].filter(Boolean).join(' ');
    return (
        <button class={className} disabled={disabled || loading} aria-busy={loading} {...rest}>
            {loading && <span class="btn-spinner" aria-hidden="true" />}
            {!loading && icon && <span class="icon">{icon}</span>}
            {label}
        </button>
    );
}
