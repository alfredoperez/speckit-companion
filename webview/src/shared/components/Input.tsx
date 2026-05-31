import type { JSX } from 'preact';

/**
 * Visual variant — chosen by the consuming context. Each variant maps to
 * an existing CSS class that defines its padding, font, and focus ring.
 *
 *   - `refine`      The refine modal / popover input. Compact, single line.
 *   - `inline-edit` The line-edit overlay (click `+` on a markdown line).
 *                   Same height as a markdown line so the overlay sits flush.
 *   - `editor`      The spec-editor draft textarea. Multi-line, full-width.
 *
 * Variant naming is intentionally semantic (where the input is used) rather
 * than visual (small/medium/large) because the design system pins each
 * variant to one usage. New visual styles get a new semantic variant; new
 * usages reach for an existing variant that fits.
 */
export type InputVariant = 'refine' | 'inline-edit' | 'editor';

const VARIANT_CLASS: Record<InputVariant, string> = {
    refine: 'refine-input',
    'inline-edit': 'inline-edit-input',
    editor: 'spec-editor-textarea',
};

export interface InputProps extends Omit<JSX.HTMLAttributes<HTMLInputElement>, 'class'> {
    /**
     * Which usage context the input is rendered in. Drives the CSS class
     * the component applies. Defaults to `refine` for back-compat with the
     * original single-variant signature.
     */
    variant?: InputVariant;
}

export function Input({ variant = 'refine', ...rest }: InputProps) {
    return <input type="text" class={VARIANT_CLASS[variant]} {...rest} />;
}
