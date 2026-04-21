import { useRef, useEffect } from 'preact/hooks';
import { NavigationBar } from './components/NavigationBar';
import { StaleBanner } from './components/StaleBanner';
import { SpecHeader } from './components/SpecHeader';
import { FooterActions } from './components/FooterActions';
import { markdownHtml } from './signals';

export interface AppProps {
    specStatus: string;
}

export function App({ specStatus }: AppProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const html = markdownHtml.value;

    // After Preact sets innerHTML via dangerouslySetInnerHTML,
    // fire a custom event so highlighting/mermaid can run
    useEffect(() => {
        if (html && contentRef.current) {
            contentRef.current.dispatchEvent(new CustomEvent('content-rendered'));
        }
    }, [html]);

    return (
        <>
            <nav class="compact-nav">
                <NavigationBar />
            </nav>
            <StaleBanner />
            <main class="content-area" id="content-area">
                <SpecHeader />
                <div
                    id="markdown-content"
                    ref={contentRef}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </main>
            <FooterActions initialSpecStatus={specStatus} />
        </>
    );
}
