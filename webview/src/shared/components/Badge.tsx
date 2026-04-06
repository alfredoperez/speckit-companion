export type BadgeVariant = 'status' | 'stale';

export interface BadgeProps {
    text: string;
    variant?: BadgeVariant;
    class?: string;
}

export function Badge({ text, variant = 'status', class: cls }: BadgeProps) {
    const base = variant === 'stale' ? 'stale-badge' : 'spec-badge';
    const className = [base, cls].filter(Boolean).join(' ');
    return <span class={className}>{text}</span>;
}
