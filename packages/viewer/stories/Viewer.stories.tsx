/// <reference types="vite/client" />
import type { Meta, StoryObj } from '@storybook/preact';
import { useEffect, useRef } from 'preact/hooks';
import '../src/element/index';
import type { SpeckitViewerElement } from '../src/element/index';
import type { SpecContext, SpecDocument } from '../src/contract';

import vscodeTheme from '../dist/styles/themes/vscode.css?inline';
import lightTheme from '../dist/styles/themes/light.css?inline';
import darkTheme from '../dist/styles/themes/dark.css?inline';
import apUiTheme from '../dist/styles/themes/ap-ui.css?inline';

import spec from '../../../specs/_02_demo-tasked/spec.md?raw';
import plan from '../../../specs/_02_demo-tasked/plan.md?raw';
import tasks from '../../../specs/_02_demo-tasked/tasks.md?raw';
import recordRaw from '../../../specs/_02_demo-tasked/.spec-context.json?raw';

const record = JSON.parse(recordRaw) as SpecContext;
const texts: Record<string, string> = { spec, plan, tasks };
const doc = (type: string, label: string, fileName: string): SpecDocument => ({
    type, label, fileName, filePath: `/specs/_02_demo-tasked/${fileName}`, exists: true, isCore: true, category: 'core',
} as SpecDocument);
const documents = [doc('spec', 'Specification', 'spec.md'), doc('plan', 'Plan', 'plan.md'), doc('tasks', 'Tasks', 'tasks.md')];

// What each theme expects its host to provide: VS Code sets its variables and a body class,
// @ap/ui sets its tokens on the page (these are Factory's light values).
const VSCODE_DARK = ':root{--vscode-editor-background:#1e1e1e;--vscode-editor-foreground:#cccccc;--vscode-sideBar-background:#181818;--vscode-editorWidget-background:#252526;--vscode-list-hoverBackground:#2a2d2e;--vscode-focusBorder:#0078d4;--vscode-button-background:#0078d4;--vscode-button-foreground:#ffffff;--vscode-button-hoverBackground:#026ec1}';
const AP_UI_HOST = ':root{--surface:#ffffff;--page:#f4f5f7;--hover:#e9ecf1;--hairline:#dde1e7;--border-strong:#c4c9d1;--muted:#5d6673;--text:#1f2428;--accent-text:#6c2ee8;--accent-edge:#8a5cf5;--accent-on:#ffffff;--accent-wash:color-mix(in srgb,#a277ff 16%,#ffffff);--ok-text:#00704a;--ok-wash:color-mix(in srgb,#61ffca 16%,#ffffff);--warn-text:#8f5200;--warn-wash:color-mix(in srgb,#ffca85 16%,#ffffff);--fail-text:#c40000;--fail-wash:color-mix(in srgb,#ff6767 16%,#ffffff);--pink-text:#a800b8;--pink-wash:color-mix(in srgb,#f477ff 16%,#ffffff);--font-doc:"Avenir Next","Inter",system-ui,sans-serif;--font-doc-mono:"Cascadia Code","Geist Mono",ui-monospace,monospace;--fs-doc:16px;--radius-chip:4px;--radius-control:6px;--radius-panel:8px}';

interface ThemeSetup {
    css: string;
    host?: string;
    bodyClass?: string;
}

const THEME_STYLE_ID = 'speckit-story-theme';

// Every theme file styles `.sk-viewer` at the same weight, so one style element holds the
// story's theme and is swapped, never stacked.
function useTheme({ css, host = '', bodyClass }: ThemeSetup) {
    useEffect(() => {
        let style = document.getElementById(THEME_STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = THEME_STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent = host + css;
        if (bodyClass) document.body.classList.add(bodyClass);
        return () => {
            if (bodyClass) document.body.classList.remove(bodyClass);
        };
    }, [css, host, bodyClass]);
}

function Viewer(theme: ThemeSetup) {
    useTheme(theme);
    const ref = useRef<SpeckitViewerElement>(null);
    useEffect(() => {
        const viewer = ref.current;
        if (!viewer) return;
        const onAction = (event: Event) => {
            const action = (event as CustomEvent).detail;
            if (action.type === 'stepperClick') viewer.content = texts[action.phase] ?? null;
            if (action.type === 'switchDocument') viewer.content = texts[action.documentType] ?? null;
        };
        viewer.addEventListener('speckit-action', onAction);
        viewer.record = record;
        viewer.documents = documents;
        viewer.landing = 'document';
        viewer.currentDoc = 'spec';
        viewer.content = spec;
        return () => viewer.removeEventListener('speckit-action', onAction);
    }, []);
    return <speckit-viewer ref={ref} style="height:100vh" />;
}

declare module 'preact' {
    namespace JSX {
        interface IntrinsicElements {
            'speckit-viewer': preact.JSX.HTMLAttributes<HTMLElement>;
        }
    }
}

const meta: Meta = {
    title: 'speckit-viewer/Themes',
    parameters: {
        docs: {
            description: {
                component: 'The `<speckit-viewer>` element on the demo spec, once per theme. The rail and the Overview navigate; every other action is only emitted.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

export const VsCode: Story = {
    name: 'VS Code (dark)',
    render: () => <Viewer css={vscodeTheme} host={VSCODE_DARK} bodyClass="vscode-dark" />,
};

export const Light: Story = {
    render: () => <Viewer css={lightTheme} />,
};

export const Dark: Story = {
    render: () => <Viewer css={darkTheme} />,
};

export const ApUi: Story = {
    name: '@ap/ui',
    render: () => <Viewer css={apUiTheme} host={AP_UI_HOST} />,
};
