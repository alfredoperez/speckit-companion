/**
 * Types for the webview
 */

// VS Code API interface (provided by acquireVsCodeApi)
export interface VSCodeApi {
    postMessage(message: WebviewToExtensionMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
}

// Message types from webview to extension
export type WebviewToExtensionMessage =
    | { type: 'editSource' }
    | { type: 'refineLine'; lineNum: number; content: string; instruction: string }
    | { type: 'editLine'; lineNum: number; newText: string }
    | { type: 'removeLine'; lineNum: number }
    | { type: 'approveAndContinue' }
    | { type: 'regenerate' }
    | { type: 'navigateToPhase'; phase: string }
    | { type: 'generateContent'; command: string }
    | { type: 'enhance'; command: string }
    | { type: 'switchTab'; fileName: string };

// Message types from extension to webview
export type ExtensionToWebviewMessage =
    | { type: 'documentChanged'; content: string }
    | { type: 'updatePhaseInfo'; specInfo: SpecInfo };

// Spec info passed from extension
export interface SpecInfo {
    currentPhase: number;
    phaseIcon: string;
    progressPercent: number;
    specDir: string;
    documentType: 'spec' | 'plan' | 'tasks' | 'other';
    enhancementButton: EnhancementButton | null;
    nextPhaseExists: boolean;
    currentFileName: string;
    allDocs: RelatedDoc[];
}

export interface RelatedDoc {
    name: string;
    fileName: string;
    path: string;
}

export interface EnhancementButton {
    label: string;
    command: string;
    icon: string;
    tooltip?: string;
}

// Line classification types
export interface LineClassification {
    type: LineType;
    removable: boolean;
    refinable: boolean;
}

export type LineType =
    | 'empty'
    | 'doc-title'
    | 'section-header'
    | 'subsection-header'
    | 'h4-header'
    | 'hr'
    | 'checkbox'
    | 'bullet'
    | 'numbered'
    | 'user-story'
    | 'content';

// Declare globals provided by the webview HTML
declare global {
    const vscode: VSCodeApi;
    const initialContent: string;
    const specInfo: SpecInfo;
    const mermaid: {
        initialize: (config: unknown) => void;
        run: (config: { querySelector: string }) => void;
    };
    const hljs: {
        highlightElement: (element: Element) => void;
    };
}
