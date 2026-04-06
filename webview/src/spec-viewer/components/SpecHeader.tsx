import { navState } from '../signals';

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function SpecHeader() {
    const ns = navState.value;
    if (!ns) return null;

    const hasContext = !!(ns.badgeText || ns.specContextName);
    if (!ns.badgeText && !ns.createdDate && !ns.specContextName) return null;

    const docTypeLabel = ns.docTypeLabel || 'Spec';

    return (
        <div class="spec-header" data-has-context={String(hasContext)}>
            <div class="spec-header-row-1">
                {ns.badgeText && <span class="spec-badge">{ns.badgeText}</span>}
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
