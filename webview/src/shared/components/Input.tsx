import type { JSX } from 'preact';

export type InputVariant = 'refine' | 'inline-edit' | 'editor';

const VARIANT_CLASS: Record<InputVariant, string> = {
    refine: 'refine-input',
    'inline-edit': 'inline-edit-input',
    editor: 'spec-editor-textarea',
};

export interface InputProps extends Omit<JSX.HTMLAttributes<HTMLInputElement>, 'class'> {
    variant?: InputVariant;
}

export function Input({ variant = 'refine', ...rest }: InputProps) {
    return <input type="text" class={VARIANT_CLASS[variant]} {...rest} />;
}
