import { withHeaderLine } from '../../reports/reportMeta';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SpecViewerProvider } from '../specViewerProvider';
import type { SpecDocument } from '../types';
import type { IdeaDecision } from '../../reports/reportPageModel';

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

const IDEAS_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/idea-reports/.specify/assessments');
const SHARED = path.join(IDEAS_ROOT, 'shared-lists');
const OFFLINE = path.join(IDEAS_ROOT, 'offline-mode');
const GUEST = path.join(IDEAS_ROOT, 'guest-links');
const BADGES = path.join(IDEAS_ROOT, 'member-badges');
const PAGES_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/report-pages/.specify/assessments');
const FILTERS = path.join(PAGES_ROOT, 'saved-filters');
const ARCHIVE = path.join(PAGES_ROOT, 'bulk-archive');
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

function makeIdea(slug: string, stages: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-actions-'));
    tempRoots.push(root);
    const dir = path.join(root, '.specify', 'assessments', slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [stage, text] of Object.entries(stages)) fs.writeFileSync(path.join(dir, `${stage}.md`), text);
    return dir;
}

const INTAKE = '# Idea Intake: Dark mode\n';
const RESEARCH = '# Idea Research: Dark mode\n';
const decisionReport = (verdict: string) =>
    `# Decision: Dark mode\n\n- **Verdict**: ${verdict}\n\n## Verdict & Rationale\n\n**Decided.** Half the team asked for it. It is a small change.\n`;

function reportNav(): { kind: string; page?: IdeaDecision } {
    return lastRender()[ARG.report] as { kind: string; page?: IdeaDecision };
}

async function switchTo(panel: any, documentType: string): Promise<void> {
    const renders = (generateHtml as jest.Mock).mock.calls.length;
    await panel.__receive({ type: 'switchDocument', documentType });
    await until(() => (generateHtml as jest.Mock).mock.calls.length > renders);
    expect((generateHtml as jest.Mock).mock.calls.length).toBe(renders + 1);
}

function actions(): unknown {
    return lastRender()[ARG.reportActions];
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
        before = [SHARED, OFFLINE, GUEST, FILTERS, ARCHIVE].map(snapshot);
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
        expect([SHARED, OFFLINE, GUEST, FILTERS, ARCHIVE].map(snapshot)).toEqual(before);
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

    describe('landing on the decision', () => {
        it('opens an idea decided go on its decision, with the verdict and the handoff', async () => {
            await provider.show(path.join(FILTERS, 'intake.md'), { report: 'ideas', landing: true });

            const { kind, page } = reportNav();
            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(kind).toBe('idea');
            expect(page!.verdict).toBe('go');
            expect(page!.lead).toEqual(expect.any(String));
            expect(page!.scorecard.length).toBeGreaterThan(0);
            expect(page!.closing).toEqual(expect.objectContaining({ verdict: 'go' }));
            expect(lastRender()[ARG.badgeText]).toBe('GO');
        });

        it('opens an idea that needs clarification on its decision, with what is blocking', async () => {
            await provider.show(path.join(ARCHIVE, 'intake.md'), { report: 'ideas', landing: true });

            const { page } = reportNav();
            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(page!.verdict).toBe('needs-clarification');
            expect(page!.closing).toEqual(expect.objectContaining({ verdict: 'needs-clarification', revisit: 'research' }));
            expect((page!.closing as { questions: string[] }).questions).toHaveLength(3);
        });

        it('opens a killed idea on its decision, with the revisit trigger', async () => {
            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas', landing: true });

            const { page } = reportNav();
            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(page!.verdict).toBe('kill');
            expect(page!.closing).toEqual({ verdict: 'kill', trigger: expect.any(String) });
        });

        it('reads the verdict of the decision page whatever its letter case', async () => {
            await provider.show(path.join(GUEST, 'decision.md'), { report: 'ideas', landing: true });

            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(reportNav().page!.verdict).toBe('needs-clarification');
        });

        it('still passes the decision file as the content behind the page', async () => {
            await provider.show(path.join(FILTERS, 'intake.md'), { report: 'ideas', landing: true });

            expect(lastRender()[2]).toBe(withHeaderLine('decision', fs.readFileSync(path.join(FILTERS, 'decision.md'), 'utf-8')));
        });

        it('opens an idea still being assessed on its latest stage, with no page', async () => {
            await provider.show(path.join(OFFLINE, 'intake.md'), { report: 'ideas', landing: true });

            expect(lastRender()[ARG.docType]).toBe('research');
            expect(reportNav().kind).toBe('idea');
            expect(reportNav().page).toBeUndefined();
            expect(lastRender()[2]).toBe(withHeaderLine('research', fs.readFileSync(path.join(OFFLINE, 'research.md'), 'utf-8')));
        });

        it('opens the latest stage written even when earlier stages were skipped', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, concept: '# Concept: Dark mode\n' });

            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });

            expect(lastRender()[ARG.docType]).toBe('concept');
            expect(reportNav().page).toBeUndefined();
        });

        it('shows the raw decision, with no page, for a verdict it does not recognise', async () => {
            const decision = decisionReport('maybe');
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision });

            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });

            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(lastRender()[2]).toBe(withHeaderLine('decision', decision));
            expect(reportNav().kind).toBe('idea');
            expect(reportNav().page).toBeUndefined();
            expect(lastRender()[ARG.badgeText]).toBe('IDEA');
        });

        it('shows the raw decision, with no page, when the decision has no section the page can use', async () => {
            const decision = '# Decision: Dark mode\n\n- **Verdict**: go\n';
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision });

            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });

            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(lastRender()[2]).toBe(withHeaderLine('decision', decision));
            expect(reportNav().page).toBeUndefined();
        });

        it('opens the clicked stage, with no page, when the open is not a landing', async () => {
            await provider.show(path.join(FILTERS, 'intake.md'), { report: 'ideas' });

            expect(lastRender()[ARG.docType]).toBe('intake');
            expect(reportNav().kind).toBe('idea');
            expect(reportNav().page).toBeUndefined();
        });

        it('shows the decision page when the decision stage itself is clicked', async () => {
            await provider.show(path.join(FILTERS, 'decision.md'), { report: 'ideas' });

            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(reportNav().page!.verdict).toBe('go');
        });

        it('keeps the five stages as the documents, with nothing ahead of Intake', async () => {
            await provider.show(path.join(FILTERS, 'intake.md'), { report: 'ideas', landing: true });

            expect((lastRender()[ARG.documents] as SpecDocument[]).map(d => d.type)).toEqual([
                'intake',
                'research',
                'problem',
                'concept',
                'decision',
            ]);
        });

        it('names a bug panel as a bug and an idea panel as an idea', async () => {
            await provider.show(path.join(BUG, 'assessment.md'), { report: 'bugs' });
            expect(reportNav().kind).toBe('bug');

            await provider.show(path.join(SHARED, 'intake.md'), { report: 'ideas' });
            expect(reportNav().kind).toBe('idea');
        });
    });

    describe('moving between the decision and the stages', () => {
        it('shows a stage with no page, then the decision again with its page', async () => {
            await provider.show(path.join(FILTERS, 'intake.md'), { report: 'ideas', landing: true });
            const panel = lastPanel();

            await switchTo(panel, 'concept');
            expect(lastRender()[ARG.docType]).toBe('concept');
            expect(reportNav().page).toBeUndefined();

            await switchTo(panel, 'decision');
            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(reportNav().page!.verdict).toBe('go');
            expect(droppedMessages()).toHaveLength(0);
        });

        it('keeps the same button on the decision and on every stage', async () => {
            await provider.show(path.join(FILTERS, 'intake.md'), { report: 'ideas', landing: true });
            const panel = lastPanel();
            expect(actions()).toEqual([{ id: 'idea.createSpec', label: 'Create spec from this idea', primary: true }]);
            const onDecision = actions();

            for (const stage of ['intake', 'research', 'problem', 'concept', 'decision']) {
                await panel.__receive({ type: 'stepperClick', phase: stage });

                expect(lastRender()[ARG.docType]).toBe(stage);
                expect(actions()).toEqual(onDecision);
            }
        });

        it('shows a stage that was never written as not created, with no page', async () => {
            await provider.show(path.join(ARCHIVE, 'intake.md'), { report: 'ideas', landing: true });

            await lastPanel().__receive({ type: 'stepperClick', phase: 'concept' });

            expect(lastRender()[ARG.docType]).toBe('concept');
            expect(lastRender()[2]).toBe('');
            expect(reportNav().page).toBeUndefined();
        });
    });

    describe('the decision following the files on disk', () => {
        it('shows the page once the decision on screen is given a verdict it recognises', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision: decisionReport('maybe') });
            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });
            expect(reportNav().page).toBeUndefined();

            fs.writeFileSync(path.join(dir, 'decision.md'), decisionReport('go'));
            await provider.refreshIfDisplaying(path.join(dir, 'decision.md'));

            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(reportNav().page).toEqual(expect.objectContaining({ verdict: 'go', lead: 'Half the team asked for it.' }));
            expect(actions()).toEqual([{ id: 'idea.createSpec', label: 'Create spec from this idea', primary: true }]);
        });

        it('changes the verdict on the page when the decision is rewritten', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision: decisionReport('go') });
            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });
            expect(reportNav().page!.verdict).toBe('go');

            fs.writeFileSync(path.join(dir, 'decision.md'), decisionReport('kill'));
            await provider.refreshIfDisplaying(path.join(dir, 'decision.md'));

            expect(reportNav().page!.verdict).toBe('kill');
            expect(lastRender()[ARG.badgeText]).toBe('KILL');
        });

        it('drops the page when the decision on screen is deleted', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision: decisionReport('go') });
            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });

            fs.rmSync(path.join(dir, 'decision.md'));
            await provider.refreshIfDisplaying(path.join(dir, 'decision.md'));

            expect(lastRender()[ARG.docType]).toBe('decision');
            expect(lastRender()[2]).toBe('');
            expect(reportNav().page).toBeUndefined();
            expect(existsByType().decision).toBe(false);
        });

        it('stays on the stage being read when a decision is written, and shows the page once asked', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, research: RESEARCH });
            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas', landing: true });
            expect(lastRender()[ARG.docType]).toBe('research');

            fs.writeFileSync(path.join(dir, 'decision.md'), decisionReport('go'));
            await provider.refreshIfDisplaying(path.join(dir, 'decision.md'));
            expect(lastRender()[ARG.docType]).toBe('research');
            expect(reportNav().page).toBeUndefined();
            expect(existsByType().decision).toBe(true);

            await lastPanel().__receive({ type: 'stepperClick', phase: 'decision' });
            expect(reportNav().page!.verdict).toBe('go');
        });
    });

    describe('the next step an idea offers', () => {
        it('offers Research for an idea at intake', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE });

            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.research', label: 'Research', primary: true }]);
        });

        it('offers Define the problem for an idea at research', async () => {
            await provider.show(path.join(OFFLINE, 'intake.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.define', label: 'Define the problem', primary: true }]);
        });

        it('offers Shape a concept for an idea at problem', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, problem: '# Problem Definition: Dark mode\n' });

            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.shape', label: 'Shape a concept', primary: true }]);
        });

        it('offers Decide for an idea at concept', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, concept: '# Concept: Dark mode\n' });

            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.decide', label: 'Decide', primary: true }]);
        });

        it('offers Create spec for an idea decided go', async () => {
            await provider.show(path.join(BADGES, 'decision.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.createSpec', label: 'Create spec from this idea', primary: true }]);
        });

        it('offers Continue assessment for an idea that needs clarification', async () => {
            await provider.show(path.join(GUEST, 'decision.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.research', label: 'Continue assessment', primary: true }]);
        });

        it('offers only Reopen from intake for a killed idea', async () => {
            await provider.show(path.join(SHARED, 'decision.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.intake', label: 'Reopen from intake', primary: false }]);
        });

        it('offers Decide for a decision with no known verdict', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision: '# Decision: Dark mode\n\n- **Verdict**: maybe\n' });

            await provider.show(path.join(dir, 'decision.md'), { report: 'ideas' });

            expect(actions()).toEqual([{ id: 'idea.decide', label: 'Decide', primary: true }]);
        });

        it('changes the button when the next stage is written and the page refreshes', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE });
            await provider.show(path.join(dir, 'intake.md'), { report: 'ideas' });

            fs.writeFileSync(path.join(dir, 'research.md'), '# Idea Research: Dark mode\n');
            await provider.refreshIfDisplaying(path.join(dir, 'research.md'));

            expect(actions()).toEqual([{ id: 'idea.define', label: 'Define the problem', primary: true }]);
        });
    });

    describe('choosing a next step', () => {
        it('sends the next stage command with the folder name as the slug', async () => {
            await provider.show(path.join(OFFLINE, 'intake.md'), { report: 'ideas' });

            await lastPanel().__receive({ type: 'reportAction', id: 'idea.define' });

            expect(executeInTerminal).toHaveBeenCalledTimes(1);
            expect(executeInTerminal).toHaveBeenCalledWith('/speckit-assess-define slug=offline-mode');
        });

        it('points Reopen from intake at the reports already in the folder', async () => {
            await provider.show(path.join(SHARED, 'decision.md'), { report: 'ideas' });

            await lastPanel().__receive({ type: 'reportAction', id: 'idea.intake' });

            expect(executeInTerminal).toHaveBeenCalledWith(
                '/speckit-assess-intake slug=shared-lists Start again from the existing reports in .specify/assessments/shared-lists/.',
            );
        });

        it('opens Create Spec for a go idea, filled with its title, rationale and folder, and sends nothing', async () => {
            await provider.show(path.join(BADGES, 'decision.md'), { report: 'ideas' });
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await lastPanel().__receive({ type: 'reportAction', id: 'idea.createSpec' });

            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'speckit.openSpecEditor',
                'Member status badges\n\n' +
                    '**Go.** Three requesters, a small change, and no constitution conflict.\n\n' +
                    'Assessment: .specify/assessments/member-badges/',
            );
            expect(executeInTerminal).not.toHaveBeenCalled();
        });

        it('fills Create Spec with the title and folder when the decision has no rationale section', async () => {
            const dir = makeIdea('dark-mode', { intake: INTAKE, decision: '# Decision: Dark mode\n\n- **Verdict**: go\n' });
            await provider.show(path.join(dir, 'decision.md'), { report: 'ideas' });
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await lastPanel().__receive({ type: 'reportAction', id: 'idea.createSpec' });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'speckit.openSpecEditor',
                'Dark mode\n\nAssessment: .specify/assessments/dark-mode/',
            );
        });

        it('does not open Create Spec for an idea that is not decided go', async () => {
            await provider.show(path.join(SHARED, 'decision.md'), { report: 'ideas' });
            const panel = lastPanel();
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await panel.__receive({ type: 'reportAction', id: 'idea.createSpec' });
            await panel.__receive({ type: 'reportAction', id: 'idea.decide' });
            await panel.__receive({ type: 'reportAction', id: 'constructor' });
            await panel.__receive({ type: 'reportAction', id: 7 });

            expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
            expect(executeInTerminal).not.toHaveBeenCalled();
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
