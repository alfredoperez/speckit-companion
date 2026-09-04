import { useCallback } from 'preact/hooks';
import type { ViewerToExtensionMessage } from '../../../../src/protocol/viewer';

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
 * Generic over the protocol it sends. This hook was written for future webviews
 * to share, but its message type was pinned to the spec viewer's — so a second
 * webview could not have used it without widening the viewer's own union. The
 * default keeps every existing call site unchanged.
 */
declare const vscode: { postMessage: (message: unknown) => void };

export function useDispatch<M extends { type: string } = ViewerToExtensionMessage>(): (msg: M) => void {
    return useCallback((msg: M) => {
        vscode.postMessage(msg);
    }, []);
}
