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

const BUGS_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports/.specify/bugs');
const CART = path.join(BUGS_ROOT, 'cart-total-skips-first');
const SLUG = path.join(BUGS_ROOT, 'slug-keeps-spaces');

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

describe('Bug report panel', () => {
    let provider: SpecViewerProvider;
    let cartBefore: Record<string, string>;
    let slugBefore: Record<string, string>;

    beforeAll(() => {
        cartBefore = snapshot(CART);
        slugBefore = snapshot(SLUG);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file(path.resolve(BUGS_ROOT, '../..')), name: 'workspace', index: 0 },
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
        expect(snapshot(CART)).toEqual(cartBefore);
        expect(snapshot(SLUG)).toEqual(slugBefore);
    });

    describe('opening a bug', () => {
        it('opens one panel for the bug folder, titled with the bug', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(lastPanel().title).toBe('Bug: cartTotal skips the first cart item');
        });

        it('renders the three reports read-only, with no run chrome', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });

            const render = lastRender();
            expect(existsByType()).toEqual({ assessment: true, fix: true, test: true });
            expect(render[ARG.docType]).toBe('assessment');
            expect(render[ARG.phases]).toEqual([]);
            expect(render[ARG.activityPanelEnabled]).toBe(false);
            expect(render[ARG.installPrompt]).toBeNull();
            expect(render[ARG.livingMode]).toBe(false);
            expect(render[ARG.titleFromHeading]).toBe(true);
            expect(render[ARG.readOnly]).toBe(true);
            expect(render[ARG.badgeText]).toBe('VERIFIED');
            expect(render[ARG.contextSpecName]).toBe('cartTotal skips the first cart item');
        });

        it('marks reports that were never written as not created', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });

            expect(existsByType()).toEqual({ assessment: true, fix: false, test: false });
            expect(lastRender()[ARG.badgeText]).toBe('VALID');
        });

        it('reuses the panel and shows the clicked report on a second open of the same bug', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            await provider.show(path.join(CART, 'test.md'), { bug: true });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
            expect(lastRender()[ARG.docType]).toBe('test');
        });

        it('opens a second bug in its own panel', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
        });

        it('never reads or writes a run record and sends no open event', async () => {
            await provider.show(path.join(CART, 'fix.md'), { bug: true });

            expect(scanDocuments).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
            expect(reportSpecOpened).not.toHaveBeenCalled();
            expect(fs.existsSync(path.join(CART, '.spec-context.json'))).toBe(false);
            expect(fs.existsSync(path.join(SLUG, '.spec-context.json'))).toBe(false);
        });
    });

    describe('following the files on disk', () => {
        it('re-renders the report on screen when a report of the bug changes', async () => {
            await provider.show(path.join(CART, 'fix.md'), { bug: true });
            const renders = (generateHtml as jest.Mock).mock.calls.length;

            await provider.refreshIfDisplaying(path.join(CART, 'fix.md'));

            expect((generateHtml as jest.Mock).mock.calls.length).toBe(renders + 1);
            expect(lastRender()[ARG.docType]).toBe('fix');
            expect(writeSpecContext).not.toHaveBeenCalled();
        });

        it('leaves the bug panel alone when a run record refresh is requested', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            await provider.refreshContextIfDisplaying(path.join(CART, '.spec-context.json'));

            expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'viewerStateUpdated' }),
            );
        });
    });

    describe('messages from the page', () => {
        it('drops writes: a checkbox toggle, a comment and a line edit change nothing', async () => {
            await provider.show(path.join(CART, 'fix.md'), { bug: true });
            const panel = lastPanel();
            (vscode.workspace.openTextDocument as jest.Mock).mockClear();

            await panel.__receive({ type: 'toggleCheckbox', lineNum: 3, checked: true });
            await panel.__receive({ type: 'addComment', id: 'c1', doc: 'fix', lineNum: 3, lineContent: 'x', comment: 'why' });
            await panel.__receive({ type: 'editLine', lineNum: 3, newText: 'changed' });

            expect(droppedMessages()).toHaveLength(3);
            expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
            expect(updateSpecContext).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
        });

        it('drops every run and lifecycle action', async () => {
            await provider.show(path.join(CART, 'fix.md'), { bug: true });
            const panel = lastPanel();
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await panel.__receive({ type: 'approve' });
            await panel.__receive({ type: 'regenerate' });
            await panel.__receive({ type: 'completeSpec' });
            await panel.__receive({ type: 'footerAction', id: 'archive' });
            await panel.__receive({ type: 'runDocRefinement', doc: 'fix', comments: [] });

            expect(droppedMessages()).toHaveLength(5);
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
        });
    });

    describe('a report that is not there', () => {
        it('shows the missing report as not created instead of another report', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            await panel.__receive({ type: 'stepperClick', phase: 'test' });

            expect(lastRender()[ARG.docType]).toBe('test');
        });

        it('says the folder is gone when the open bug folder is deleted', async () => {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gone-'));
            const bugDir = path.join(root, '.specify', 'bugs', 'gone');
            fs.mkdirSync(bugDir, { recursive: true });
            fs.writeFileSync(path.join(bugDir, 'assessment.md'), '# Bug Assessment: gone\n');
            await provider.show(path.join(bugDir, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            fs.rmSync(root, { recursive: true, force: true });
            await provider.refreshIfDisplaying(bugDir);

            expect(panel.title).toBe('Bug: gone (moved)');
            expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'specMoved' }));
        });

        it('says the folder is gone when the whole bugs folder is deleted', async () => {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-gone-'));
            const bugsRoot = path.join(root, '.specify', 'bugs');
            fs.mkdirSync(path.join(bugsRoot, 'gone'), { recursive: true });
            fs.writeFileSync(path.join(bugsRoot, 'gone', 'assessment.md'), '# Bug Assessment: gone\n');
            await provider.show(path.join(bugsRoot, 'gone', 'assessment.md'), { bug: true });
            const panel = lastPanel();

            fs.rmSync(root, { recursive: true, force: true });
            await provider.refreshIfDisplaying(bugsRoot);

            expect(panel.title).toBe('Bug: gone (moved)');
        });

        it('handles a document switch by showing the chosen report', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            const renders = (generateHtml as jest.Mock).mock.calls.length;
            await panel.__receive({ type: 'switchDocument', documentType: 'test' });
            await until(() => (generateHtml as jest.Mock).mock.calls.length > renders);

            expect(lastRender()[ARG.docType]).toBe('test');
            expect(droppedMessages()).toHaveLength(0);
        });

        it('handles a rail click on a report', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            await panel.__receive({ type: 'stepperClick', phase: 'fix' });

            expect(lastRender()[ARG.docType]).toBe('fix');
        });
    });
});
