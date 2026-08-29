import type { Preview } from '@storybook/preact';
import { navState } from '../webview/src/spec-viewer/signals';
import {
    activeCapturePalette,
    beardedMonokaiBlack,
    beardedVividLight,
    captureFontVars,
    deriveVscodeVars,
    highContrast,
    type VsCodeVars,
} from './capture-theme';

// Import all spec-viewer CSS
import '../webview/styles/spec-viewer/index.css';
// Codicon font so file-ref icons render in stories (the real viewer loads this
// from the extension; without it the glyph shows as an empty square).
import '@vscode/codicons/dist/codicon.css';

interface StoryTheme {
    bodyClass: 'vscode-dark' | 'vscode-light' | 'vscode-high-contrast';
    vars: VsCodeVars;
}

// Colours live in ./capture-theme.ts, one palette per set of named roles.
// Retheming every screenshot and clip is a one-line change there, not an edit
// to this file. "Capture palette" is whichever one that module marks active.
const themes: Record<string, StoryTheme> = {
    capture: {
        bodyClass: activeCapturePalette.bodyClass,
        vars: deriveVscodeVars(activeCapturePalette),
    },
    'monokai-black': {
        bodyClass: beardedMonokaiBlack.bodyClass,
        vars: deriveVscodeVars(beardedMonokaiBlack),
    },
    'vivid-light': {
        bodyClass: beardedVividLight.bodyClass,
        vars: deriveVscodeVars(beardedVividLight),
    },
    'high-contrast': { bodyClass: 'vscode-high-contrast', vars: highContrast },
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
                    { value: 'capture', title: 'Capture palette (active)' },
                    { value: 'monokai-black', title: 'Bearded Monokai Black (dark)' },
                    { value: 'vivid-light', title: 'Bearded Vivid Light (light)' },
                    { value: 'high-contrast', title: 'VS Code High Contrast' },
                ],
                dynamicTitle: true,
            },
        },
    },
    initialGlobals: {
        vscodeTheme: 'capture',
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

            const theme = themes[context.globals.vscodeTheme as string] ?? themes['capture'];

            // tokens.css and highlighting.ts key off body.vscode-dark/-light,
            // so the class must live on <body>, not just the wrapper div.
            document.body.classList.remove('vscode-dark', 'vscode-light', 'vscode-high-contrast');
            document.body.classList.add(theme.bodyClass);

            // tokens.css declares its tokens on :root, and a custom property's
            // var(--vscode-*) resolves where the property is DECLARED — so the
            // theme variables must live on :root too, or every token silently
            // takes its fallback (washed-out headings in light mode).
            const rootStyle = document.documentElement.style;
            Object.entries({ ...captureFontVars, ...theme.vars }).forEach(([k, v]) => {
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
