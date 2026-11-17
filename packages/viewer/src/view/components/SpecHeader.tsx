import { markdownHtml, navState, viewerState } from '../signals';
import { onAction } from '../host';
import { TITLE_PREFIX } from '../../core/specTitle';


// Visible-label overrides for canonical status keys whose default
// hyphen-split capitalization isn't the friendliest reading. Keeps
// on-disk `.spec-context.json` keys unchanged.
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
    tasking: 'Creating Tasks',
    'ready-to-implement': 'Tasks Created',
};

function formatStatusLabel(status: string): string {
    if (STATUS_LABEL_OVERRIDES[status]) return STATUS_LABEL_OVERRIDES[status];
    return status
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** The document's own H1 as a plain title ("Feature Specification: X" becomes "X"), or null. */
export function documentTitle(html: string): string | null {
    const match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (!match) return null;
    const probe = document.createElement('div');
    probe.innerHTML = match[1]!.replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, '');
    const text = (probe.textContent ?? '').replace(/\s+/g, ' ').trim().replace(TITLE_PREFIX, '').trim();
    return text || null;
}

export function SpecHeader() {
    const ns = navState.value;
    const vs = viewerState.value;
    if (!ns) return null;

    const badgeText = vs ? formatStatusLabel(vs.status) : ns.badgeText;
    const statusClass = ns.report?.badgeTone ? `report-${ns.report.badgeTone}` : vs?.status ?? ns.specStatus ?? null;

    const assistantName = ns.assistantName;
    const hasTerminal = !!ns.hasTerminal;

    // The folder slug is an id, not a title. The spec's own title leads on every tab, so the
    // header does not change with the open document; a spec without one names itself by the document.
    const heading = !ns.titleFromHeading ? ns.specTitle ?? documentTitle(markdownHtml.value) : null;
    const title = heading ?? ns.specContextName;
    const idChip = heading && ns.specContextName && heading.toLowerCase() !== ns.specContextName.toLowerCase() ? ns.specContextName : null;

    const hasContext = !!(badgeText || ns.specContextName);
    if (!badgeText && !ns.createdDate && !ns.specContextName) return null;

    return (
        <div class="spec-header" data-has-context={String(hasContext)}>
            <div class="spec-header-row">
                <div class="spec-header-main">
                    {title && (
                        <h1 class="spec-header-title">
                            {title}
                        </h1>
                    )}
                    {(badgeText || ns.branch || ns.createdDate || assistantName || hasTerminal) && (
                        <div class="spec-header-badges">
                            {badgeText && (
                                <span
                                    class={`spec-badge${statusClass ? ` spec-badge--${statusClass}` : ''}`}
                                    title={ns.createdDate ? `${badgeText} · ${ns.createdDate}` : undefined}
                                >
                                    {badgeText}
                                </span>
                            )}
                            {idChip && idChip !== ns.branch && (
                                <span class="spec-header-id" title="Spec folder">{idChip}</span>
                            )}
                            {ns.branch && (
                                <span class="spec-header-branch" title={`Branch: ${ns.branch}`}>
                                    <span class="codicon codicon-git-branch" aria-hidden="true"></span>
                                    <span class="spec-header-branch__name">{ns.branch}</span>
                                </span>
                            )}
                            {ns.createdDate && (
                                <span class="spec-header-date" aria-label={`Created ${ns.createdDate}`}>
                                    {ns.createdDate}
                                </span>
                            )}
                            {assistantName && (
                                <span
                                    class="spec-header-branch spec-header-assistant"
                                    title={`Last sent to ${assistantName}`}
                                >
                                    <span class="codicon codicon-hubot" aria-hidden="true"></span>
                                    <span class="spec-header-branch__name">{assistantName}</span>
                                </span>
                            )}
                            {hasTerminal && (
                                <button
                                    type="button"
                                    class="spec-header-update-btn spec-header-update-btn--quiet spec-header-terminal-btn"
                                    title="Show the terminal this spec is running in"
                                    onClick={() => onAction({ type: 'showTerminal' })}
                                >
                                    <span class="codicon codicon-terminal" aria-hidden="true"></span>
                                    Show terminal
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
