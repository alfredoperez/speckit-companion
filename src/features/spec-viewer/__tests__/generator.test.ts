import * as vscode from 'vscode';
import { generateHtml } from '../html/generator';
import { SpecDocument, SpecStatus } from '../types';

const extensionUri = vscode.Uri.file('/mock/extension');

const mockWebview: vscode.Webview = {
    asWebviewUri: (uri: vscode.Uri) => uri,
    cspSource: 'mock-csp',
    html: '',
    onDidReceiveMessage: jest.fn() as any,
    postMessage: jest.fn() as any,
    options: {},
} as unknown as vscode.Webview;

function coreDoc(type: 'spec' | 'plan' | 'tasks', exists: boolean): SpecDocument {
    const labels: Record<string, string> = { spec: 'Spec', plan: 'Plan', tasks: 'Tasks' };
    return {
        type,
        label: labels[type],
        fileName: `${type}.md`,
        filePath: `/workspace/specs/my-feature/${type}.md`,
        exists,
        isCore: true,
        category: 'core',
    };
}

function renderHtml(opts: {
    docs: SpecDocument[];
    specStatus?: SpecStatus;
    content?: string;
}): string {
    return generateHtml(
        mockWebview, extensionUri,
        opts.content ?? 'some content', 'empty',
        opts.docs, 'spec', 'my-feature', [], 0,
        opts.specStatus ?? 'active', [],
    );
}

describe('generateHtml — shell structure', () => {
    it('should contain app-root for Preact mounting', () => {
        const html = renderHtml({ docs: [coreDoc('spec', true)] });
        expect(html).toContain('id="app-root"');
    });

    it('should set data-spec-status on body', () => {
        const html = renderHtml({ docs: [coreDoc('spec', true)], specStatus: 'completed' });
        expect(html).toContain('data-spec-status="completed"');
    });

    it('should contain initial-content template with raw data', () => {
        const html = renderHtml({ docs: [coreDoc('spec', true)], content: 'hello' });
        expect(html).toContain('id="initial-content"');
        expect(html).toContain('data-raw=');
    });

    it('should contain refine modal elements', () => {
        const html = renderHtml({ docs: [coreDoc('spec', true)] });
        expect(html).toContain('id="refine-backdrop"');
        expect(html).toContain('id="refine-popover"');
        expect(html).toContain('id="refine-input"');
    });

    it('should not render a completion-badge in any status', () => {
        for (const status of ['active', 'tasks-done', 'completed', 'archived'] as SpecStatus[]) {
            const html = renderHtml({ docs: [coreDoc('spec', true)], specStatus: status });
            expect(html).not.toContain('completion-badge');
        }
    });

    it('should render empty initial-content when no content', () => {
        const html = renderHtml({ docs: [coreDoc('spec', false)], content: '' });
        expect(html).toContain('id="initial-content"');
        expect(html).toContain('data-raw=""');
    });
});
