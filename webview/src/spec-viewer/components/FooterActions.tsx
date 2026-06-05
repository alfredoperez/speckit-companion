import { useState, useEffect } from 'preact/hooks';
import { navState, viewerState } from '../signals';
import { GeneratingFooter } from './footer/GeneratingFooter';
import { CatalogFooter } from './footer/CatalogFooter';

// How long to show "Generating…" before falling back to an enabled footer so
// the UI never strands. Generous — the manual "Mark step complete" button
// covers faster recovery.
const RECOVERY_TIMEOUT_MS = 10 * 60 * 1000;

export interface FooterActionsProps {
    initialSpecStatus: string;
}

/**
 * The footer is a pure function of one `viewerState` snapshot (INV-1). Every
 * decision — status, button catalog, the generating gate, the recovery-timeout
 * anchor, button labels — reads from `viewerState`; the only `navState` read is
 * the workflow-derived `enhancementButtons`, which is auxiliary (it can never
 * hide a still-valid lifecycle button). Exactly two render shapes exist:
 * `CatalogFooter` and `GeneratingFooter` (INV-4).
 */
export function FooterActions(_props: FooterActionsProps) {
    const vs = viewerState.value;
    const ns = navState.value;

    const [, forceTick] = useState(0);

    // Generating gate — derived entirely from viewerState. `runningStepStartedAt`
    // is non-null iff a step is in flight, so it doubles as the "is running" flag.
    const startedAt = vs?.runningStepStartedAt ?? null;
    const artifactReady = vs?.runningStepArtifactReady ?? false;
    const startedAtMs = startedAt ? Date.parse(startedAt) : NaN;
    const timedOut = !Number.isNaN(startedAtMs) && Date.now() - startedAtMs > RECOVERY_TIMEOUT_MS;
    const isGenerating = !!startedAt && !artifactReady && !timedOut;

    // Re-render once the recovery window elapses, even with no new viewerState.
    useEffect(() => {
        if (!isGenerating || Number.isNaN(startedAtMs)) return;
        const remaining = startedAtMs + RECOVERY_TIMEOUT_MS - Date.now();
        if (remaining <= 0) return;
        const t = setTimeout(() => forceTick(v => v + 1), remaining);
        return () => clearTimeout(t);
    }, [isGenerating, startedAtMs]);

    if (!vs) return null;

    if (isGenerating) {
        return <GeneratingFooter vs={vs} />;
    }

    const status = vs.status;
    // The spec is still active (so refinement/enhancement buttons may show) until
    // it reaches the closure gate. CatalogFooter additionally suppresses them once
    // the footer offers a closure action.
    const isActive = status !== 'implemented' && status !== 'completed' && status !== 'archived';
    const enhancementButtons = ns?.enhancementButtons ?? [];

    return <CatalogFooter vs={vs} isActive={isActive} enhancementButtons={enhancementButtons} />;
}
