import { useRef, useEffect, useState } from 'preact/hooks';
import { NavigationBar } from './components/NavigationBar';
import { StaleBanner } from './components/StaleBanner';
import { PageChrome } from './components/PageChrome';
import { FooterActions } from './components/FooterActions';
import { ActivityPanel, hasAnyData, hasDurableContext } from './components/ActivityPanel';
import { ActivityErrorBoundary } from './components/ActivityErrorBoundary';
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

    // The Overview exists only when the spec has a recorded run to show — no
    // `.spec-context.json` (or nothing in it), no Overview, and the viewer is
    // just its documents. It's the landing view when it exists, and the rail
    // owns the selection between it and the documents.
    const living = !!ns?.livingMode;
    const activityEnabled = ns?.activityPanelEnabled ?? true;
    const overviewAvailable = activityEnabled && !living && !!vs && hasAnyData(vs);
    // Land on the Overview only when it has durable context to show; a spec
    // carrying nothing but a work log opens on its documents.
    const landing = overviewAvailable && hasDurableContext(vs!) ? 'overview' : 'document';
    const showOverview = overviewAvailable && (viewerMode.value ?? landing) === 'overview';

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
            <PageChrome />
            {living && (
                <nav class="compact-nav">
                    <NavigationBar />
                </nav>
            )}
            <div class={`shell-grid${living ? ' shell-grid--no-rail' : ''}`}>
                {!living && <NavigationBar />}
                <div class="main-column">
                    {/* Staleness is a fact about the DOCUMENT you're reading, with a
                        document-scoped action — so it lives over the document, not
                        across the whole window behind the rail. */}
                    <StaleBanner />
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
                </div>
            </div>
            <FooterActions initialSpecStatus={specStatus} />
        </>
    );
}
