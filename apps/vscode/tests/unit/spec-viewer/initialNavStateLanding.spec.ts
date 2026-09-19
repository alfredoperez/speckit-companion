import * as vscode from 'vscode';
import { generateHtml } from '../../../src/features/spec-viewer/html/generator';

/**
 * The first render is the one a tree click lands on, and the webview's own
 * state does not survive an HTML reassignment. So the entry point's request has
 * to ride on the initial nav state — the later navigation update is too late,
 * and that is exactly where the fix was first put and first missed.
 */
function render(landing?: 'overview' | 'document'): string {
    const webview = { asWebviewUri: (u: unknown) => u, cspSource: 'x' } as unknown as vscode.Webview;
    return generateHtml(
        webview, vscode.Uri.file('/ext'), '# hi', '', [], 'spec' as never, 'spec', [], 0,
        undefined, [], {}, null, null, null, null, null, null, null, null, undefined,
        true, null, undefined, undefined, undefined, landing,
    );
}

function initialNavState(html: string): Record<string, unknown> {
    const m = /window\.__INITIAL_NAV_STATE__ = (\{.*?\});/s.exec(html);
    if (!m) throw new Error('no initial nav state in html');
    return JSON.parse(m[1]);
}

describe('the initial nav state carries the entry point\'s landing request', () => {
    it('says document when a tree click asked for a document', () => {
        expect(initialNavState(render('document')).landing).toBe('document');
    });

    it('says nothing when the spec was opened as a whole', () => {
        expect(initialNavState(render(undefined))).not.toHaveProperty('landing');
    });
});
