import { NavigationBar } from './components/NavigationBar';
import { RelatedBar } from './components/RelatedBar';
import { StaleBanner } from './components/StaleBanner';
import { SpecHeader } from './components/SpecHeader';
import { FooterActions } from './components/FooterActions';

export interface AppProps {
    specStatus: string;
}

export function App({ specStatus }: AppProps) {
    return (
        <>
            <nav class="compact-nav">
                <NavigationBar />
                <RelatedBar />
            </nav>
            <StaleBanner />
            <main class="content-area" id="content-area">
                <SpecHeader />
                <div id="markdown-content" />
            </main>
            <FooterActions initialSpecStatus={specStatus} />
        </>
    );
}
