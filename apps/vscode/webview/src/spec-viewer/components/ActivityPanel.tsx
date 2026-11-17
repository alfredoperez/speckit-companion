import { ActivityPanel as ViewerActivityPanel, ViewerSlotsContext, useViewerSlots } from 'speckit-viewer/view';
import { InstallBanner } from './InstallBanner';

/** The package's Activity panel with the extension's install banner, for a panel rendered outside `App`. */
export function ActivityPanel() {
    const slots = useViewerSlots();
    return (
        <ViewerSlotsContext.Provider value={{ ...slots, installBanner: slots.installBanner ?? <InstallBanner /> }}>
            <ViewerActivityPanel />
        </ViewerSlotsContext.Provider>
    );
}
