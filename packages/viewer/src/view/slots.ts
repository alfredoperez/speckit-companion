import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/** What a host adds to the shared view. The element leaves them all empty. */
export interface ViewerSlots {
    /** Above the document, under the rail's column. */
    banners?: ComponentChildren;
    /** Below the shell. */
    footer?: ComponentChildren;
    /** Replaces the rendered document when the navigation state carries a report page. */
    reportPage?: (report: unknown) => ComponentChildren;
    /** At the top of the Overview. */
    installBanner?: ComponentChildren;
    /** Runs after each document render, once the HTML is in the page. */
    onRendered?: () => void;
    /** Runs when the persisted review comments change. */
    onReviewCommentsChanged?: () => void;
}

export const ViewerSlotsContext = createContext<ViewerSlots>({});

export const useViewerSlots = (): ViewerSlots => useContext(ViewerSlotsContext);
