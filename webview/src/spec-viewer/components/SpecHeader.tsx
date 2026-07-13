import { navState, viewerState } from '../signals';

// Visible-label overrides for canonical status keys whose default
// hyphen-split capitalization isn't the friendliest reading. Keeps
// on-disk `.spec-context.json` keys unchanged.
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
    tasking: 'Creating Tasks',
    'ready-to-implement': 'Tasks Created',
};

export function formatStatusLabel(status: string): string {
    if (STATUS_LABEL_OVERRIDES[status]) return STATUS_LABEL_OVERRIDES[status];
    return status
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export function SpecHeader() {
    const ns = navState.value;
    const vs = viewerState.value;
    if (!ns) return null;

    const badgeText = vs ? formatStatusLabel(vs.status) : ns.badgeText;
    const statusClass = vs?.status ?? ns.specStatus ?? null;

    const hasContext = !!(badgeText || ns.specContextName);
    if (!badgeText && !ns.createdDate && !ns.specContextName) return null;

    return (
        <div class="spec-header" data-has-context={String(hasContext)}>
            <div class="spec-header-row">
                <div class="spec-header-main">
                    {ns.specContextName && (
                        <h1 class="spec-header-title">{ns.specContextName}</h1>
                    )}
                    {(badgeText || ns.branch || ns.createdDate) && (
                        <div class="spec-header-badges">
                            {badgeText && (
                                <span
                                    class={`spec-badge${statusClass ? ` spec-badge--${statusClass}` : ''}`}
                                    title={ns.createdDate ? `${badgeText} · ${ns.createdDate}` : badgeText}
                                >
                                    {badgeText}
                                </span>
                            )}
                            {ns.branch && (
                                <span class="spec-header-branch" title={`Branch: ${ns.branch}`}>
                                    <span class="codicon codicon-git-branch" aria-hidden="true"></span>
                                    {ns.branch}
                                </span>
                            )}
                            {ns.createdDate && (
                                <span class="spec-header-date" aria-label={`Created ${ns.createdDate}`}>
                                    {ns.createdDate}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
