import { Component, type ComponentChildren } from 'preact';
import type { VSCodeApi } from '../types';

declare const vscode: VSCodeApi;

interface Props {
    children?: ComponentChildren;
}

interface State {
    hasError: boolean;
}

/**
 * Catches render-time errors in the Activity panel subtree so one bad card
 * can't blank the whole panel. Posts the error to the extension's output
 * channel for diagnostics; renders an inline notice in place of the panel.
 */
export class ActivityErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error): void {
        try {
            vscode.postMessage({
                type: 'webviewError',
                source: 'activity-panel',
                message: String(error?.message ?? error),
                stack: error?.stack,
            });
        } catch {
            // postMessage can fail during teardown — swallow; the inline
            // notice is enough user-facing signal.
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div class="activity-error">
                    Activity panel hit an error — see the SpecKit Companion output channel.
                </div>
            );
        }
        return this.props.children;
    }
}
