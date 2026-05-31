import { useCallback } from 'preact/hooks';
import type { ViewerToExtensionMessage, VSCodeApi } from '../../spec-viewer/types';

/**
 * Typed dispatcher hook for sending messages from the webview to the
 * extension. Wraps `vscode.postMessage(...)` so:
 *   - the message type is enforced by TS (no string typos),
 *   - the global `vscode` handle stops appearing inline in every
 *     component (41 callsites today — `useDispatch()` is the entry
 *     point for future cross-cutting concerns like logging, dedupe,
 *     rate-limiting),
 *   - tests can stub one hook return value rather than every callsite.
 *
 * The hook is intentionally trivial today. Its value is establishing
 * the pattern so Phases 5b/5c/5d's new components don't add more inline
 * `vscode.postMessage` references.
 */
declare const vscode: VSCodeApi;

export function useDispatch(): (msg: ViewerToExtensionMessage) => void {
    return useCallback((msg: ViewerToExtensionMessage) => {
        vscode.postMessage(msg);
    }, []);
}
