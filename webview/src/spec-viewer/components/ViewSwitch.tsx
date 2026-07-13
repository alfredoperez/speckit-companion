import { navState, viewerState, viewerMode } from '../signals';
import { hasAnyData } from './ActivityPanel';

/**
 * Overview/Documents mode switch. Lives at the top of the document rail so it
 * reads as the parent of document navigation and stays reachable when the
 * webview is one side of a VS Code split. Renders only when the Overview view
 * is actually available for this spec.
 */
export function ViewSwitch() {
    const ns = navState.value;
    const vs = viewerState.value;
    if (!ns) return null;

    const living = !!ns.livingMode;
    const activityEnabled = ns.activityPanelEnabled ?? true;
    const overviewAvailable = activityEnabled && !living && !!vs && hasAnyData(vs);
    if (!overviewAvailable) return null;

    const mode = viewerMode.value ?? 'overview';
    const isOverview = mode === 'overview';

    return (
        <div class="view-switch" role="group" aria-label="Viewer mode">
            <button
                type="button"
                class={`view-switch__btn${isOverview ? ' active' : ''}`}
                aria-pressed={isOverview}
                onClick={() => { viewerMode.value = 'overview'; }}
            >
                Overview
            </button>
            <button
                type="button"
                class={`view-switch__btn${!isOverview ? ' active' : ''}`}
                aria-pressed={!isOverview}
                onClick={() => { viewerMode.value = 'document'; }}
            >
                Documents
            </button>
        </div>
    );
}
