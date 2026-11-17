import { useRef, useEffect, useState } from 'preact/hooks';
import { NavigationBar } from './components/NavigationBar';
import { PageChrome } from './components/PageChrome';
import { ActivityPanel } from './components/ActivityPanel';
import { ActivityErrorBoundary } from './components/ActivityErrorBoundary';
import { markdownHtml, navState, showingOverview, specMoved, viewerState } from './signals';
import { useViewerSlots } from './slots';

/** The viewer's shell: header, rail, document or Overview, table of contents. A host adds its own parts through `ViewerSlotsContext`. */
export function App() {
    const { banners, footer, reportPage, onRendered, onReviewCommentsChanged } = useViewerSlots();
    const contentRef = useRef<HTMLDivElement>(null);
    const html = markdownHtml.value;
    const ns = navState.value;
    const reviewComments = viewerState.value?.reviewComments;

    // The folder is gone: nothing on the rail or in the footer can act on it any more.
    const moved = specMoved.value;
    const showOverview = showingOverview.value && !moved;

    const [hasMountedActivity, setHasMountedActivity] = useState(false);
    useEffect(() => {
        if (showOverview) setHasMountedActivity(true);
    }, [showOverview]);

    // After Preact sets innerHTML, fire a custom event so highlighting can run.
    useEffect(() => {
        if (html && contentRef.current) {
            contentRef.current.dispatchEvent(new CustomEvent('content-rendered'));
        }
    }, [html]);

    useEffect(() => {
        if (html && contentRef.current) onRendered?.();
    }, [html]);
    useEffect(() => {
        if (html && contentRef.current) onReviewCommentsChanged?.();
    }, [reviewComments]);

    // Mirror spec-context presence onto <body> so CSS can hide the first H1
    // even though .spec-header is no longer a sibling of #markdown-content.
    useEffect(() => {
        const has = !!(ns?.specContextName || ns?.badgeText);
        document.body.dataset.hasSpecContext = has ? 'true' : 'false';
    }, [ns?.specContextName, ns?.badgeText]);

    const report = ns?.report;

    return (
        <>
            <PageChrome />
            <div class={`shell-grid${moved ? ' shell-grid--no-rail' : ''}`}>
                {!moved && <NavigationBar />}
                <div class="main-column">
                    {/* Document-scoped: it must not span the rail. */}
                    {banners}
                    <main class="content-area" id="content-area">
                        {report && reportPage ? (
                            <div id="markdown-content" ref={contentRef} hidden={moved}>
                                {reportPage(report)}
                            </div>
                        ) : (
                            <div
                                id="markdown-content"
                                ref={contentRef}
                                dangerouslySetInnerHTML={{ __html: html }}
                                hidden={showOverview || moved}
                            />
                        )}
                        {moved && (
                            <div class="empty-state">This spec folder was moved or deleted. Open it again from the sidebar.</div>
                        )}
                        {hasMountedActivity && (
                            <div class="overview-pane" hidden={!showOverview}>
                                <ActivityErrorBoundary>
                                    <ActivityPanel />
                                </ActivityErrorBoundary>
                            </div>
                        )}
                        <aside class="spec-toc" id="spec-toc" aria-label="Table of contents" hidden={showOverview || moved}></aside>
                    </main>
                </div>
            </div>
            {!moved && footer}
        </>
    );
}
