import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SpecViewerProvider } from '../specViewerProvider';
import type { SpecDocument } from '../types';
import { hasOverview } from '../../../core/utils/overviewAvailability';

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
    resolveSpecPipeline: jest.fn().mockResolvedValue([
        { name: 'spec', label: 'Specification', file: 'spec.md', command: '/speckit.specify' },
    ]),
    DEFAULT_WORKFLOW: { name: 'speckit', steps: [{ name: 'spec', label: 'Specification', file: 'spec.md', command: '/speckit.specify' }] },
}));

jest.mock('../../specs/specContextWriter', () => ({
    writeSpecContext: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../specs/specContextReader', () => ({
    readSpecContext: jest.fn(),
    SPEC_CONTEXT_FILENAME: '.spec-context.json',
    SpecContextParseError: class extends Error {},
}));

jest.mock('../../specs/specContextReconciler', () => ({
    reconcileAndPersist: jest.fn(async (_dir: string, ctx: unknown) => ctx),
}));

jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

import { scanDocuments } from '../documentScanner';
import { readSpecContext } from '../../specs/specContextReader';

const SPEC_DIR = '/workspace/specs/my-feature';
const EMPTY_HISTORY_FIXTURE = path.join(__dirname, '../../../../tests/fixtures/spec-context/empty-history-with-comments.json');

const SPEC_DOC = {
    type: 'spec', label: 'Specification', fileName: 'spec.md', filePath: `${SPEC_DIR}/spec.md`, exists: true, isCore: true,
} as SpecDocument;

function createProvider(): SpecViewerProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/mock/extension'),
        extensionPath: '/mock/extension',
        globalState: { get: jest.fn(), update: jest.fn() },
        workspaceState: { get: jest.fn(), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
    const outputChannel = { appendLine: jest.fn(), show: jest.fn(), dispose: jest.fn() } as unknown as vscode.OutputChannel;
    return new SpecViewerProvider(context, outputChannel);
}

const emptyContext = { currentStep: 'specify', status: 'specifying', history: [] };
const recordedContext = {
    currentStep: 'specify',
    status: 'specifying',
    history: [{ step: 'specify', substep: null, event: 'start', at: '2026-09-29T10:00:00.000Z', by: 'extension' }],
    approach: 'Do the thing',
};

describe('hasOverview', () => {
    it('is false for a spec with nothing recorded', () => {
        expect(hasOverview({}, true, false)).toBe(false);
    });

    it('is false before any viewer state exists', () => {
        expect(hasOverview(undefined, true, false)).toBe(false);
    });

    it('is false when the Activity panel setting is off, or for a living spec', () => {
        expect(hasOverview({ approach: 'x' }, false, false)).toBe(false);
        expect(hasOverview({ approach: 'x' }, true, true)).toBe(false);
    });

    it('is true once the spec has recorded activity', () => {
        expect(hasOverview({ approach: 'x' }, true, false)).toBe(true);
    });
});

describe('spec viewer tab title', () => {
    let provider: SpecViewerProvider;
    const panel = () => (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
        ];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_key: string, fallback?: unknown) => fallback),
        });
        (vscode.window.createWebviewPanel as jest.Mock).mockImplementation((vscode as any).createMockWebviewPanel);
        (scanDocuments as jest.Mock).mockResolvedValue([SPEC_DOC]);
        provider = createProvider();
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    it('names the document when the spec has no recorded activity, because that is what the pane shows', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(emptyContext);

        await provider.showSpec(SPEC_DIR);
        await provider.refreshContextIfDisplaying(`${SPEC_DIR}/.spec-context.json`);

        expect(panel().title).toBe('Spec: my-feature - Specification');
    });

    it('names the Overview when the spec has recorded activity', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(recordedContext);

        await provider.showSpec(SPEC_DIR);
        await provider.refreshContextIfDisplaying(`${SPEC_DIR}/.spec-context.json`);

        expect(panel().title).toBe('Spec: my-feature - Overview');
    });

    describe('a spec with an empty history that keeps its status, step and review comments', () => {
        const record = () => JSON.parse(fs.readFileSync(EMPTY_HISTORY_FIXTURE, 'utf8'));
        const PLAN_DOC = { ...SPEC_DOC, type: 'plan', label: 'Plan', fileName: 'plan.md', filePath: `${SPEC_DIR}/plan.md` } as SpecDocument;

        beforeEach(() => {
            (scanDocuments as jest.Mock).mockResolvedValue([SPEC_DOC, PLAN_DOC]);
            (readSpecContext as jest.Mock).mockResolvedValue(record());
        });

        it('names the document the pane shows once the webview has its state', async () => {
            await provider.showSpec(SPEC_DIR);
            await provider.refreshContextIfDisplaying(`${SPEC_DIR}/.spec-context.json`);

            expect(panel().title).toBe('Spec: my-feature - Specification');
        });

        it('names the document from the first paint, before the webview asks for its state', async () => {
            await provider.showSpec(SPEC_DIR);

            expect(panel().title).toBe('Spec: my-feature - Specification');
        });
    });

    it('names the Overview from the first paint when the spec has recorded activity', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(recordedContext);

        await provider.showSpec(SPEC_DIR);

        expect(panel().title).toBe('Spec: my-feature - Overview');
    });

    it('switches to the Overview once activity is first recorded', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(emptyContext);
        await provider.showSpec(SPEC_DIR);
        await provider.refreshContextIfDisplaying(`${SPEC_DIR}/.spec-context.json`);
        expect(panel().title).toBe('Spec: my-feature - Specification');

        (readSpecContext as jest.Mock).mockResolvedValue(recordedContext);
        await provider.refreshContextIfDisplaying(`${SPEC_DIR}/.spec-context.json`);

        expect(panel().title).toBe('Spec: my-feature - Overview');
    });
});
