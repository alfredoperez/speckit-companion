import type { Preview } from '@storybook/preact';
import { navState } from '../webview/src/spec-viewer/signals';

// Import all spec-viewer CSS
import '../webview/styles/spec-viewer/index.css';
// Codicon font so file-ref icons render in stories (the real viewer loads this
// from the extension; without it the glyph shows as an empty square).
import '@vscode/codicons/dist/codicon.css';

// Font variables shared by both themes (mirrors the author's editor settings).
const sharedFontVars: Record<string, string> = {
    '--vscode-font-family': "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    '--vscode-editor-font-family': "'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
    '--vscode-editor-font-size': '12px',
};

// Extracted from the locally-installed Bearded Theme (beardedbear.beardedtheme)
// so stories render in the palette the extension is actually developed against.
// Keys the theme doesn't define fall back to its nearest surface/accent,
// mirroring VS Code's own derivation.
const beardedMonokaiBlack: Record<string, string> = {
    '--vscode-editor-background': '#141414',
    '--vscode-editor-foreground': '#c7c7c7',
    '--vscode-foreground': '#adadad',
    '--vscode-sideBar-background': '#0e0e0e',
    '--vscode-editorWidget-background': '#212121',
    '--vscode-editorWidget-border': '#2e2e2e',
    '--vscode-list-hoverBackground': '#3b3b3b4d',
    '--vscode-descriptionForeground': '#c7c7c780',
    '--vscode-disabledForeground': '#c7c7c74d',
    '--vscode-focusBorder': '#474747',
    '--vscode-contrastBorder': '#00000000',
    '--vscode-button-background': '#8f8f8f80',
    '--vscode-button-foreground': '#c7c7c7',
    '--vscode-button-hoverBackground': '#8f8f8f99',
    '--vscode-button-secondaryBackground': '#262626',
    '--vscode-button-secondaryForeground': '#c7c7c7cc',
    '--vscode-button-secondaryHoverBackground': '#2e2e2e',
    '--vscode-button-secondaryBorder': '#262626',
    '--vscode-charts-green': '#a9dc76',
    '--vscode-charts-blue': '#78dce8',
    '--vscode-charts-yellow': '#ffd866',
    // Sidebar and tree surface, read verbatim from the theme rather than
    // derived: the Specs-sidebar recreation draws a whole VS Code pane, and a
    // near-miss on the section header reads as the wrong product.
    '--vscode-sideBar-foreground': '#adadadcc',
    '--vscode-sideBarSectionHeader-background': '#0e0e0e',
    '--vscode-sideBarSectionHeader-foreground': '#c7c7c7',
    '--vscode-sideBarSectionHeader-border': '#050505',
    '--vscode-sideBarTitle-foreground': '#545454',
    '--vscode-icon-foreground': '#adadadab',
    '--vscode-list-warningForeground': '#ffd866',
    '--vscode-list-errorForeground': '#fc6a67',
    '--vscode-list-inactiveSelectionBackground': '#3b3b3b40',
    '--vscode-tree-indentGuidesStroke': '#54545470',
    '--vscode-checkbox-background': '#1a1a1a',
    '--vscode-checkbox-border': '#3a3a3a',
    '--vscode-editor-lineHighlightBackground': '#1073cf2d',
    '--vscode-editorError-foreground': '#fc6a67',
    '--vscode-editorWarning-foreground': '#ffd866',
    '--vscode-input-background': '#1a1a1a',
    '--vscode-input-border': '#3a3a3a',
    '--vscode-input-foreground': '#c7c7c7',
    '--vscode-input-placeholderForeground': '#616161',
    '--vscode-inputValidation-errorBackground': '#212121',
    '--vscode-inputValidation-errorBorder': '#ffd866',
    '--vscode-inputValidation-infoBackground': '#212121',
    '--vscode-inputValidation-infoBorder': '#8f8f8f',
    '--vscode-inputValidation-warningBackground': '#212121',
    '--vscode-keybindingLabel-background': '#212121',
    '--vscode-panel-border': '#050505',
    '--vscode-symbolIcon-classForeground': '#ee9d28',
    '--vscode-testing-iconPassed': '#a9dc76',
    '--vscode-textCodeBlock-background': '#78dce833',
    '--vscode-textLink-foreground': '#78dce8',
    '--vscode-textPreformat-foreground': '#ffd866',
    '--vscode-toolbar-hoverBackground': '#5454544d',
    '--vscode-widget-border': '#2e2e2e',
};

const beardedVividLight: Record<string, string> = {
    '--vscode-editor-background': '#f4f4f4',
    '--vscode-editor-foreground': '#181818',
    '--vscode-foreground': '#000000',
    '--vscode-sideBar-background': '#ebebeb',
    '--vscode-editorWidget-background': '#f9f9f9',
    '--vscode-editorWidget-border': '#dbdbdb',
    '--vscode-list-hoverBackground': '#8a8a8a1a',
    '--vscode-descriptionForeground': '#181818cc',
    '--vscode-disabledForeground': '#1818184d',
    '--vscode-focusBorder': '#c1c1c1',
    '--vscode-contrastBorder': '#00000000',
    '--vscode-button-background': '#7e7e7e80',
    '--vscode-button-foreground': '#000000',
    '--vscode-button-hoverBackground': '#7e7e7e99',
    '--vscode-button-secondaryBackground': '#e2e2e2',
    '--vscode-button-secondaryForeground': '#181818',
    '--vscode-button-secondaryHoverBackground': '#dbdbdb',
    '--vscode-button-secondaryBorder': '#e2e2e2',
    '--vscode-charts-green': '#00ac39',
    '--vscode-charts-blue': '#0099ff',
    '--vscode-charts-yellow': '#d48700',
    '--vscode-sideBar-foreground': '#000000cc',
    '--vscode-sideBarSectionHeader-background': '#ebebeb',
    '--vscode-sideBarSectionHeader-foreground': '#181818',
    '--vscode-sideBarSectionHeader-border': '#cecece',
    '--vscode-sideBarTitle-foreground': '#8a8a8a',
    '--vscode-icon-foreground': '#000000ab',
    '--vscode-list-warningForeground': '#FFB638',
    '--vscode-list-errorForeground': '#D62C2C',
    '--vscode-list-inactiveSelectionBackground': '#8a8a8a26',
    '--vscode-tree-indentGuidesStroke': '#8a8a8a70',
    '--vscode-checkbox-background': '#f9f9f9',
    '--vscode-checkbox-border': '#c1c1c1',
    '--vscode-editor-lineHighlightBackground': '#1073cf2d',
    '--vscode-editorError-foreground': '#D62C2C',
    '--vscode-editorWarning-foreground': '#d48700',
    '--vscode-input-background': '#f9f9f9',
    '--vscode-input-border': '#c1c1c1',
    '--vscode-input-foreground': '#181818',
    '--vscode-input-placeholderForeground': '#a8a8a8',
    '--vscode-inputValidation-errorBackground': '#f9f9f9',
    '--vscode-inputValidation-errorBorder': '#d48700',
    '--vscode-inputValidation-infoBackground': '#f9f9f9',
    '--vscode-inputValidation-infoBorder': '#7e7e7e',
    '--vscode-inputValidation-warningBackground': '#f9f9f9',
    '--vscode-keybindingLabel-background': '#f9f9f9',
    '--vscode-panel-border': '#cecece',
    '--vscode-symbolIcon-classForeground': '#d67e00',
    '--vscode-testing-iconPassed': '#00ac39',
    '--vscode-textCodeBlock-background': '#28a9ff33',
    '--vscode-textLink-foreground': '#28A9FF',
    '--vscode-textPreformat-foreground': '#3b2600',
    '--vscode-toolbar-hoverBackground': '#8a8a8a4d',
    '--vscode-widget-border': '#dbdbdb',
};

interface StoryTheme {
    bodyClass: 'vscode-dark' | 'vscode-light' | 'vscode-high-contrast';
    vars: Record<string, string>;
}

const themes: Record<string, StoryTheme> = {
    'monokai-black': { bodyClass: 'vscode-dark', vars: beardedMonokaiBlack },
    'vivid-light': { bodyClass: 'vscode-light', vars: beardedVividLight },
    'high-contrast': {
        bodyClass: 'vscode-high-contrast',
        vars: {
            ...beardedMonokaiBlack,
            '--vscode-editor-background': '#000000',
            '--vscode-editor-foreground': '#ffffff',
            '--vscode-foreground': '#ffffff',
            '--vscode-sideBar-background': '#000000',
            '--vscode-sideBar-foreground': '#ffffff',
            '--vscode-sideBarSectionHeader-background': '#000000',
            '--vscode-sideBarSectionHeader-foreground': '#ffffff',
            '--vscode-sideBarSectionHeader-border': '#ffffff',
            '--vscode-sideBarTitle-foreground': '#ffffff',
            '--vscode-icon-foreground': '#ffffff',
            '--vscode-editorWidget-background': '#000000',
            '--vscode-contrastBorder': '#ffffff',
            '--vscode-focusBorder': '#ffff00',
            '--vscode-panel-border': '#ffffff',
        },
    },
};

// Mock vscode API
(window as any).vscode = {
    postMessage: (msg: unknown) => console.log('[vscode.postMessage]', msg),
    getState: () => undefined,
    setState: () => {},
};

const preview: Preview = {
    globalTypes: {
        vscodeTheme: {
            description: 'VS Code color theme applied to stories',
            toolbar: {
                title: 'Theme',
                icon: 'paintbrush',
                items: [
                    { value: 'monokai-black', title: 'Bearded Monokai Black (dark)' },
                    { value: 'vivid-light', title: 'Bearded Vivid Light (light)' },
                    { value: 'high-contrast', title: 'VS Code High Contrast' },
                ],
                dynamicTitle: true,
            },
        },
    },
    initialGlobals: {
        vscodeTheme: 'monokai-black',
    },
    parameters: {
        options: {
            // Surface the Markdown Rendering catalog first under Viewer, grouped
            // by the tab/artifact it appears in.
            storySort: {
                order: [
                    'Viewer',
                    ['Markdown Rendering', ['Spec', 'Plan', 'Tasks', 'Artifacts']],
                    'Primitives',
                    'SpecEditor',
                    // Video capture stories sort last: they are frames for the
                    // YouTube series, not a component catalog.
                    'Video Capture',
                ],
            },
        },
    },
    decorators: [
        (Story, context) => {
            // Reset navState signal before each story
            navState.value = null;

            const theme = themes[context.globals.vscodeTheme as string] ?? themes['monokai-black'];

            // tokens.css and highlighting.ts key off body.vscode-dark/-light,
            // so the class must live on <body>, not just the wrapper div.
            document.body.classList.remove('vscode-dark', 'vscode-light', 'vscode-high-contrast');
            document.body.classList.add(theme.bodyClass);

            // tokens.css declares its tokens on :root, and a custom property's
            // var(--vscode-*) resolves where the property is DECLARED — so the
            // theme variables must live on :root too, or every token silently
            // takes its fallback (washed-out headings in light mode).
            const rootStyle = document.documentElement.style;
            Object.entries({ ...sharedFontVars, ...theme.vars }).forEach(([k, v]) => {
                rootStyle.setProperty(k, v);
            });

            // A story that declares `parameters.capture = { width, height }` is
            // a video frame, not a catalog entry: it gets an exact-pixel box
            // with no padding, so a screenshot of the preview iframe IS the
            // frame. See webview/src/spec-viewer/__stories__/captureFrame.tsx.
            const capture = context.parameters?.capture as
                | { width: number; height: number }
                | undefined;

            const shellStyle = capture
                ? `background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); width: ${capture.width}px; height: ${capture.height}px; padding: 0; margin: 0; overflow: hidden;`
                : 'background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); min-height: 100vh; padding: 16px;';

            return (
                <div class={theme.bodyClass} style={shellStyle}>
                    <Story />
                </div>
            );
        },
    ],
};

export default preview;
