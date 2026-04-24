import { navState, viewerState } from '../signals';

function formatStatusLabel(status: string): string {
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

    const docTypeLabel = ns.docTypeLabel || 'Spec';

    return (
        <div class="spec-header" data-has-context={String(hasContext)}>
            {(badgeText || ns.branch || ns.createdDate) && (
                <div class="spec-header-badges">
                    {badgeText && (
                        <span class={`spec-badge${statusClass ? ` spec-badge--${statusClass}` : ''}`}>
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
                        <span class="spec-header-date">{ns.createdDate}</span>
                    )}
                </div>
            )}
            {ns.specContextName && (
                <div class="spec-header-main">
                    <span class="spec-header-title">
                        <span class="spec-header-doctype">{docTypeLabel}:</span>{' '}
                        {ns.specContextName}
                    </span>
                </div>
            )}
        </div>
    );
}
