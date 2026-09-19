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
