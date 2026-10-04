import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SpecViewerProvider } from '../specViewerProvider';
import type { SpecDocument } from '../types';
import type { BugStory } from '../../reports/reportPageModel';

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
import { getAIProvider } from '../../../extension';

const BUGS_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports/.specify/bugs');
const CART = path.join(BUGS_ROOT, 'cart-total-skips-first');
const SLUG = path.join(BUGS_ROOT, 'slug-keeps-spaces');
const PAGES_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/report-pages/.specify/bugs');
const DISCOUNT = path.join(PAGES_ROOT, 'discount-applied-twice');
const EXPORT = path.join(PAGES_ROOT, 'export-drops-header');

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
    reportActions: 33,
    report: 34,
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

const executeInTerminal = jest.fn().mockResolvedValue(undefined);
const tempRoots: string[] = [];

function makeBug(slug: string, reports: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-actions-'));
    tempRoots.push(root);
    const dir = path.join(root, '.specify', 'bugs', slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [kind, text] of Object.entries(reports)) fs.writeFileSync(path.join(dir, `${kind}.md`), text);
    return dir;
}

const ASSESSMENT = '# Bug Assessment: Total is wrong\n\n- **Verdict**: valid\n';
const TOLD_ASSESSMENT = `${ASSESSMENT}\n## Symptom\n\nThe total leaves out the first item.\n`;
const CLOSED_ASSESSMENT = '# Bug Assessment: Not a bug\n\n- **Verdict**: invalid\n\n## Symptom\n\nThe total is right.\n';
const fixReport = (status: string) => `# Bug Fix: Total is wrong\n\n- **Status**: ${status}\n`;
const testReport = (result: string) => `# Bug Verification: Total is wrong\n\n- **Result**: ${result}\n`;

function actionLabels(): Array<[label: string, primary: boolean]> {
    const actions = lastRender()[ARG.reportActions] as Array<{ label: string; primary: boolean }>;
    return actions.map(a => [a.label, a.primary]);
}

function reportNav(): { kind: string; page?: BugStory } {
    return lastRender()[ARG.report] as { kind: string; page?: BugStory };
}

async function switchTo(panel: any, documentType: string): Promise<void> {
    const renders = (generateHtml as jest.Mock).mock.calls.length;
    await panel.__receive({ type: 'switchDocument', documentType });
    await until(() => (generateHtml as jest.Mock).mock.calls.length > renders);
    expect((generateHtml as jest.Mock).mock.calls.length).toBe(renders + 1);
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
    let pagesBefore: Record<string, string>[];

    beforeAll(() => {
        cartBefore = snapshot(CART);
        slugBefore = snapshot(SLUG);
        pagesBefore = [DISCOUNT, EXPORT].map(snapshot);
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
        (getAIProvider as jest.Mock).mockReturnValue({ executeInTerminal });
        provider = createProvider();
    });

    afterEach(() => {
        for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
        for (const result of (vscode.window.createWebviewPanel as jest.Mock).mock.results) {
            result.value.__fireDispose();
        }
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    afterAll(() => {
        expect(snapshot(CART)).toEqual(cartBefore);
        expect(snapshot(SLUG)).toEqual(slugBefore);
        expect([DISCOUNT, EXPORT].map(snapshot)).toEqual(pagesBefore);
    });

    describe('opening a bug', () => {
        it('opens one panel for the bug folder, titled with the bug', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });

            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(lastPanel().title).toBe('Bug: cartTotal skips the first cart item');
        });

        it('lists Story ahead of the three reports', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });

            const docs = lastRender()[ARG.documents] as SpecDocument[];
            expect(docs.map(d => [d.type, d.label])).toEqual([
                ['story', 'Story'],
                ['assessment', 'Assessment'],
                ['fix', 'Fix'],
                ['test', 'Test'],
            ]);
            expect(docs[0].filePath).toBe('');
        });

        it('renders the story and the three reports read-only, with no run chrome', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });

            const render = lastRender();
            expect(existsByType()).toEqual({ story: true, assessment: true, fix: true, test: true });
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

            expect(existsByType()).toEqual({ story: true, assessment: true, fix: false, test: false });
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

    describe('landing on the story', () => {
        it('opens a bug with only an assessment on the story, leading with what was assessed', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().kind).toBe('bug');
            expect(reportNav().page).toEqual(expect.objectContaining({ lead: 'assessed', nextAction: 'Fix bug' }));
            expect(reportNav().page!.steps.map(step => [step.id, step.state])).toEqual([
                ['wrong', 'done'],
                ['changed', 'next'],
                ['verified', 'next'],
            ]);
        });

        it('leads with a fix waiting for a test when the bug has a fix and no test', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied') });

            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page).toEqual(expect.objectContaining({ lead: 'fixed-untested', nextAction: 'Test fix' }));
        });

        it('leads with verified for a bug whose test verified the fix', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('verified');
            expect(reportNav().page!.nextAction).toBeUndefined();
            expect(reportNav().page!.steps.map(step => step.state)).toEqual(['done', 'done', 'done']);
        });

        it('leads with a failed test for a bug whose test did not verify the fix', async () => {
            await provider.show(path.join(DISCOUNT, 'assessment.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('test-failed');
        });

        it('leads with closed for a bug assessed as not a bug', async () => {
            await provider.show(path.join(EXPORT, 'assessment.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('closed');
        });

        it('lands on the story whichever report of the bug the path names', async () => {
            await provider.show(path.join(CART, 'test.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('story');
        });

        it('keeps the read-only chrome, the badge and the title on the story', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });

            const render = lastRender();
            expect(lastPanel().title).toBe('Bug: cartTotal skips the first cart item');
            expect(render[ARG.badgeText]).toBe('VERIFIED');
            expect(render[ARG.readOnly]).toBe(true);
            expect(render[ARG.phases]).toEqual([]);
            expect(render[2]).toBe('');
        });

        it('opens the clicked report, with no page, when the open is not a landing', async () => {
            await provider.show(path.join(CART, 'fix.md'), { report: 'bugs' });

            expect(lastRender()[ARG.docType]).toBe('fix');
            expect(reportNav().kind).toBe('bug');
            expect(reportNav().page).toBeUndefined();
        });

        it('moves an open panel from the story to the clicked report, and back on a landing', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });

            await provider.show(path.join(CART, 'test.md'), { report: 'bugs' });
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(lastRender()[ARG.docType]).toBe('test');
            expect(reportNav().page).toBeUndefined();

            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('verified');
        });

        it('never reads or writes a run record when it lands on the story', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });

            expect(scanDocuments).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
            expect(reportSpecOpened).not.toHaveBeenCalled();
            expect(fs.existsSync(path.join(CART, '.spec-context.json'))).toBe(false);
        });
    });

    describe('a bug with no story to tell', () => {
        it('lands on the assessment when the assessment has no section the story can use', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT });

            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('assessment');
            expect(lastRender()[2]).toBe(ASSESSMENT);
            expect(reportNav().kind).toBe('bug');
            expect(reportNav().page).toBeUndefined();
        });

        it('lands on the first report written when the bug has no assessment', async () => {
            const dir = makeBug('total-wrong', { fix: fixReport('applied') });

            await provider.show(path.join(dir, 'fix.md'), { report: 'bugs', landing: true });

            expect(lastRender()[ARG.docType]).toBe('fix');
            expect(reportNav().page).toBeUndefined();
        });

        it('shows the raw assessment when the page asks for the story', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });

            await switchTo(lastPanel(), 'story');

            expect(lastRender()[ARG.docType]).toBe('assessment');
            expect(lastRender()[2]).toBe(ASSESSMENT);
            expect(reportNav().page).toBeUndefined();
            expect(droppedMessages()).toHaveLength(0);
        });

        it('shows the raw assessment when the rail asks for the story', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT, fix: fixReport('applied') });
            await provider.show(path.join(dir, 'fix.md'), { report: 'bugs' });

            await lastPanel().__receive({ type: 'stepperClick', phase: 'story' });

            expect(lastRender()[ARG.docType]).toBe('assessment');
            expect(reportNav().page).toBeUndefined();
        });
    });

    describe('moving between the story and the reports', () => {
        it('shows a report with no page, then the story again with its page', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });
            const panel = lastPanel();

            await switchTo(panel, 'fix');
            expect(lastRender()[ARG.docType]).toBe('fix');
            expect(lastRender()[2]).toBe(fs.readFileSync(path.join(CART, 'fix.md'), 'utf-8'));
            expect(reportNav().page).toBeUndefined();

            await switchTo(panel, 'story');
            expect(lastRender()[ARG.docType]).toBe('story');
            expect(lastRender()[2]).toBe('');
            expect(reportNav().page!.lead).toBe('verified');
            expect(droppedMessages()).toHaveLength(0);
        });

        it('opens the story from the rail', async () => {
            await provider.show(path.join(CART, 'fix.md'), { report: 'bugs' });

            await lastPanel().__receive({ type: 'stepperClick', phase: 'story' });

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('verified');
        });

        const states: Array<[state: string, reports: Record<string, string>, buttons: Array<[string, boolean]>]> = [
            ['only an assessment', { assessment: TOLD_ASSESSMENT }, [['Fix bug', true]]],
            ['a fix that was not applied', { assessment: TOLD_ASSESSMENT, fix: fixReport('not-applied') }, [['Fix bug', true]]],
            ['a fix waiting for a test', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied') }, [['Test fix', true], ['Fix again', false]]],
            ['a failed test', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied'), test: testReport('failed') }, [['Fix bug', true], ['Test again', false]]],
            ['a verified fix', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied'), test: testReport('verified') }, [['Test again', false]]],
            ['a closed assessment', { assessment: CLOSED_ASSESSMENT }, [['Assess again', false]]],
        ];

        it.each(states)('keeps the same buttons on the story and on every report for a bug with %s', async (_state, reports, buttons) => {
            const dir = makeBug('total-wrong', reports);
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });
            const panel = lastPanel();
            expect(lastRender()[ARG.docType]).toBe('story');
            expect(actionLabels()).toEqual(buttons);
            const onStory = lastRender()[ARG.reportActions];

            for (const tab of ['assessment', 'fix', 'test', 'story']) {
                await switchTo(panel, tab);

                expect(lastRender()[ARG.docType]).toBe(tab);
                expect(lastRender()[ARG.reportActions]).toEqual(onStory);
            }
        });

        it('sends the same command from the story as from a report', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { report: 'bugs', landing: true });

            await lastPanel().__receive({ type: 'reportAction', id: 'bug.fix' });

            expect(executeInTerminal).toHaveBeenCalledTimes(1);
            expect(executeInTerminal).toHaveBeenCalledWith('/speckit-bug-fix slug=slug-keeps-spaces');
        });

        it('drops writes and run actions sent while the story is shown', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { report: 'bugs', landing: true });
            const panel = lastPanel();
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await panel.__receive({ type: 'toggleCheckbox', lineNum: 3, checked: true });
            await panel.__receive({ type: 'editLine', lineNum: 3, newText: 'changed' });
            await panel.__receive({ type: 'approve' });

            expect(droppedMessages()).toHaveLength(3);
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
            expect(writeSpecContext).not.toHaveBeenCalled();
        });
    });

    describe('the story following the files on disk', () => {
        it('leads with the fix once a fix report is added', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });
            expect(reportNav().page!.lead).toBe('assessed');

            fs.writeFileSync(path.join(dir, 'fix.md'), fixReport('applied'));
            await provider.refreshIfDisplaying(path.join(dir, 'fix.md'));

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page).toEqual(expect.objectContaining({ lead: 'fixed-untested', nextAction: 'Test fix' }));
            expect(existsByType()).toEqual({ story: true, assessment: true, fix: true, test: false });
        });

        it('leads with verified once a verifying test report is added', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied') });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });

            fs.writeFileSync(path.join(dir, 'test.md'), testReport('verified'));
            await provider.refreshIfDisplaying(path.join(dir, 'test.md'));

            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('verified');
            expect(lastRender()[ARG.badgeText]).toBe('VERIFIED');
        });

        it('steps the lead back when the test report, then the fix report, is deleted', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied'), test: testReport('verified') });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });
            expect(reportNav().page!.lead).toBe('verified');

            fs.rmSync(path.join(dir, 'test.md'));
            await provider.refreshIfDisplaying(path.join(dir, 'test.md'));
            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('fixed-untested');
            expect(actionLabels()).toEqual([['Test fix', true], ['Fix again', false]]);

            fs.rmSync(path.join(dir, 'fix.md'));
            await provider.refreshIfDisplaying(path.join(dir, 'fix.md'));
            expect(lastRender()[ARG.docType]).toBe('story');
            expect(reportNav().page!.lead).toBe('assessed');
            expect(actionLabels()).toEqual([['Fix bug', true]]);
        });

        it('follows a report rewritten in place', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied'), test: testReport('failed') });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });
            expect(reportNav().page!.lead).toBe('test-failed');

            fs.writeFileSync(path.join(dir, 'test.md'), testReport('verified'));
            await provider.refreshIfDisplaying(path.join(dir, 'test.md'));

            expect(reportNav().page!.lead).toBe('verified');
        });

        it('falls back to the raw assessment when the story can no longer be built', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT, fix: fixReport('applied') });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });
            expect(lastRender()[ARG.docType]).toBe('story');

            fs.writeFileSync(path.join(dir, 'assessment.md'), ASSESSMENT);
            await provider.refreshIfDisplaying(path.join(dir, 'assessment.md'));

            expect(lastRender()[ARG.docType]).toBe('assessment');
            expect(lastRender()[2]).toBe(ASSESSMENT);
            expect(reportNav().page).toBeUndefined();
        });

        it('says the folder is gone when the bug folder is deleted while the story is shown', async () => {
            const dir = makeBug('total-wrong', { assessment: TOLD_ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { report: 'bugs', landing: true });
            const panel = lastPanel();

            fs.rmSync(dir, { recursive: true, force: true });
            await provider.refreshIfDisplaying(dir);

            expect(panel.title).toBe('Bug: Total is wrong (moved)');
        });
    });

    describe('the next steps a bug offers', () => {
        it('offers Fix bug for a bug with only an assessment', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });

            expect(lastRender()[ARG.reportActions]).toEqual([{ id: 'bug.fix', label: 'Fix bug', primary: true }]);
        });

        it('offers Fix bug when the fix was not applied', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT, fix: fixReport('not-applied') });

            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            expect(actionLabels()).toEqual([['Fix bug', true]]);
        });

        it('offers Fix bug and Test again when the last test did not verify the fix', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT, fix: fixReport('applied'), test: testReport('failed') });

            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            expect(actionLabels()).toEqual([['Fix bug', true], ['Test again', false]]);
        });

        it('offers Test fix and Fix again for a bug waiting for a test', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT, fix: fixReport('applied') });

            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            expect(actionLabels()).toEqual([['Test fix', true], ['Fix again', false]]);
        });

        it('offers only Test again for a verified bug', async () => {
            await provider.show(path.join(CART, 'assessment.md'), { bug: true });

            expect(lastRender()[ARG.reportActions]).toEqual([{ id: 'bug.test', label: 'Test again', primary: false }]);
        });

        it('offers only Assess again for a closed bug', async () => {
            const dir = makeBug('not-a-bug', { assessment: '# Bug Assessment: Not a bug\n\n- **Verdict**: invalid\n' });

            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            expect(actionLabels()).toEqual([['Assess again', false]]);
        });

        it('changes the buttons when a fix report is added and the page refreshes', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });
            expect(actionLabels()).toEqual([['Fix bug', true]]);

            fs.writeFileSync(path.join(dir, 'fix.md'), fixReport('applied'));
            await provider.refreshIfDisplaying(path.join(dir, 'fix.md'));

            expect(actionLabels()).toEqual([['Test fix', true], ['Fix again', false]]);
        });
    });

    describe('choosing a next step', () => {
        it('sends the fix command with the folder name as the slug', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });

            await lastPanel().__receive({ type: 'reportAction', id: 'bug.fix' });

            expect(executeInTerminal).toHaveBeenCalledTimes(1);
            expect(executeInTerminal).toHaveBeenCalledWith('/speckit-bug-fix slug=slug-keeps-spaces');
        });

        it('takes the slug from the folder, not from the report text', async () => {
            const dir = makeBug('folder-name', { assessment: '# Bug Assessment: Total is wrong\n\n- **Slug**: other-name\n- **Verdict**: valid\n' });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            await lastPanel().__receive({ type: 'reportAction', id: 'bug.fix' });

            expect(executeInTerminal).toHaveBeenCalledWith('/speckit-bug-fix slug=folder-name');
        });

        it('points Assess again at the reports already in the folder', async () => {
            const dir = makeBug('not-a-bug', { assessment: '# Bug Assessment: Not a bug\n\n- **Verdict**: invalid\n' });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            await lastPanel().__receive({ type: 'reportAction', id: 'bug.assess' });

            expect(executeInTerminal).toHaveBeenCalledWith(
                '/speckit-bug-assess slug=not-a-bug Start again from the existing reports in .specify/bugs/not-a-bug/.',
            );
        });

        it('follows the files: a step the page did not offer at open is sent once its report exists', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });
            const panel = lastPanel();

            await panel.__receive({ type: 'reportAction', id: 'bug.test' });
            expect(executeInTerminal).not.toHaveBeenCalled();

            fs.writeFileSync(path.join(dir, 'fix.md'), fixReport('applied'));
            await panel.__receive({ type: 'reportAction', id: 'bug.test' });

            expect(executeInTerminal).toHaveBeenCalledWith('/speckit-bug-test slug=total-wrong');
        });

        it('sends nothing for a step the bug does not offer in its state', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });
            const panel = lastPanel();
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await panel.__receive({ type: 'reportAction', id: 'bug.test' });
            await panel.__receive({ type: 'reportAction', id: 'idea.createSpec' });

            expect(executeInTerminal).not.toHaveBeenCalled();
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        });

        it('catches the buttons up when a step the bug no longer offers is chosen', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });
            expect(actionLabels()).toEqual([['Fix bug', true]]);

            fs.writeFileSync(path.join(dir, 'fix.md'), fixReport('applied'));
            fs.writeFileSync(path.join(dir, 'test.md'), testReport('verified'));
            await lastPanel().__receive({ type: 'reportAction', id: 'bug.fix' });

            expect(executeInTerminal).not.toHaveBeenCalled();
            expect(actionLabels()).toEqual([['Test again', false]]);
        });

        it('sends nothing for an id that is not an action', async () => {
            await provider.show(path.join(SLUG, 'assessment.md'), { bug: true });
            const panel = lastPanel();
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await panel.__receive({ type: 'reportAction', id: 'constructor' });
            await panel.__receive({ type: 'reportAction', id: '__proto__' });
            await panel.__receive({ type: 'reportAction', id: 42 });
            await panel.__receive({ type: 'reportAction', id: ['bug.fix'] });
            await panel.__receive({ type: 'reportAction' });

            expect(executeInTerminal).not.toHaveBeenCalled();
            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        });

        it('sends nothing when the folder name is not safe to send as a slug', async () => {
            const dir = makeBug('bad name; rm', { assessment: ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            await lastPanel().__receive({ type: 'reportAction', id: 'bug.fix' });

            expect(executeInTerminal).not.toHaveBeenCalled();
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                'The folder "bad name; rm" has characters in its name that Companion will not send to a terminal. Rename it using only letters, digits and dashes.',
            );
        });

        it('sends nothing once the reports are gone', async () => {
            const dir = makeBug('total-wrong', { assessment: ASSESSMENT });
            await provider.show(path.join(dir, 'assessment.md'), { bug: true });

            fs.rmSync(path.join(dir, 'assessment.md'));
            await lastPanel().__receive({ type: 'reportAction', id: 'bug.fix' });

            expect(executeInTerminal).not.toHaveBeenCalled();
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
