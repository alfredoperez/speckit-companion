import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { SpecViewerProvider } from '../../../src/features/spec-viewer/specViewerProvider';

// The render that follows the click rebuilt the panel state, dropping the landing request.
function landingOf(panel: { webview: { html: string } }): unknown {
    const m = /window\.__INITIAL_NAV_STATE__ = (\{.*?\});/s.exec(panel.webview.html);
    if (!m) throw new Error('no initial nav state in html');
    return JSON.parse(m[1]).landing;
}

describe('opening a spec as a whole', () => {
    let specDir: string;

    beforeEach(() => {
        specDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-landing-')), '001-demo');
        fs.mkdirSync(specDir);
        (vscode.window.createWebviewPanel as jest.Mock).mockClear();
    });

    afterEach(() => fs.rmSync(path.dirname(specDir), { recursive: true, force: true }));

    it('keeps the landing request through the render that follows', async () => {
        const { context } = (vscode as unknown as {
            createMockExtensionContext: () => { context: vscode.ExtensionContext };
        }).createMockExtensionContext();
        const provider = new SpecViewerProvider(context, vscode.window.createOutputChannel('test'));

        await provider.showSpec(specDir);

        const panel = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;
        expect(landingOf(panel)).toBe('overview');
    });
});

describe('navigating inside an open panel', () => {
    let specDir: string;
    let provider: SpecViewerProvider;

    beforeEach(() => {
        specDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-nav-')), '001-demo');
        fs.mkdirSync(specDir);
        fs.writeFileSync(path.join(specDir, 'spec.md'), '# Spec\n');
        fs.writeFileSync(path.join(specDir, 'plan.md'), '# Plan\n');
        (vscode.window.createWebviewPanel as jest.Mock).mockClear();
        const { context } = (vscode as unknown as {
            createMockExtensionContext: () => { context: vscode.ExtensionContext };
        }).createMockExtensionContext();
        provider = new SpecViewerProvider(context, vscode.window.createOutputChannel('test'));
    });

    afterEach(() => fs.rmSync(path.dirname(specDir), { recursive: true, force: true }));

    function openPanel() {
        return (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;
    }

    function recordActivity(): void {
        fs.writeFileSync(
            path.join(specDir, '.spec-context.json'),
            JSON.stringify({ workflow: 'speckit', specName: '001-demo', currentStep: 'specify', status: 'specifying', approach: 'Do the thing', history: [] }),
        );
    }

    it('a rail click from the Overview lands on the document, and the tab says which', async () => {
        recordActivity();
        await provider.showSpec(specDir);
        const panel = openPanel();
        expect(panel.title).toBe('Spec: 001-demo - Overview');

        await panel.__receive({ type: 'stepperClick', phase: 'plan' });

        const update = panel.__lastPosted('contentUpdated');
        expect(update.navState.landing).toBe('document');
        expect(panel.title).toBe('Spec: 001-demo - Plan');
    });

    it('choosing the Overview again renames the tab back', async () => {
        recordActivity();
        await provider.showSpec(specDir);
        const panel = openPanel();
        await panel.__receive({ type: 'stepperClick', phase: 'plan' });

        await panel.__receive({ type: 'overviewChosen' });

        expect(panel.title).toBe('Spec: 001-demo - Overview');
    });

    it('a spec with nothing recorded has no Overview, so its tab keeps naming the document', async () => {
        await provider.showSpec(specDir);
        const panel = openPanel();
        expect(panel.title).toBe('Spec: 001-demo - Specification');
        await panel.__receive({ type: 'stepperClick', phase: 'plan' });

        await panel.__receive({ type: 'overviewChosen' });

        expect(panel.title).toBe('Spec: 001-demo - Plan');
    });

    it('a rail click after the folder moved says so instead of rendering a stale document', async () => {
        await provider.showSpec(specDir);
        const panel = openPanel();
        fs.renameSync(specDir, path.join(path.dirname(specDir), '001-renamed'));

        await panel.__receive({ type: 'stepperClick', phase: 'plan' });

        expect(panel.__lastPosted('specMoved')).toEqual({ type: 'specMoved', specDirectory: specDir });
        expect(panel.__lastPosted('contentUpdated')).toBeUndefined();
        expect(panel.title).toBe('Spec: 001-demo (moved)');
    });

    it('the folder watcher marks the panel without waiting for a click', async () => {
        await provider.showSpec(specDir);
        const panel = openPanel();
        fs.renameSync(specDir, path.join(path.dirname(specDir), '001-renamed'));

        provider.handleSpecDirectoryGone(specDir);

        expect(panel.__lastPosted('specMoved')).toBeDefined();
        expect(panel.title).toBe('Spec: 001-demo (moved)');
    });

    it('ignores a delete event for a folder that is still there', async () => {
        await provider.showSpec(specDir);
        const panel = openPanel();

        provider.handleSpecDirectoryGone(specDir);

        expect(panel.__lastPosted('specMoved')).toBeUndefined();
    });
});

describe('a document deleted while it is showing', () => {
    let specDir: string;
    let provider: SpecViewerProvider;

    beforeEach(() => {
        specDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-deleted-')), '001-demo');
        fs.mkdirSync(specDir);
        fs.writeFileSync(path.join(specDir, 'spec.md'), '# Spec\n');
        fs.writeFileSync(path.join(specDir, 'plan.md'), '# Plan\n');
        (vscode.window.createWebviewPanel as jest.Mock).mockClear();
        const { context } = (vscode as unknown as {
            createMockExtensionContext: () => { context: vscode.ExtensionContext };
        }).createMockExtensionContext();
        provider = new SpecViewerProvider(context, vscode.window.createOutputChannel('test'));
    });

    afterEach(() => fs.rmSync(path.dirname(specDir), { recursive: true, force: true }));

    function removedOf(panel: { webview: { html: string } }): unknown {
        const m = /window\.__INITIAL_NAV_STATE__ = (\{.*?\});/s.exec(panel.webview.html);
        if (!m) throw new Error('no initial nav state in html');
        return JSON.parse(m[1]).removedDocument;
    }

    async function showPlanThenDeleteIt() {
        await provider.showSpec(specDir);
        const panel = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value;
        await panel.__receive({ type: 'stepperClick', phase: 'plan' });
        const planPath = path.join(specDir, 'plan.md');
        fs.rmSync(planPath);
        provider.handleFileDeleted(planPath);
        await new Promise(resolve => setTimeout(resolve, 50));
        return panel;
    }

    it('names the deleted document in the render that falls back to another one', async () => {
        const panel = await showPlanThenDeleteIt();

        expect(removedOf(panel)).toBe('Plan');
    });

    it('stops naming it once the document is back', async () => {
        const panel = await showPlanThenDeleteIt();
        fs.writeFileSync(path.join(specDir, 'plan.md'), '# Plan\n');

        await provider.showSpec(specDir);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(removedOf(panel)).toBeNull();
    });

    it('stops naming it once the reader navigates', async () => {
        const panel = await showPlanThenDeleteIt();

        await panel.__receive({ type: 'stepperClick', phase: 'spec' });

        expect(panel.__lastPosted('contentUpdated').navState.removedDocument).toBeNull();
    });
});
