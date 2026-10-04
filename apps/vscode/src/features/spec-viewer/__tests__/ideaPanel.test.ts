import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
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
    resolveSpecPipeline: jest.fn().mockResolvedValue([]),
    DEFAULT_WORKFLOW: { name: 'speckit', steps: [] },
}));

jest.mock('../../specs/specContextWriter', () => ({
    writeSpecContext: jest.fn().mockResolvedValue(undefined),
    updateSpecContext: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../specs/specContextReconciler', () => ({
    reconcileAndPersist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../core/telemetry', () => ({
    ...jest.requireActual('../../../core/telemetry'),
    reportSpecOpened: jest.fn(),
    reportLivingSpecOpened: jest.fn(),
    reportInstallPromptShown: jest.fn(),
}));

import { scanDocuments } from '../documentScanner';
import { generateHtml } from '../html';
import { writeSpecContext, updateSpecContext } from '../../specs/specContextWriter';
import { reportSpecOpened } from '../../../core/telemetry';

const IDEAS_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/idea-reports/.specify/assessments');
const SHARED = path.join(IDEAS_ROOT, 'shared-lists');
const OFFLINE = path.join(IDEAS_ROOT, 'offline-mode');
const GUEST = path.join(IDEAS_ROOT, 'guest-links');
const BUG = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first');

const ARG = {
    documents: 4,
    docType: 5,
    specName: 6,
    phases: 7,
    badgeText: 13,
    contextSpecName: 16,
    activityPanelEnabled: 21,
    installPrompt: 22,
    livingMode: 23,
    titleFromHeading: 25,
    readOnly: 30,
} as const;

function createProvider(): SpecViewerProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/mock/extension'),
        extensionPath: '/mock/extension',
        globalState: { get: jest.fn(), update: jest.fn() },
        workspaceState: { get: jest.fn(), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
    return new SpecViewerProvider(context, outputChannel);
}

const appendLine = jest.fn();
const outputChannel = { appendLine, show: jest.fn(), dispose: jest.fn() } as unknown as vscode.OutputChannel;

function droppedMessages(): string[] {
    return appendLine.mock.calls.map(c => String(c[0])).filter(line => line.includes('read-only') && line.includes('dropped'));
}

function lastRender(): unknown[] {
    const calls = (generateHtml as jest.Mock).mock.calls;
    return calls[calls.length - 1];
}

function existsByType(): Record<string, boolean> {
    const docs = lastRender()[ARG.documents] as SpecDocument[];
    return Object.fromEntries(docs.map(d => [d.type, d.exists]));
}

function lastPanel(): any {
    const results = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
    return results[results.length - 1].value;
}

function snapshot(dir: string): Record<string, string> {
    return Object.fromEntries(fs.readdirSync(dir).map(name => [name, fs.readFileSync(path.join(dir, name), 'utf-8')]));
}

async function until(condition: () => boolean, timeoutMs = 2000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!condition() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

describe('Idea report panel', () => {
    let provider: SpecViewerProvider;
    let before: Record<string, string>[];

    beforeAll(() => {
        before = [SHARED, OFFLINE, GUEST].map(snapshot);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file(path.resolve(IDEAS_ROOT, '../..')), name: 'workspace', index: 0 },
        ];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_key: string, fallback?: unknown) => fallback),
        });
        (vscode.window.createWebviewPanel as jest.Mock).mockImplementation(
            (vscode as any).createMockWebviewPanel,
        );
        provider = createProvider();
    });

    afterEach(() => {
        for (const result of (vscode.window.createWebviewPanel as jest.Mock).mock.results) {
            result.value.__fireDispose();
        }
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    afterAll(() => {
        expect([SHARED, OFFLINE, GUEST].map(snapshot)).toEqual(before);
    });

    describe('opening an idea', () => {
        it('opens one panel for the idea folder, titled with the idea', async () => {
            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas' });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(lastPanel().title).toBe('Idea: Shared todo lists');
        });

        it('opens an idea stage as an idea when no option names the set', async () => {
            await provider.show(path.join(SHARED, 'concept.md'));

            expect(lastPanel().title).toBe('Idea: Shared todo lists');
            expect(lastRender()[ARG.docType]).toBe('concept');
            expect(lastRender()[ARG.readOnly]).toBe(true);
        });

        it('renders the five stages read-only, with no run chrome', async () => {
            await provider.show(path.join(SHARED, 'research.md'), { report: 'ideas' });

            const render = lastRender();
            expect((render[ARG.documents] as SpecDocument[]).map(d => d.label)).toEqual([
                'Intake',
                'Research',
                'Problem',
                'Concept',
                'Decision',
            ]);
            expect(existsByType()).toEqual({ intake: true, research: true, problem: true, concept: true, decision: true });
            expect(render[ARG.docType]).toBe('research');
            expect(render[ARG.phases]).toEqual([]);
            expect(render[ARG.activityPanelEnabled]).toBe(false);
            expect(render[ARG.installPrompt]).toBeNull();
            expect(render[ARG.livingMode]).toBe(false);
            expect(render[ARG.titleFromHeading]).toBe(true);
            expect(render[ARG.readOnly]).toBe(true);
            expect(render[ARG.contextSpecName]).toBe('Shared todo lists');
        });

        it('marks stages that were never written as not created', async () => {
            await provider.show(path.join(OFFLINE, 'intake.md'), { report: 'ideas' });

            expect(existsByType()).toEqual({ intake: true, research: true, problem: false, concept: false, decision: false });
        });

        it('shows the verdict as the badge of a decided idea', async () => {
            await provider.show(path.join(SHARED, 'decision.md'), { report: 'ideas' });
            expect(lastRender()[ARG.badgeText]).toBe('KILL');

            await provider.show(path.join(GUEST, 'decision.md'), { report: 'ideas' });
            expect(lastRender()[ARG.badgeText]).toBe('NEEDS-CLARIFICATION');
        });

        it('shows IDEA as the badge of an idea still being assessed', async () => {
            await provider.show(path.join(OFFLINE, 'research.md'), { report: 'ideas' });

            expect(lastRender()[ARG.badgeText]).toBe('IDEA');
        });

        it('reuses the panel and shows the clicked stage on a second open of the same idea', async () => {
            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas' });
            const panel = lastPanel();

            await provider.show(path.join(SHARED, 'decision.md'), { report: 'ideas' });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
            expect(lastRender()[ARG.docType]).toBe('decision');
        });

        it('opens a second idea in its own panel', async () => {
            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas' });
            await provider.show(path.join(OFFLINE, 'intake.md'), { report: 'ideas' });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
        });

        it('opens a bug and an idea in separate panels, each titled for its kind', async () => {
            await provider.show(path.join(BUG, 'assessment.md'), { report: 'bugs' });
            const bugPanel = lastPanel();
            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas' });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
            expect(bugPanel.title).toBe('Bug: cartTotal skips the first cart item');
            expect(lastPanel().title).toBe('Idea: Shared todo lists');
        });

        it('never reads or writes a run record and sends no open event', async () => {
            await provider.show(path.join(SHARED, 'problem.md'), { report: 'ideas' });

            expect(scanDocuments).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
            expect(reportSpecOpened).not.toHaveBeenCalled();
            expect(fs.existsSync(path.join(SHARED, '.spec-context.json'))).toBe(false);
        });
    });

    describe('following the files on disk', () => {
        it('re-renders the stage on screen when a stage of the idea changes', async () => {
            await provider.show(path.join(SHARED, 'concept.md'), { report: 'ideas' });
            const renders = (generateHtml as jest.Mock).mock.calls.length;

            await provider.refreshIfDisplaying(path.join(SHARED, 'concept.md'));

            expect((generateHtml as jest.Mock).mock.calls.length).toBe(renders + 1);
            expect(lastRender()[ARG.docType]).toBe('concept');
            expect(writeSpecContext).not.toHaveBeenCalled();
        });

        it('says the folder is gone when the open idea folder is deleted', async () => {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-gone-'));
            const ideaDir = path.join(root, '.specify', 'assessments', 'gone');
            fs.mkdirSync(ideaDir, { recursive: true });
            fs.writeFileSync(path.join(ideaDir, 'intake.md'), '# Idea Intake: gone\n');
            await provider.show(path.join(ideaDir, 'intake.md'), { report: 'ideas' });
            const panel = lastPanel();

            fs.rmSync(root, { recursive: true, force: true });
            provider.handleFileDeleted(ideaDir);
            await until(() => panel.title.endsWith('(moved)'));

            expect(panel.title).toBe('Idea: gone (moved)');
            expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'specMoved' }));
        });
    });

    describe('messages from the page', () => {
        it('drops writes and run actions', async () => {
            await provider.show(path.join(SHARED, 'concept.md'), { report: 'ideas' });
            const panel = lastPanel();
            (vscode.workspace.openTextDocument as jest.Mock).mockClear();
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await panel.__receive({ type: 'toggleCheckbox', lineNum: 3, checked: true });
            await panel.__receive({ type: 'editLine', lineNum: 3, newText: 'changed' });
            await panel.__receive({ type: 'approve' });
            await panel.__receive({ type: 'completeSpec' });

            expect(droppedMessages()).toHaveLength(4);
            expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
            expect(updateSpecContext).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
        });

        it('handles a rail click on a stage', async () => {
            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas' });
            const panel = lastPanel();

            await panel.__receive({ type: 'stepperClick', phase: 'problem' });

            expect(lastRender()[ARG.docType]).toBe('problem');
        });
    });
});
