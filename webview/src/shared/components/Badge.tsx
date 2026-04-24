export type BadgeVariant = 'status' | 'stale';

export interface BadgeProps {
    text: string;
    variant?: BadgeVariant;
    status?: string;
    class?: string;
}

export function Badge({ text, variant = 'status', status, class: cls }: BadgeProps) {
    const base = variant === 'stale' ? 'stale-badge' : 'spec-badge';
    const statusClass = variant === 'status' && status ? `spec-badge--${status}` : '';
    const className = [base, statusClass, cls].filter(Boolean).join(' ');
    return <span class={className}>{text}</span>;
}
