/**
 * The viewer's wire contract lives in the `speckit-viewer` package. The extension binds
 * its own report pages and host-side viewer state here.
 */
import type * as Contract from 'speckit-viewer/contract/viewer';
import type { ViewerState } from '../core/types/specContext';
import type { ReportNav } from '../features/reports/reportPageModel';

export * from 'speckit-viewer/contract/viewer';
export { updateBannerText } from './installBannerBody';

export type NavState = Contract.NavState<ReportNav>;
export type ExtensionToViewerMessage = Contract.ExtensionToViewerMessage<ViewerState, ReportNav>;
