import { navState, viewerMode } from '../signals';
import { parseInline } from '../markdown/inline';
import { revealRequirement } from '../toc';
import { ApproveSpecButton, LivingCovers } from './SpecHeader';
import type { VSCodeApi } from '../types';

declare const vscode: VSCodeApi;

/** The living spec's landing: purpose, covers, health and the requirement list, from what the header and cards already parse. */
export function LivingOverview() {
    const ns = navState.value;
    const overview = ns?.livingOverview;
    if (!ns || !overview) return null;
    const meta = ns.livingMeta ?? null;
    const { purpose, requirements } = overview;
    const adopted = requirements.filter(r => r.adopted).length;

    const open = (heading: string) => {
        if (ns.currentDoc === 'spec') {
            viewerMode.value = 'document';
            vscode.postMessage({ type: 'documentChosen' });
            requestAnimationFrame(() => revealRequirement(heading));
        } else if (meta) {
            vscode.postMessage({
                type: 'openLivingSpec',
                capabilityName: meta.capabilityName,
                specPath: meta.specPath,
                requirement: heading,
            });
        } else {
            viewerMode.value = 'document';
            vscode.postMessage({ type: 'switchDocument', documentType: 'spec' });
        }
    };

    return (
        <div class="activity-panel dossier living-overview">
            {purpose && (
                <section class="dossier-section" aria-label="Purpose">
                    <p class="dossier-kicker">Purpose</p>
                    {purpose.split(/\n\s*\n/).map((para, i) => (
                        <p key={i} class="living-overview__purpose" dangerouslySetInnerHTML={{ __html: parseInline(para.trim()) }} />
                    ))}
                </section>
            )}
            {meta && (
                <section class="dossier-section" aria-label="Covers">
                    <p class="dossier-kicker">Covers</p>
                    <LivingCovers meta={meta} />
                </section>
            )}
            <section class="dossier-section" aria-label="Health">
                <p class="dossier-kicker">Health</p>
                <ul class="living-overview__health">
                    {meta?.coverage && (
                        <li>{meta.coverage.covered} of {meta.coverage.total} requirements have a mapped test</li>
                    )}
                    {meta?.drifted !== undefined && (
                        <li class={meta.drifted ? 'living-overview__drift' : undefined}>
                            {meta.drifted ? 'Source files changed since this spec was last updated' : 'In step with the code'}
                        </li>
                    )}
                    {requirements.length > 0 && <li class="living-overview__adopted">
                        {adopted > 0 ? (
                            <>
                                <span><strong class="living-overview__ink">{adopted} of {requirements.length}</strong> requirements still adopted, unconfirmed</span>
                                <ApproveSpecButton documentType="spec" />
                            </>
                        ) : (
                            `Every one of ${requirements.length} requirements confirmed`
                        )}
                    </li>}
                </ul>
            </section>
            <section class="dossier-section" aria-label="Requirements">
                <p class="dossier-kicker">Requirements</p>
                <ol class="living-overview__reqs">
                    {requirements.map(r => (
                        <li key={r.heading}>
                            <button type="button" class="living-overview__req" onClick={() => open(r.heading)}>
                                {r.adopted && <span class="living-overview__pip" role="img" title="Adopted, not yet confirmed" aria-label="adopted"></span>}
                                {r.heading}
                            </button>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
