/**
 * Input component — text inputs and textareas.
 *
 * CSS classes: .refine-input, .inline-edit-input, .spec-editor-textarea
 */

import { Component } from '../component';

export type InputVariant = 'refine' | 'inline-edit' | 'editor';

export interface InputProps {
    /** Input variant (determines CSS class) */
    variant?: InputVariant;
    /** Placeholder text */
    placeholder?: string;
    /** Initial value */
    value?: string;
    /** DOM id */
    id?: string;
    /** Whether to use textarea instead of input */
    multiline?: boolean;
    /** Called when value changes */
    onChange?: (value: string) => void;
    /** Called on Enter key (single-line only) */
    onSubmit?: (value: string) => void;
    /** Called on Escape key */
    onCancel?: () => void;
}

const VARIANT_CLASS: Record<InputVariant, string> = {
    refine: 'refine-input',
    'inline-edit': 'inline-edit-input',
    editor: 'spec-editor-textarea',
};

export class Input extends Component<InputProps> {
    constructor(props: InputProps) {
        const variant = props.variant ?? 'refine';
        const tag = props.multiline ? 'textarea' : 'input';
        super(props, { tag, className: VARIANT_CLASS[variant] });
    }

    protected render(): string {
        const { placeholder, value, id } = this.props;
        const el = this.el as HTMLInputElement | HTMLTextAreaElement;
        if (id) el.id = id;
        if (placeholder) el.placeholder = placeholder;
        if (value !== undefined) el.value = value;
        if (!this.props.multiline) {
            (el as HTMLInputElement).type = 'text';
        }
        // Return empty — the input element IS the root, no innerHTML needed
        return '';
    }

    protected onMount(): void {
        const el = this.el as HTMLInputElement | HTMLTextAreaElement;

        if (this.props.onChange) {
            const onChange = this.props.onChange;
            this.listen(el, 'input', () => onChange(el.value));
        }

        this.listen(el, 'keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !this.props.multiline && this.props.onSubmit) {
                e.preventDefault();
                this.props.onSubmit(el.value);
            }
            if (e.key === 'Escape' && this.props.onCancel) {
                e.preventDefault();
                this.props.onCancel();
            }
        });
    }

    /** Get current input value. */
    getValue(): string {
        return (this.el as HTMLInputElement | HTMLTextAreaElement).value;
    }

    /** Set input value programmatically. */
    setValue(value: string): void {
        (this.el as HTMLInputElement | HTMLTextAreaElement).value = value;
    }

    /** Focus the input. */
    focus(): void {
        this.el.focus();
    }
}
