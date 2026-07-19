import type { JSX } from 'preact';
import { navState, viewerState } from '../signals';
import type { LivingHeaderMeta } from '../types';

/** How many claimed patterns show inline before the rest move behind "+N more". */
const GLOBS_SHOWN = 3;

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function LivingFacts({ meta }: { meta: LivingHeaderMeta }) {
    const facts: JSX.Element[] = [];

    if (meta.requirements !== undefined) {
        facts.push(
            <span key="requirements" class="spec-header-fact">
                {plural(meta.requirements, 'requirement')}
            </span>
        );
    }
    if (meta.scenarios !== undefined) {
        facts.push(
            <span key="scenarios" class="spec-header-fact">
                {plural(meta.scenarios, 'scenario')}
            </span>
        );
    }
    if (meta.coverage) {
        const coverageLabel =
            `${meta.coverage.covered} of ${meta.coverage.total} requirements have a mapped test`;
        facts.push(
            <span
                key="coverage"
                class="spec-header-fact"
                title={coverageLabel}
                aria-label={coverageLabel}
            >
                {meta.coverage.covered}/{meta.coverage.total} covered
            </span>
        );
    }
    if (meta.drifted) {
        facts.push(
            <span
                key="drift"
                class="spec-header-fact spec-header-fact--drift"
                title="Source files changed since the living spec's last commit"
                aria-label="Source files changed since the living spec's last commit"
            >
                drift
            </span>
        );
    }

    return facts.length > 0 ? <div class="spec-header-living">{facts}</div> : null;
}

function LivingCovers({ meta }: { meta: LivingHeaderMeta }) {
    const shown = meta.match.slice(0, GLOBS_SHOWN);
    const rest = meta.match.slice(GLOBS_SHOWN);

    return (
        <>
            {meta.match.length > 0 && (
                <div class="spec-header-covers">
                    <span class="spec-header-covers__label">Covers</span>
                    {/* Keyed by position: authored globs may repeat, so the value is not unique. */}
                    {shown.map((glob, i) => (
                        <span key={i} class="spec-header-glob" title={glob}>
                            {glob}
                        </span>
                    ))}
                    {rest.length > 0 && (
                        <span
                            class="spec-header-glob spec-header-glob--more"
                            title={rest.join('\n')}
                            aria-label={`Also covers ${rest.join(', ')}`}
                        >
                            +{rest.length} more
                        </span>
                    )}
                </div>
            )}
            <div class="spec-header-location">
                <span
                    class="spec-header-path"
                    title={
                        meta.location === 'colocated'
                            ? 'Lives next to the code it describes'
                            : 'Lives in the central specs folder'
                    }
                >
                    {meta.specPath}
                </span>
            </div>
        </>
    );
}

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

export function SpecHeader() {
    const ns = navState.value;
    const vs = viewerState.value;
    if (!ns) return null;

    const badgeText = vs ? formatStatusLabel(vs.status) : ns.badgeText;
    const statusClass = vs?.status ?? ns.specStatus ?? null;

    const hasContext = !!(badgeText || ns.specContextName);
    if (!badgeText && !ns.createdDate && !ns.specContextName) return null;

    const meta = ns.livingMode ? ns.livingMeta ?? null : null;

    return (
        <div class="spec-header" data-has-context={String(hasContext)}>
            <div class="spec-header-row">
                <div class="spec-header-main">
                    {ns.specContextName && (
                        <h1 class={`spec-header-title${ns.titleFromHeading ? ' spec-header-title--authored' : ''}`}>
                            {ns.specContextName}
                        </h1>
                    )}
                    {(badgeText || ns.branch || ns.createdDate) && (
                        <div class="spec-header-badges">
                            {badgeText && (
                                <span
                                    class={`spec-badge${statusClass ? ` spec-badge--${statusClass}` : ''}`}
                                    title={ns.createdDate ? `${badgeText} · ${ns.createdDate}` : undefined}
                                >
                                    {badgeText}
                                </span>
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
                            {meta && <LivingFacts meta={meta} />}
                        </div>
                    )}
                    {meta && <LivingCovers meta={meta} />}
                </div>
            </div>
        </div>
    );
}
