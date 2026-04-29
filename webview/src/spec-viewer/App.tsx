import { useRef, useEffect, useState } from 'preact/hooks';
import { NavigationBar } from './components/NavigationBar';
import { StaleBanner } from './components/StaleBanner';
import { SpecHeader } from './components/SpecHeader';
import { FooterActions } from './components/FooterActions';
import { TimelinePanel } from './components/TimelinePanel';
import { markdownHtml, navState, timelineVisible } from './signals';

export interface AppProps {
    specStatus: string;
}

export function App({ specStatus }: AppProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const html = markdownHtml.value;
    const ns = navState.value;
    const showTimeline = timelineVisible.value;
    const [hasMountedTimeline, setHasMountedTimeline] = useState(false);
    useEffect(() => {
        if (showTimeline) setHasMountedTimeline(true);
    }, [showTimeline]);

    // After Preact sets innerHTML via dangerouslySetInnerHTML,
    // fire a custom event so highlighting/mermaid can run
    useEffect(() => {
        if (html && contentRef.current) {
            contentRef.current.dispatchEvent(new CustomEvent('content-rendered'));
        }
    }, [html]);

    // Mirror spec-context presence onto <body> so CSS can hide the first H1
    // even though .spec-header is no longer a sibling of #markdown-content.
    useEffect(() => {
        const has = !!(ns?.specContextName || ns?.badgeText);
        document.body.dataset.hasSpecContext = has ? 'true' : 'false';
    }, [ns?.specContextName, ns?.badgeText]);

    return (
        <>
            <nav class="compact-nav">
                <NavigationBar />
            </nav>
            <StaleBanner />
            <SpecHeader />
            <main class="content-area" id="content-area">
                <div
                    id="markdown-content"
                    ref={contentRef}
                    dangerouslySetInnerHTML={{ __html: html }}
                    hidden={showTimeline}
                />
                {hasMountedTimeline && (
                    <div hidden={!showTimeline}>
                        <TimelinePanel />
                    </div>
                )}
                <aside class="spec-toc" id="spec-toc" aria-label="Table of contents" hidden={showTimeline}></aside>
            </main>
            <FooterActions initialSpecStatus={specStatus} />
        </>
    );
}
