import * as vscode from 'vscode';
import { SpecViewerProvider } from '../specViewerProvider';
import type { SpecDocument } from '../types';

jest.mock('../../../extension', () => ({
    getAIProvider: jest.fn(),
}));

jest.mock('../documentScanner', () => ({
    scanDocuments: jest.fn(),
}));

jest.mock('../html', () => ({
    generateHtml: jest.fn().mockReturnValue('<html></html>'),
}));

jest.mock('../../workflows', () => ({
    getFeatureWorkflow: jest.fn().mockResolvedValue(undefined),
    getWorkflow: jest.fn().mockReturnValue(undefined),
    normalizeWorkflowConfig: jest.fn((wf: any) => wf),
    resolveWorkflow: jest.fn().mockResolvedValue(undefined),
    DEFAULT_WORKFLOW: {
        name: 'speckit',
        steps: [
            { name: 'spec', label: 'Specification', file: 'spec.md' },
            { name: 'plan', label: 'Plan', file: 'plan.md' },
            { name: 'tasks', label: 'Tasks', file: 'tasks.md' },
        ],
    },
}));

jest.mock('../../specs/specContextWriter', () => ({
    writeSpecContext: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../specs/specContextReconciler', () => ({
    reconcileAndPersist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

import { scanDocuments } from '../documentScanner';
import { generateHtml } from '../html';

const SPEC_DIR = '/workspace/specs/my-feature';

function coreDoc(type: string, exists: boolean): SpecDocument {
    return {
        type,
        label: type,
        fileName: `${type}.md`,
        filePath: `${SPEC_DIR}/${type}.md`,
        exists,
        isCore: true,
    } as SpecDocument;
}

function createProvider(): SpecViewerProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/mock/extension'),
        extensionPath: '/mock/extension',
        globalState: { get: jest.fn(), update: jest.fn() },
        workspaceState: { get: jest.fn(), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
    const outputChannel = {
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    } as unknown as vscode.OutputChannel;
    return new SpecViewerProvider(context, outputChannel);
}

/** The document type `generateHtml` was told to render on its most recent call. */
function renderedDocumentType(): string | null {
    const calls = (generateHtml as jest.Mock).mock.calls;
    if (calls.length === 0) return null;
    return calls[calls.length - 1][5];
}

describe('SpecViewerProvider.showSpec', () => {
    let provider: SpecViewerProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
        ];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_key: string, fallback?: unknown) => fallback),
        });
        (vscode.window.createWebviewPanel as jest.Mock).mockImplementation(() => ({
            title: '',
            webview: {
                html: '',
                postMessage: jest.fn().mockResolvedValue(true),
                onDidReceiveMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                asWebviewUri: jest.fn((uri: unknown) => uri),
                cspSource: 'vscode-webview:',
            },
            reveal: jest.fn(),
            dispose: jest.fn(),
            onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        }));
        provider = createProvider();
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    it('opens a panel for the spec and renders its first document', async () => {
        (scanDocuments as jest.Mock).mockResolvedValue([
            coreDoc('spec', true),
            coreDoc('plan', false),
        ]);

        await provider.showSpec(SPEC_DIR);

        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        expect(renderedDocumentType()).toBe('spec');
    });

    it('falls back to the first document that exists when the spec document is missing', async () => {
        (scanDocuments as jest.Mock).mockResolvedValue([
            coreDoc('spec', false),
            coreDoc('plan', true),
        ]);

        await provider.showSpec(SPEC_DIR);

        expect(renderedDocumentType()).toBe('plan');
    });

    it('reveals the existing panel instead of opening a second one', async () => {
        (scanDocuments as jest.Mock).mockResolvedValue([coreDoc('spec', true)]);

        await provider.showSpec(SPEC_DIR);
        const panel = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;

        await provider.showSpec(SPEC_DIR);

        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
    });

    it('re-renders the existing panel so the viewer re-applies its landing rule', async () => {
        (scanDocuments as jest.Mock).mockResolvedValue([coreDoc('spec', true)]);

        await provider.showSpec(SPEC_DIR);
        const firstHtmlCalls = (generateHtml as jest.Mock).mock.calls.length;

        await provider.showSpec(SPEC_DIR);

        expect((generateHtml as jest.Mock).mock.calls.length).toBeGreaterThan(firstHtmlCalls);
    });

    it('opens a spec with no documents at all without failing', async () => {
        (scanDocuments as jest.Mock).mockResolvedValue([]);

        await expect(provider.showSpec(SPEC_DIR)).resolves.toBeUndefined();

        expect(generateHtml).toHaveBeenCalled();
        const panel = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;
        expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        );
    });
});
