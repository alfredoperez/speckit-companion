import { App as ViewerApp, ViewerSlotsContext, type ViewerSlots } from 'speckit-viewer/view';
import { ReportPage } from './report-pages/ReportPage';
import { StaleBanner } from './components/StaleBanner';
import { RemovedDocBanner } from './components/RemovedDocBanner';
import { FooterActions } from './components/FooterActions';
import { InstallBanner } from './components/InstallBanner';
import { navState } from './signals';
import { restoreComments, clearAllRefinements } from './editor';

export interface AppProps {
    specStatus: string;
}

/** The package viewer, with the parts only the extension has plugged into its slots. */
export function App({ specStatus }: AppProps) {
    const report = navState.value?.report;
    const slots: ViewerSlots = {
        banners: (
            <>
                <RemovedDocBanner />
                <StaleBanner />
            </>
        ),
        footer: <FooterActions initialSpecStatus={specStatus} />,
        reportPage: report?.page ? () => <ReportPage report={{ ...report, page: report.page! }} /> : undefined,
        installBanner: <InstallBanner />,
        // A doc switch or reload replaces innerHTML: clear stale mounts, then re-anchor the comments.
        onRendered: () => {
            clearAllRefinements();
            restoreComments();
        },
        onReviewCommentsChanged: restoreComments,
    };
    return (
        <ViewerSlotsContext.Provider value={slots}>
            <ViewerApp />
        </ViewerSlotsContext.Provider>
    );
}
