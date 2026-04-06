import type { Preview } from '@storybook/preact';
import { navState } from '../webview/src/spec-viewer/signals';

// Import all spec-viewer CSS
import '../webview/styles/spec-viewer/index.css';

// VS Code dark theme defaults for Storybook
const vscodeDarkTheme: Record<string, string> = {
    '--vscode-editor-background': '#1e1e1e',
    '--vscode-editor-foreground': '#d4d4d4',
    '--vscode-sideBar-background': '#252526',
    '--vscode-editorWidget-background': '#252526',
    '--vscode-list-hoverBackground': '#2a2d2e',
    '--vscode-descriptionForeground': '#858585',
    '--vscode-disabledForeground': '#6c6c6c',
    '--vscode-focusBorder': '#007fd4',
    '--vscode-button-hoverBackground': '#0062a3',
    '--vscode-button-background': '#0e639c',
    '--vscode-button-foreground': '#ffffff',
    '--vscode-testing-iconPassed': '#388a34',
    '--vscode-editorWarning-foreground': '#cca700',
    '--vscode-editorError-foreground': '#f14c4c',
    '--vscode-panel-border': '#2b2b2b',
    '--vscode-widget-border': '#303031',
    '--vscode-input-background': '#3c3c3c',
    '--vscode-input-foreground': '#cccccc',
    '--vscode-input-border': '#3c3c3c',
    '--vscode-input-placeholderForeground': '#a6a6a6',
};

// Mock vscode API
(window as any).vscode = {
    postMessage: (msg: unknown) => console.log('[vscode.postMessage]', msg),
    getState: () => undefined,
    setState: () => {},
};

const preview: Preview = {
    decorators: [
        (Story) => {
            // Reset navState signal before each story
            navState.value = null;

            // Apply VS Code theme variables
            const style = Object.entries(vscodeDarkTheme)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ');

            return (
                <div
                    class="vscode-dark"
                    style={`${style}; background: #1e1e1e; color: #d4d4d4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; padding: 16px;`}
                >
                    <Story />
                </div>
            );
        },
    ],
};

export default preview;
