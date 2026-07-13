import { useRef, useEffect, useState } from 'preact/hooks';
import { NavigationBar } from './components/NavigationBar';
import { StaleBanner } from './components/StaleBanner';
import { SpecHeader } from './components/SpecHeader';
import { FooterActions } from './components/FooterActions';
import { ActivityPanel, hasAnyData } from './components/ActivityPanel';
import { ActivityErrorBoundary } from './components/ActivityErrorBoundary';
import { RunAside } from './components/RunAside';
import { markdownHtml, navState, viewerMode, viewerState } from './signals';
import { restoreComments, clearAllRefinements } from './editor';

export interface AppProps {
    specStatus: string;
}

export function App({ specStatus }: AppProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const html = markdownHtml.value;
    const ns = navState.value;
    const vs = viewerState.value;
    const reviewComments = vs?.reviewComments;

    // Shell view: Overview (the run's story) is the landing view when the
    // spec has recorded activity; documents otherwise. Living mode and a
    // disabled activity panel always read as documents.
    const living = !!ns?.livingMode;
    const activityEnabled = ns?.activityPanelEnabled ?? true;
    const overviewAvailable = activityEnabled && !living && !!vs && hasAnyData(vs);
    const mode = viewerMode.value ?? (overviewAvailable ? 'overview' : 'document');
    const showOverview = mode === 'overview' && overviewAvailable;

    const [hasMountedActivity, setHasMountedActivity] = useState(false);
    useEffect(() => {
        if (showOverview) setHasMountedActivity(true);
    }, [showOverview]);

    // After Preact sets innerHTML via dangerouslySetInnerHTML,
    // fire a custom event so highlighting/mermaid can run
    useEffect(() => {
        if (html && contentRef.current) {
            contentRef.current.dispatchEvent(new CustomEvent('content-rendered'));
        }
    }, [html]);

    // Restore persisted review comments inline. A doc switch / reload replaces
    // innerHTML, so clear stale in-memory mounts first, then re-anchor. The
    // second effect catches the viewerState that lands after the first paint
    // and any live add/remove/refine updates (restoreComments is idempotent).
    useEffect(() => {
        if (html && contentRef.current) {
            clearAllRefinements();
            restoreComments();
        }
    }, [html]);
    useEffect(() => {
        if (html && contentRef.current) restoreComments();
    }, [reviewComments]);

    // Mirror spec-context presence onto <body> so CSS can hide the first H1
    // even though .spec-header is no longer a sibling of #markdown-content.
    useEffect(() => {
        const has = !!(ns?.specContextName || ns?.badgeText);
        document.body.dataset.hasSpecContext = has ? 'true' : 'false';
    }, [ns?.specContextName, ns?.badgeText]);

    return (
        <>
            <SpecHeader />
            <StaleBanner />
            {living && (
                <nav class="compact-nav">
                    <NavigationBar />
                </nav>
            )}
            <div class={`shell-grid${living ? ' shell-grid--no-rail' : ''}`}>
                {!living && <NavigationBar />}
                <main class="content-area" id="content-area">
                    <div
                        id="markdown-content"
                        ref={contentRef}
                        dangerouslySetInnerHTML={{ __html: html }}
                        hidden={showOverview}
                    />
                    {hasMountedActivity && (
                        <div class="overview-pane" hidden={!showOverview}>
                            <ActivityErrorBoundary>
                                <ActivityPanel />
                            </ActivityErrorBoundary>
                        </div>
                    )}
                    <aside class="spec-toc" id="spec-toc" aria-label="Table of contents" hidden={showOverview}></aside>
                </main>
                {!living && <RunAside />}
            </div>
            <FooterActions initialSpecStatus={specStatus} />
        </>
    );
}
