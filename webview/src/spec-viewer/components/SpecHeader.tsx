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

    const hasContext = !!(badgeText || ns.specContextName);
    if (!badgeText && !ns.createdDate && !ns.specContextName) return null;

    const docTypeLabel = ns.docTypeLabel || 'Spec';

    return (
        <div class="spec-header" data-has-context={String(hasContext)}>
            <div class="spec-header-row-1">
                {badgeText && <span class="spec-badge">{badgeText}</span>}
                {ns.createdDate && (
                    <span class="spec-date">
                        <span class="meta-label">Created:</span>{' '}
                        <span class="meta-date">{ns.createdDate}</span>
                    </span>
                )}
            </div>
            {ns.specContextName && (
                <div class="spec-header-title">
                    <span class="spec-header-doctype">{docTypeLabel}:</span>{' '}
                    {ns.specContextName}
                </div>
            )}
            {ns.branch && (
                <div class="spec-header-row-3">
                    <span class="spec-header-branch">
                        <span class="branch-icon">{'\uea68'}</span> {ns.branch}
                    </span>
                </div>
            )}
            <hr class="spec-header-separator" />
        </div>
    );
}
