import type { JSX } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'enhancement';

export interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon'> {
    label: string;
    variant?: ButtonVariant;
    icon?: string;
}

export function Button({ label, variant = 'secondary', icon, class: cls, ...rest }: ButtonProps) {
    const className = [variant, cls].filter(Boolean).join(' ');
    return (
        <button class={className} {...rest}>
            {icon && <span class="icon">{icon}</span>}
            {label}
        </button>
    );
}
