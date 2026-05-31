/**
 * Visual + semantic variant.
 *
 *   - `status` — spec lifecycle pill (active / tasks-done / completed /
 *                archived). Pair with `status` prop to drive the colour
 *                via the `.spec-badge--<status>` modifier class.
 *   - `stale`  — staleness indicator on out-of-date sub-specs.
 *
 * Round-4 audit flagged CSS-only badge reimplementations (`.activity-status-pill`,
 * `.activity-actor-badge`, `.task-row__status`) that bypass this component.
 * Phase 21 is the consolidation sweep that replaces those raw spans with
 * `<Badge>` so there's one place that defines what a badge looks like.
 */
export type BadgeVariant = 'status' | 'stale';

export interface BadgeProps {
    /** Pill text. Kept short — long values truncate in tight layouts. */
    text: string;
    /**
     * Semantic variant — defaults to `status`. See `BadgeVariant` doc above.
     */
    variant?: BadgeVariant;
    /**
     * Status modifier (e.g. `active`, `archived`, `completed`, `tasks-done`).
     * Only meaningful when `variant === 'status'`; ignored otherwise.
     * Maps to the CSS class `.spec-badge--<status>`.
     */
    status?: string;
    /** Extra class names; merged onto the variant + status classes. */
    class?: string;
}

export function Badge({ text, variant = 'status', status, class: cls }: BadgeProps) {
    const base = variant === 'stale' ? 'stale-badge' : 'spec-badge';
    const statusClass = variant === 'status' && status ? `spec-badge--${status}` : '';
    const className = [base, statusClass, cls].filter(Boolean).join(' ');
    return <span class={className}>{text}</span>;
}
