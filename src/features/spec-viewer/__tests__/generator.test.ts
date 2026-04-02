import * as vscode from 'vscode';
import { generateHtml } from '../html/generator';
import { SpecDocument, SpecStatus } from '../types';

// Mock phaseCalculation
jest.mock('../phaseCalculation', () => ({
    calculateWorkflowPhase: jest.fn().mockReturnValue('spec'),
}));

// Mock navigation — return empty string so it doesn't interfere with footer assertions
jest.mock('../html/navigation', () => ({
    generateCompactNav: jest.fn().mockReturnValue('<nav></nav>'),
}));

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

function renderFooter(opts: {
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

// Extracts the footer section from the generated HTML
function footerHtml(html: string): string {
    const start = html.indexOf('<footer');
    const end = html.indexOf('</footer>') + '</footer>'.length;
    return html.slice(start, end);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateHtml — footer button visibility', () => {
    describe('active status', () => {
        it('should show Regenerate, Archive, and "Plan" CTA when only spec.md exists', () => {
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', false), coreDoc('tasks', false)],
                currentDocType: 'spec',
                specStatus: 'active',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="regenerate"');
            expect(footer).toContain('id="archiveSpec"');
            expect(footer).toContain('id="approve"');
            expect(footer).toContain('>Plan</button>');
        });

        it('should show Regenerate, Archive, and "Tasks" CTA when spec+plan exist but no tasks', () => {
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', false)],
                currentDocType: 'plan',
                specStatus: 'active',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="regenerate"');
            expect(footer).toContain('id="archiveSpec"');
            expect(footer).toContain('id="approve"');
            expect(footer).toContain('>Tasks</button>');
        });

        it('should show Regenerate, Archive, and "Implement" CTA when all docs exist and tasks < 100%', () => {
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', true)],
                currentDocType: 'tasks',
                taskCompletion: 50,
                specStatus: 'active',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="regenerate"');
            expect(footer).toContain('id="archiveSpec"');
            expect(footer).toContain('id="approve"');
            expect(footer).toContain('>Implement</button>');
        });

        it('should show Regenerate and Archive but no CTA when next step already exists', () => {
            // Viewing spec, but plan already exists — no CTA needed
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', false)],
                currentDocType: 'spec',
                specStatus: 'active',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="regenerate"');
            expect(footer).toContain('id="archiveSpec"');
            expect(footer).not.toContain('id="approve"');
        });
    });

    describe('tasks-done status', () => {
        it('should show Archive and Complete(primary) but NO Regenerate', () => {
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', true)],
                currentDocType: 'tasks',
                taskCompletion: 100,
                specStatus: 'tasks-done',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="archiveSpec"');
            expect(footer).toContain('id="completeSpec"');
            expect(footer).toContain('class="primary"');
            expect(footer).not.toContain('id="regenerate"');
            expect(footer).not.toContain('id="approve"');
        });
    });

    describe('completed status', () => {
        it('should show Archive and Reactivate but NO Regenerate and NO CTA', () => {
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', true)],
                currentDocType: 'spec',
                specStatus: 'completed',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="archiveSpec"');
            expect(footer).toContain('id="reactivateSpec"');
            expect(footer).not.toContain('id="regenerate"');
            expect(footer).not.toContain('id="approve"');
            expect(footer).not.toContain('id="completeSpec"');
        });
    });

    describe('archived status', () => {
        it('should show Reactivate only', () => {
            const html = renderFooter({
                docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', true)],
                currentDocType: 'spec',
                specStatus: 'archived',
            });
            const footer = footerHtml(html);

            expect(footer).toContain('id="reactivateSpec"');
            expect(footer).not.toContain('id="archiveSpec"');
            expect(footer).not.toContain('id="regenerate"');
            expect(footer).not.toContain('id="approve"');
            expect(footer).not.toContain('id="completeSpec"');
        });
    });

    describe('completion badge removal', () => {
        it('should not render a completion-badge in any status', () => {
            const statuses: SpecStatus[] = ['active', 'tasks-done', 'completed', 'archived'];

            for (const status of statuses) {
                const html = renderFooter({
                    docs: [coreDoc('spec', true), coreDoc('plan', true), coreDoc('tasks', true)],
                    currentDocType: 'tasks',
                    taskCompletion: 100,
                    specStatus: status,
                });

                expect(html).not.toContain('completion-badge');
            }
        });
    });
});
