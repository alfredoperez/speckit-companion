import * as vscode from 'vscode';
import { generateHtml } from '../html/generator';
import { SpecDocument, SpecStatus } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function render(opts: {
    docs: SpecDocument[];
    currentDocType?: string;
    taskCompletion?: number;
    specStatus?: SpecStatus;
}): string {
    return generateHtml(
        mockWebview,
        extensionUri,
        'some content',
        'empty',
        opts.docs,
        (opts.currentDocType ?? 'spec') as any,
        'my-feature',
        [],
        opts.taskCompletion ?? 0,
        opts.specStatus ?? 'active',
        [],
        undefined
    );
}

// ---------------------------------------------------------------------------
// Tests — generator now emits placeholder containers for components
// ---------------------------------------------------------------------------

describe('generateHtml — shell structure', () => {
    it('should contain nav-root placeholder for NavigationBar component', () => {
        const html = render({
            docs: [coreDoc('spec', true), coreDoc('plan', false)],
        });
        expect(html).toContain('id="nav-root"');
    });

    it('should contain stale-banner-root placeholder for StaleBanner component', () => {
        const html = render({
            docs: [coreDoc('spec', true)],
        });
        expect(html).toContain('id="stale-banner-root"');
    });

    it('should contain header-root placeholder for SpecHeader component', () => {
        const html = render({
            docs: [coreDoc('spec', true)],
        });
        expect(html).toContain('id="header-root"');
    });

    it('should contain footer-root placeholder for FooterActions component', () => {
        const html = render({
            docs: [coreDoc('spec', true)],
        });
        expect(html).toContain('id="footer-root"');
    });

    it('should contain content area with markdown-content', () => {
        const html = render({
            docs: [coreDoc('spec', true)],
        });
        expect(html).toContain('id="content-area"');
        expect(html).toContain('id="markdown-content"');
    });

    it('should set data-spec-status on body', () => {
        const html = render({
            docs: [coreDoc('spec', true)],
            specStatus: 'completed',
        });
        expect(html).toContain('data-spec-status="completed"');
    });

    it('should contain refine modal elements', () => {
        const html = render({
            docs: [coreDoc('spec', true)],
        });
        expect(html).toContain('id="refine-backdrop"');
        expect(html).toContain('id="refine-popover"');
        expect(html).toContain('id="refine-input"');
    });

    it('should not render a completion-badge in any status', () => {
        const statuses: SpecStatus[] = ['active', 'tasks-done', 'completed', 'archived'];

        for (const status of statuses) {
            const html = render({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', true)],
                currentDocType: 'tasks',
                taskCompletion: 100,
                specStatus: status,
            });

            expect(html).not.toContain('completion-badge');
        }
    });

    it('should render empty state when no content', () => {
        const html = generateHtml(
            mockWebview,
            extensionUri,
            '',
            'No spec found',
            [coreDoc('spec', false)],
            'spec',
            'my-feature',
            [],
            0,
        );
        expect(html).toContain('No spec found');
        expect(html).toContain('empty-state');
    });
});
