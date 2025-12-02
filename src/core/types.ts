/**
 * Message types for communication between extension and webview
 */

// Extension -> Webview messages
export type ExtensionToWebviewMessage =
    | { type: 'documentChanged'; content: string }
    | { type: 'updatePhaseInfo'; specInfo: SpecInfo };

// Webview -> Extension messages
export type WebviewToExtensionMessage =
    | { type: 'editSource' }
    | { type: 'refineLine'; lineNum: number; content: string; instruction: string }
    | { type: 'removeLine'; lineNum: number }
    | { type: 'approveAndContinue' }
    | { type: 'regenerate' }
    | { type: 'navigateToPhase'; phase: string }
    | { type: 'generateContent'; command: string }
    | { type: 'enhance'; command: string }
    | { type: 'switchTab'; fileName: string };

export type WebviewMessage = ExtensionToWebviewMessage | WebviewToExtensionMessage;

// Spec info passed to webview
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
