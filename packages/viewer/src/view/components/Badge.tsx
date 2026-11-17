/**
 * Visual + semantic variant.
 *
 *   - `status`      — spec lifecycle pill (active / tasks-done / completed /
 *                     archived). Pair with `status` prop to drive the colour
 *                     via the `.spec-badge--<status>` modifier class.
 *   - `stale`       — staleness indicator on out-of-date sub-specs.
 *   - `passthrough` — render as a plain `<span>` carrying only the caller's
 *                     `class` prop. Used by the consolidation sweep that
 *                     wraps CSS-only badges (`.activity-status-pill`,
 *                     `.activity-actor-badge`, `.task-row__status`) so they
 *                     funnel through this component for grep-ability while
 *                     keeping their existing pixel-tuned styling intact.
 *
 * Round-4 audit flagged CSS-only badge reimplementations that bypass this
 * component. The `passthrough` variant routes those through Badge — a
 * future visual-design pass can unify the look by migrating each from
 * `passthrough` to `status` (or a new variant) when the styling is ready.
 */
export type BadgeVariant = 'status' | 'stale' | 'passthrough';

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
    const base =
        variant === 'stale' ? 'stale-badge'
        : variant === 'passthrough' ? ''
        : 'spec-badge';
    const statusClass = variant === 'status' && status ? `spec-badge--${status}` : '';
    const className = [base, statusClass, cls].filter(Boolean).join(' ');
    return <span class={className}>{text}</span>;
}
