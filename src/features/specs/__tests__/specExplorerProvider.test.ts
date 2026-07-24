import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    SpecExplorerProvider,
    lifecycleContextValue,
    isSpecLifecycleItem,
    isSpecGroupItem,
} from '../specExplorerProvider';
import { SpecsFilterState } from '../specsFilterState';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock the specDirectoryResolver
jest.mock('../../../core/specDirectoryResolver', () => ({
    resolveSpecDirectories: jest.fn().mockResolvedValue([]),
    hasDuplicateNames: jest.fn().mockReturnValue(new Set()),
    deriveChangeRoot: jest.fn().mockReturnValue(null),
}));

// Mock the workflows module
jest.mock('../../workflows', () => ({
    getFeatureWorkflow: jest.fn().mockResolvedValue(null),
    getOrSelectWorkflow: jest.fn().mockResolvedValue(null),
    resolveWorkflow: jest.fn().mockResolvedValue(null),
    getWorkflow: jest.fn().mockReturnValue(null),
    normalizeWorkflowConfig: jest.fn(),
    getStepFile: jest.fn((step: any) => step.file || `${step.name}.md`),
    DEFAULT_WORKFLOW: {
        steps: [
            { name: 'specify', label: 'Specify', file: 'spec.md' },
            { name: 'plan', label: 'Plan', file: 'plan.md' },
            { name: 'tasks', label: 'Tasks', file: 'tasks.md' },
        ],
    },
}));

// Mock specContextManager — keep the real deriveSpecName so the readable-name
// resolver humanizes slugs exactly as it does at runtime.
jest.mock('../specContextManager', () => ({
    readSpecContextSync: jest.fn().mockReturnValue(undefined),
    deriveSpecName: jest.requireActual('../specContextManager').deriveSpecName,
}));

// Companion installed by default so the pinned CTA row is absent for pre-existing tree-shape tests; CTA tests flip this to false.
jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(true),
}));

import { resolveSpecDirectories, hasDuplicateNames } from '../../../core/specDirectoryResolver';
import { readSpecContextSync } from '../specContextManager';
import { isCompanionInstalled } from '../../settings/companionPresetReconciler';

const WORKSPACE_ROOT = '/workspace';

function createMockContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: '/mock/extension',
        extensionUri: vscode.Uri.file('/mock/extension'),
        globalState: { get: jest.fn(), update: jest.fn() } as any,
        workspaceState: { get: jest.fn(), update: jest.fn() } as any,
    } as unknown as vscode.ExtensionContext;
}

function createMockOutputChannel(): vscode.OutputChannel {
    return {
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    } as unknown as vscode.OutputChannel;
}

function setupWorkspaceFolder() {
    (vscode.workspace as any).workspaceFolders = [
        { uri: vscode.Uri.file(WORKSPACE_ROOT), name: 'workspace', index: 0 },
    ];
}

function clearWorkspaceFolder() {
    (vscode.workspace as any).workspaceFolders = undefined;
}

describe('SpecExplorerProvider', () => {
    let provider: SpecExplorerProvider;
    let context: vscode.ExtensionContext;
    let outputChannel: vscode.OutputChannel;

    beforeEach(() => {
        jest.clearAllMocks();
        context = createMockContext();
        outputChannel = createMockOutputChannel();
        provider = new SpecExplorerProvider(context, outputChannel);
        setupWorkspaceFolder();

        // Default fs mocks
        (mockFs.readdirSync as jest.Mock).mockReturnValue([]);
        (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: new Date(0) });
        (mockFs.existsSync as jest.Mock).mockReturnValue(false);
        (mockFs.readFileSync as jest.Mock).mockReturnValue('');
    });

    afterEach(() => {
        clearWorkspaceFolder();
    });

    describe('setActiveSpec', () => {
        it('should set activeSpecName', () => {
            provider.setActiveSpec('my-feature');
            expect(provider.activeSpecName).toBe('my-feature');
        });

        it('should fire tree data change event', () => {
            const listener = jest.fn();
            provider.onDidChangeTreeData(listener);

            provider.setActiveSpec('my-feature');

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('getChildren - root level grouping', () => {
        it('should return empty array when no workspace folders', async () => {
            clearWorkspaceFolder();
            const children = await provider.getChildren();
            expect(children).toEqual([]);
        });

        it('should return empty array when no specs found', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([]);
            const children = await provider.getChildren();
            expect(children).toEqual([]);
        });

        it('should group specs with no context file under Active by default', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature-a', path: 'specs/feature-a' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Active (1)');
            expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should group specs with status active under Active', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature-a', path: 'specs/feature-a' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'active' });

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Active (1)');
            expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should group specs with status completed under Completed', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'done-feature', path: 'specs/done-feature' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'completed' });

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Completed (1)');
            expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('should group specs with status archived under Archived', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'old-feature', path: 'specs/old-feature' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'archived' });

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Archived (1)');
            expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('should show all three groups when specs span all statuses', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'active-feature', path: 'specs/active-feature' },
                { name: 'done-feature', path: 'specs/done-feature' },
                { name: 'old-feature', path: 'specs/old-feature' },
            ]);

            (readSpecContextSync as jest.Mock).mockImplementation((specPath: string) => {
                if (specPath.includes('active-feature')) {
                    return { status: 'active' };
                }
                if (specPath.includes('done-feature')) {
                    return { status: 'completed' };
                }
                if (specPath.includes('old-feature')) {
                    return { status: 'archived' };
                }
                return undefined;
            });

            const children = await provider.getChildren();

            expect(children).toHaveLength(3);
            expect(children[0].label).toBe('Active (1)');
            expect(children[1].label).toBe('Completed (1)');
            expect(children[2].label).toBe('Archived (1)');
        });

        it('should omit empty groups', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'done-feature', path: 'specs/done-feature' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'completed' });

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Completed (1)');
            // No Active or Archived groups
        });

        it('should group an implemented spec under Active so it can still be marked complete', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'shipped-feature', path: 'specs/shipped-feature' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'implemented' });

            const children = await provider.getChildren();

            // Implemented is done-but-not-user-completed: it stays in Active so
            // the still-needs-mark-complete state remains visible. Only
            // `completed` specs surface under Completed.
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Active (1)');
            expect(children.some(c => c.label?.startsWith('Completed'))).toBe(false);
        });

        it('should split an implemented spec into Active and a completed spec into Completed', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'shipped-feature', path: 'specs/shipped-feature' },
                { name: 'done-feature', path: 'specs/done-feature' },
            ]);
            (readSpecContextSync as jest.Mock).mockImplementation((specPath: string) => {
                if (specPath.includes('shipped-feature')) {
                    return { status: 'implemented' };
                }
                return { status: 'completed' };
            });

            const children = await provider.getChildren();

            expect(children[0].label).toBe('Active (1)');
            expect(children[1].label).toBe('Completed (1)');
        });
    });

    describe('spec-group icons', () => {
        async function groupIcon(status: string | undefined): Promise<vscode.ThemeIcon> {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(status ? { status } : undefined);
            const children = await provider.getChildren();
            return children[0].iconPath as vscode.ThemeIcon;
        }

        it('uses the pulse codicon for the Active group', async () => {
            const icon = await groupIcon(undefined);
            expect(icon).toBeInstanceOf(vscode.ThemeIcon);
            expect(icon.id).toBe('pulse');
        });

        it('uses a passed-tinted check for the Completed group', async () => {
            const icon = await groupIcon('completed');
            expect(icon.id).toBe('pass-filled');
            expect(icon.color).toBeDefined();
        });

        it('uses the archive codicon for the Archived group', async () => {
            const icon = await groupIcon('archived');
            expect(icon.id).toBe('archive');
        });

        it('never renders a bundled SVG for a group', async () => {
            for (const status of [undefined, 'completed', 'archived']) {
                const icon = await groupIcon(status);
                expect(icon).not.toBeInstanceOf(vscode.Uri);
            }
        });
    });

    describe('opening a spec from its name', () => {
        async function getSpecItems(specName: string): Promise<any[]> {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);

            const groups = await provider.getChildren();
            return provider.getChildren(groups[0]);
        }

        it('gives the spec row an open command carrying its spec directory', async () => {
            const specs = await getSpecItems('my-feature');

            expect(specs[0].command).toEqual({
                command: 'speckit.openSpec',
                title: 'Open my-feature',
                arguments: [path.join(WORKSPACE_ROOT, 'specs/my-feature')],
            });
        });

        it('keeps the spec row collapsible so the chevron still browses', async () => {
            const specs = await getSpecItems('my-feature');

            expect(specs[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('leaves document rows opening their own document', async () => {
            (mockFs.existsSync as jest.Mock).mockReturnValue(true);
            (mockFs.readFileSync as jest.Mock).mockReturnValue('# Spec\n\na\nb\nc\nd\n');
            const specs = await getSpecItems('my-feature');

            const docs = await provider.getChildren(specs[0]);

            expect(docs[0].command?.command).toBe('speckit.viewSpecDocument');
        });
    });

    describe('readable spec names (#502)', () => {
        async function getSpecRow(specName: string, specContext?: any): Promise<any> {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(specContext || undefined);
            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            return specs[0];
        }

        it('labels a row with the recorded specName when one is present', async () => {
            const row = await getSpecRow('515-readable-spec-names', {
                workflow: 'default',
                currentStep: 'specify',
                status: 'draft',
                specName: 'Readable Spec Names',
            });
            expect(row.label).toBe('Readable Spec Names');
        });

        it('labels a row with the humanized slug when no name is recorded', async () => {
            const row = await getSpecRow('406-living-spec-components');
            expect(row.label).toBe('Living Spec Components');
        });

        it('keeps the slug as the identifier: open command still carries the slug directory', async () => {
            const row = await getSpecRow('515-readable-spec-names', {
                workflow: 'default',
                currentStep: 'specify',
                status: 'draft',
                specName: 'Readable Spec Names',
            });
            expect(row.command).toEqual({
                command: 'speckit.openSpec',
                title: 'Open 515-readable-spec-names',
                arguments: [path.join(WORKSPACE_ROOT, 'specs/515-readable-spec-names')],
            });
        });

        it('keeps duplicate-name disambiguation keyed on the slug, not the readable label', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'my-feature', path: 'specs/a/my-feature' },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set(['my-feature']));
            (readSpecContextSync as jest.Mock).mockReturnValue({
                workflow: 'default',
                currentStep: 'specify',
                status: 'draft',
                specName: 'My Feature',
            });
            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            expect(specs[0].label).toBe('My Feature');
            expect(specs[0].description).toBe('specs/a');
        });
    });

    describe('spec item icons based on active state and context', () => {
        async function getSpecItems(
            specName: string,
            isActive: boolean,
            specContext?: any
        ): Promise<any[]> {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            // Root-level getSpecStatus returns active
            (readSpecContextSync as jest.Mock).mockReturnValue(specContext || undefined);

            if (isActive) {
                provider.setActiveSpec(specName);
            }

            const groups = await provider.getChildren();
            return provider.getChildren(groups[0]);
        }

        it('should use sync~spin icon when spec is active', async () => {
            const specs = await getSpecItems('my-feature', true);
            expect(specs[0].iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((specs[0].iconPath as vscode.ThemeIcon).id).toBe('sync~spin');
        });

        it('should use a plain beaker when spec is not active and has no context', async () => {
            const specs = await getSpecItems('my-feature', false);
            expect(specs[0].iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((specs[0].iconPath as vscode.ThemeIcon).id).toBe('beaker');
        });

        it('should use a green beaker when spec status is completed', async () => {
            const specs = await getSpecItems('my-feature', false, {
                status: 'completed',
                workflow: 'default',
                selectedAt: '2026-01-01',
            });
            const icon = specs[0].iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('beaker');
            expect((icon.color as vscode.ThemeColor).id).toBe('testing.iconPassed');
        });

        it('should use a blue beaker when spec has a currentStep', async () => {
            const specs = await getSpecItems('my-feature', false, {
                status: 'active',
                currentStep: 'plan',
                workflow: 'default',
                selectedAt: '2026-01-01',
            });
            const icon = specs[0].iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('beaker');
            expect((icon.color as vscode.ThemeColor).id).toBe('charts.blue');
        });

        it('should use a yellow beaker for implemented specs, distinct from green completed and blue in-progress', async () => {
            const specs = await getSpecItems('my-feature', false, {
                status: 'implemented',
                currentStep: 'implement',
                workflow: 'default',
                selectedAt: '2026-01-01',
            });
            const icon = specs[0].iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('beaker');
            expect((icon.color as vscode.ThemeColor).id).toBe('charts.yellow');
            expect((icon.color as vscode.ThemeColor).id).not.toBe('testing.iconPassed');
            expect((icon.color as vscode.ThemeColor).id).not.toBe('charts.blue');
        });

        it('should prefer sync~spin over the colored beaker when spec is active', async () => {
            const specs = await getSpecItems('my-feature', true, {
                status: 'active',
                currentStep: 'plan',
                workflow: 'default',
                selectedAt: '2026-01-01',
            });
            const icon = specs[0].iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('sync~spin');
        });
    });

    describe('step document colored icons', () => {
        async function getDocumentItems(
            specContext: any,
            fileContent = '# Title\nLine 2\nLine 3\nLine 4\nLine 5',
        ): Promise<any[]> {
            const specName = 'my-feature';
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(specContext || undefined);
            (mockFs.existsSync as jest.Mock).mockReturnValue(true);
            (mockFs.readFileSync as jest.Mock).mockReturnValue(fileContent);

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            return provider.getChildren(specs[0]);
        }

        it('should show green pass icon for completed steps', async () => {
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'plan',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
                    plan: { startedAt: '2026-01-01T01:00:00Z', completedAt: null },
                },
            });

            // 'specify' step (first doc) should have green pass icon
            const specifyDoc = docs.find((d: any) => d.label === 'Specification' || d.label === 'Specify');
            expect(specifyDoc).toBeDefined();
            const icon = specifyDoc!.iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('pass');
            expect(icon.color).toBeInstanceOf(vscode.ThemeColor);
            expect((icon.color as vscode.ThemeColor).id).toBe('testing.iconPassed');
        });

        it('infers completion from currentStep when stepHistory is absent', async () => {
            // Regression: previously the provider guarded the isStepCompleted call with
            // `stepHistory &&`, which meant specs with no stepHistory never rendered green
            // icons even though currentStep had clearly moved past earlier steps.
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'implement',
                // No stepHistory field at all.
            });

            const specifyDoc = docs.find((d: any) => d.label === 'Specification' || d.label === 'Specify');
            const planDoc = docs.find((d: any) => d.label === 'Plan');
            const tasksDoc = docs.find((d: any) => d.label === 'Tasks');

            for (const doc of [specifyDoc, planDoc, tasksDoc]) {
                expect(doc).toBeDefined();
                const icon = doc!.iconPath as vscode.ThemeIcon;
                expect(icon.id).toBe('pass');
                expect((icon.color as vscode.ThemeColor).id).toBe('testing.iconPassed');
            }
        });

        it('should show blue circle-filled icon for current step', async () => {
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'plan',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
                    plan: { startedAt: '2026-01-01T01:00:00Z', completedAt: null },
                },
            });

            // 'plan' step should have blue circle-filled icon
            const planDoc = docs.find((d: any) => d.label === 'Plan');
            expect(planDoc).toBeDefined();
            const icon = planDoc!.iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('circle-filled');
            expect(icon.color).toBeInstanceOf(vscode.ThemeColor);
            expect((icon.color as vscode.ThemeColor).id).toBe('charts.blue');
        });

        it('gives an existing, non-current, uncompleted step a muted outline', async () => {
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'specify',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: null },
                },
            });

            const tasksDoc = docs.find((d: any) => d.label === 'Tasks');
            expect(tasksDoc).toBeDefined();
            const icon = tasksDoc!.iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('circle-outline');
            expect(icon.color).toBeUndefined();
        });

        it('should use currentStep for in-progress icon (migration maps step→currentStep)', async () => {
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                step: 'tasks',
                currentStep: 'plan',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
                    plan: { startedAt: '2026-01-01T01:00:00Z', completedAt: null },
                },
            });

            // 'plan' step (currentStep) should have blue circle-filled icon
            const planDoc = docs.find((d: any) => d.label === 'Plan');
            expect(planDoc).toBeDefined();
            const planIcon = planDoc!.iconPath as vscode.ThemeIcon;
            expect(planIcon.id).toBe('circle-filled');
            expect((planIcon.color as vscode.ThemeColor).id).toBe('charts.blue');

            // 'tasks' should NOT have the blue dot (currentStep is 'plan', not 'tasks')
            const tasksDoc = docs.find((d: any) => d.label === 'Tasks');
            expect(tasksDoc).toBeDefined();
            expect((tasksDoc!.iconPath as vscode.ThemeIcon).id).toBe('circle-outline');
        });

        it('should fall back to currentStep when step field is absent', async () => {
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'plan',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
                    plan: { startedAt: '2026-01-01T01:00:00Z', completedAt: null },
                },
            });

            // 'plan' step should have blue circle-filled icon via currentStep fallback
            const planDoc = docs.find((d: any) => d.label === 'Plan');
            expect(planDoc).toBeDefined();
            const icon = planDoc!.iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('circle-filled');
            expect((icon.color as vscode.ThemeColor).id).toBe('charts.blue');
        });

        it('should show green pass icon regardless of step field when completedAt is set', async () => {
            const docs = await getDocumentItems({
                workflow: 'default',
                selectedAt: '2026-01-01',
                step: 'specify',
                currentStep: 'plan',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
                },
            });

            // 'specify' has completedAt — green pass icon takes precedence over step field
            const specifyDoc = docs.find((d: any) => d.label === 'Specification' || d.label === 'Specify');
            expect(specifyDoc).toBeDefined();
            const icon = specifyDoc!.iconPath as vscode.ThemeIcon;
            expect(icon.id).toBe('pass');
            expect((icon.color as vscode.ThemeColor).id).toBe('testing.iconPassed');
        });

        it.each(['completed', 'archived'])(
            'still shows completed step icons under a %s spec',
            async status => {
                const docs = await getDocumentItems({
                    workflow: 'default',
                    selectedAt: '2026-01-01',
                    status,
                    currentStep: 'implement',
                    stepHistory: {
                        specify: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
                        plan: { startedAt: '2026-01-01T01:00:00Z', completedAt: '2026-01-01T02:00:00Z' },
                        tasks: { startedAt: '2026-01-01T02:00:00Z', completedAt: '2026-01-01T03:00:00Z' },
                    },
                });

                expect(docs.length).toBeGreaterThan(0);
                for (const doc of docs) {
                    const icon = doc.iconPath as vscode.ThemeIcon;
                    expect(icon.id).toBe('pass');
                    expect((icon.color as vscode.ThemeColor).id).toBe('testing.iconPassed');
                    expect(doc.tooltip).toContain('Complete');
                }
            }
        );

        it('does not green-check a stub document under a completed spec, and its tooltip agrees', async () => {
            const docs = await getDocumentItems(
                {
                    workflow: 'default',
                    selectedAt: '2026-01-01',
                    status: 'completed',
                    currentStep: 'implement',
                },
                '# Title\nOne line of body',
            );

            expect(docs.length).toBeGreaterThan(0);
            for (const doc of docs) {
                const icon = doc.iconPath as vscode.ThemeIcon;
                expect(icon.id).toBe('circle-filled');
                expect((icon.color as vscode.ThemeColor).id).toBe('charts.blue');
                expect(icon.id).not.toBe('pass');
                expect(doc.tooltip).toContain('In Progress');
            }
        });

        it('leaves a missing document iconless and marks it not created', async () => {
            const specName = 'my-feature';
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue({
                workflow: 'default',
                currentStep: 'specify',
                status: 'specifying',
            });
            (mockFs.existsSync as jest.Mock).mockReturnValue(false);

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            const docs = await provider.getChildren(specs[0]);

            for (const doc of docs) {
                expect(doc.iconPath).toBeUndefined();
                expect(doc.description).toBe('not created');
                expect(doc.contextValue).toBe('spec-document-missing');
                expect(doc.command).toBeUndefined();
            }
        });
    });

    describe('spec row description trimmed of redundant step state (#238)', () => {
        async function getSpecRow(specContext: any): Promise<any> {
            const specName = 'my-feature';
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(specContext || undefined);
            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            return specs[0];
        }

        // A per-task implement finish 30s ago → "· T004 · just now": keeps the
        // task + time, drops "implement"/"Implement" (already shown by icons).
        it('keeps the active task + time and drops the step word for a per-task finish', async () => {
            const at = new Date(Date.now() - 30 * 1000).toISOString();
            const row = await getSpecRow({
                workflow: 'default',
                currentStep: 'implement',
                status: 'implementing',
                history: [{ step: 'implement', substep: null, task: 'T004', kind: 'complete', by: 'ai', at }],
            });
            expect(row.description).toBe('T004 · just now');
            expect(row.description).not.toMatch(/implement/i);
        });

        // A step-boundary transition → "· <time>" only: no task, and no
        // "Plan started" / "plan" word that the icons already convey.
        it('keeps only the time for a step-boundary transition', async () => {
            const at = new Date(Date.now() - 30 * 1000).toISOString();
            const row = await getSpecRow({
                workflow: 'default',
                currentStep: 'plan',
                status: 'planned',
                history: [{ step: 'plan', substep: null, kind: 'start', by: 'extension', at }],
            });
            expect(row.description).toBe('just now');
            expect(row.description).not.toMatch(/plan/i);
        });

        // No history → no step-derived description (no stray "—" artifact).
        it('sets no description when there is no history', async () => {
            const row = await getSpecRow({
                workflow: 'default',
                currentStep: 'specify',
                status: 'specifying',
            });
            expect(row.description).toBeUndefined();
        });

        it('shows a friendly status and a last-activity line in the tooltip, never a raw key', async () => {
            const at = new Date(Date.now() - 30 * 1000).toISOString();
            const row = await getSpecRow({
                workflow: 'default',
                currentStep: 'tasks',
                status: 'ready-to-implement',
                history: [{ step: 'tasks', substep: null, kind: 'complete', by: 'ai', at }],
            });
            const tooltip = row.tooltip as string;
            expect(tooltip.split('\n')[0]).toBe('My Feature');
            expect(tooltip).toContain('Status: Ready to Implement');
            expect(tooltip).toContain('Last activity:');
            expect(tooltip).not.toContain('ready-to-implement');
        });
    });

    describe('spec-document items have no status circle descriptions', () => {
        it('should not set description on spec-document items with content', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            (mockFs.existsSync as jest.Mock).mockReturnValue(true);
            (mockFs.readFileSync as jest.Mock).mockReturnValue('# Title\nLine 2\nLine 3\nLine 4\nLine 5');

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            const documents = await provider.getChildren(specs[0]);

            for (const doc of documents) {
                expect(doc.description).toBeUndefined();
            }
        });
    });

    describe('numeric-prefix sorting', () => {
        it('sorts numeric-prefixed specs by prefix descending, ignoring birthtime', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: '067-lock-steps', path: 'specs/067-lock-steps' },
                { name: '069-reveal-folder', path: 'specs/069-reveal-folder' },
                { name: '068-collapse-toggle', path: 'specs/068-collapse-toggle' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());

            // Deliberately make birthtime orderings contradict the numeric
            // prefix — simulates git rebase / checkout resetting birthtime.
            (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('067')) {
                    return { birthtime: new Date('2025-03-01T00:00:00Z'), mtime: new Date(0) };
                }
                if (filePath.includes('069')) {
                    return { birthtime: new Date('2025-01-01T00:00:00Z'), mtime: new Date(0) };
                }
                return { birthtime: new Date('2025-02-01T00:00:00Z'), mtime: new Date(0) };
            });

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);

            expect(specs.map((s: any) => s.label)).toEqual([
                'Reveal Folder',
                'Collapse Toggle',
                'Lock Steps',
            ]);
        });

        it('falls back to name order for specs without numeric prefix', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'beta', path: 'specs/beta' },
                { name: 'alpha', path: 'specs/alpha' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);

            // Default 'number' mode: non-numeric specs tie on prefix (both
            // null) and fall back to name ascending.
            expect(specs.map((s: any) => s.label)).toEqual(['Alpha', 'Beta']);
        });

        it('numeric-prefixed specs sort before non-numeric-prefixed specs', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'legacy-spec', path: 'specs/legacy-spec' },
                { name: '001-first', path: 'specs/001-first' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (mockFs.statSync as jest.Mock).mockReturnValue({
                birthtime: new Date('2025-01-01T00:00:00Z'),
                mtime: new Date(0),
            });

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);

            expect(specs.map((s: any) => s.label)).toEqual(['First', 'Legacy Spec']);
        });
    });

    describe('default sort (number mode) for non-numeric specs', () => {
        it('sorts alphabetically when none of the specs have a numeric prefix', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'old-spec', path: 'specs/old-spec' },
                { name: 'new-spec', path: 'specs/new-spec' },
                { name: 'mid-spec', path: 'specs/mid-spec' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());

            const groups = await provider.getChildren();
            expect(groups).toHaveLength(1);
            expect(groups[0].label).toBe('Active (3)');

            const specs = await provider.getChildren(groups[0]);
            expect(specs).toHaveLength(3);
            // Default sort: numeric-prefix desc → name asc. All three specs
            // tie on prefix (null) so they fall through to alphabetical.
            expect(specs[0].label).toBe('Mid Spec');
            expect(specs[1].label).toBe('New Spec');
            expect(specs[2].label).toBe('Old Spec');
        });

        it('should handle statSync errors gracefully during sorting', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'spec-a', path: 'specs/spec-a' },
                { name: 'spec-b', path: 'specs/spec-b' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());

            // statSync throws for all paths
            (mockFs.statSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT');
            });

            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);

            // Should not crash; order is preserved (no sort change on error)
            expect(specs).toHaveLength(2);
        });

        it('applies default sort inside the Completed group', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'done-old', path: 'specs/done-old' },
                { name: 'done-new', path: 'specs/done-new' },
            ]);
            (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'completed' });
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());

            const groups = await provider.getChildren();
            expect(groups[0].label).toBe('Completed (2)');

            const specs = await provider.getChildren(groups[0]);
            // Tie on prefix (both null), fall back to name asc: 'n' < 'o'.
            expect(specs[0].label).toBe('Done New');
            expect(specs[1].label).toBe('Done Old');
        });
    });

    describe('refresh()', () => {
        it('should fire onDidChangeTreeData exactly once per call (no flicker)', () => {
            const listener = jest.fn();
            provider.onDidChangeTreeData(listener);

            provider.refresh();

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('expandAllSpecs flag', () => {
        async function getSpecItemsFor(flag: boolean) {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);
            provider.expandAllSpecs = flag;

            const groups = await provider.getChildren();
            return provider.getChildren(groups[0]);
        }

        it('defaults to false so spec rows start collapsed', () => {
            expect(provider.expandAllSpecs).toBe(false);
        });

        it('renders spec rows collapsed on a first render, with the Active group expanded', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (readSpecContextSync as jest.Mock).mockReturnValue(undefined);

            const groups = await provider.getChildren();
            expect(groups[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);

            const specs = await provider.getChildren(groups[0]);
            expect(specs[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('renders spec items Expanded when expandAllSpecs=true', async () => {
            const specs = await getSpecItemsFor(true);
            expect(specs[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('renders spec items Collapsed when expandAllSpecs=false', async () => {
            const specs = await getSpecItemsFor(false);
            expect(specs[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('spec item id encodes the toggle flag so VS Code treats toggles as fresh items', async () => {
            const expanded = await getSpecItemsFor(true);
            const collapsed = await getSpecItemsFor(false);
            expect(expanded[0].id).toMatch(/:e$/);
            expect(collapsed[0].id).toMatch(/:c$/);
            expect(expanded[0].id).not.toBe(collapsed[0].id);
        });

        it('group items have stable ids that do not change with the toggle', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'a', path: 'specs/a' },
                { name: 'b', path: 'specs/b' },
                { name: 'c', path: 'specs/c' },
            ]);
            (readSpecContextSync as jest.Mock).mockImplementation((p: string) => {
                if (p.includes('/a')) return { status: 'active' };
                if (p.includes('/b')) return { status: 'completed' };
                if (p.includes('/c')) return { status: 'archived' };
                return undefined;
            });

            provider.expandAllSpecs = true;
            const groupsA = await provider.getChildren();
            provider.expandAllSpecs = false;
            const groupsB = await provider.getChildren();

            for (let i = 0; i < groupsA.length; i++) {
                expect(groupsA[i].id).toBe(groupsB[i].id);
                expect(groupsA[i].id).toMatch(/^spec-group:/);
            }
        });
    });

    describe('with filter active', () => {
        function buildFilterState(initialQuery: string): SpecsFilterState {
            const store = new Map<string, unknown>();
            if (initialQuery) store.set('speckit.specs.filter.query', initialQuery);
            const fakeCtx = {
                workspaceState: {
                    get: jest.fn((key: string) => store.get(key)),
                    update: jest.fn(async (key: string, value: unknown) => {
                        if (value === undefined) store.delete(key);
                        else store.set(key, value);
                    }),
                    keys: jest.fn(() => Array.from(store.keys())),
                },
            } as unknown as vscode.ExtensionContext;
            return new SpecsFilterState(fakeCtx, () => { /* noop */ });
        }

        function seedThreeSpecs() {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: '070-design-tighten-safety', path: 'specs/070-design-tighten-safety' },
                { name: '071-tree-group-counts', path: 'specs/071-tree-group-counts' },
                { name: '072-immediate-status-update', path: 'specs/072-immediate-status-update' },
            ]);
            (readSpecContextSync as jest.Mock).mockImplementation((specPath: string) => {
                if (specPath.includes('070-')) return { status: 'active', specName: 'Design — tighten safety' };
                if (specPath.includes('071-')) return { status: 'active', specName: 'Tree group counts' };
                if (specPath.includes('072-')) return { status: 'completed', specName: 'Immediate status update' };
                return undefined;
            });
        }

        it('returns only matching specs across groups with filtered counts', async () => {
            seedThreeSpecs();
            const filterState = buildFilterState('tree');
            const filteredProvider = new SpecExplorerProvider(context, outputChannel, filterState);

            const groups = await filteredProvider.getChildren();

            expect(groups).toHaveLength(1);
            expect(groups[0].label).toBe('Active (1)');
            const specs = await filteredProvider.getChildren(groups[0]);
            expect(specs.map(s => s.label)).toEqual(['Tree group counts']);
        });

        it('matches by specName when slug alone does not match', async () => {
            seedThreeSpecs();
            const filterState = buildFilterState('safety');
            const filteredProvider = new SpecExplorerProvider(context, outputChannel, filterState);

            const groups = await filteredProvider.getChildren();

            expect(groups).toHaveLength(1);
            expect(groups[0].label).toBe('Active (1)');
            const specs = await filteredProvider.getChildren(groups[0]);
            expect(specs.map(s => s.label)).toEqual(['Design — tighten safety']);
        });

        it('returns empty root when filter matches zero specs', async () => {
            seedThreeSpecs();
            const filterState = buildFilterState('zzz');
            const filteredProvider = new SpecExplorerProvider(context, outputChannel, filterState);

            const groups = await filteredProvider.getChildren();

            expect(groups).toEqual([]);
        });

        it('sets speckit.specs.noFilterMatch=true when filter matches nothing', async () => {
            seedThreeSpecs();
            const filterState = buildFilterState('zzz');
            const filteredProvider = new SpecExplorerProvider(context, outputChannel, filterState);
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await filteredProvider.getChildren();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'speckit.specs.noFilterMatch',
                true,
            );
        });

        it('sets speckit.specs.noFilterMatch=false when filter matches at least one spec', async () => {
            seedThreeSpecs();
            const filterState = buildFilterState('tree');
            const filteredProvider = new SpecExplorerProvider(context, outputChannel, filterState);
            (vscode.commands.executeCommand as jest.Mock).mockClear();

            await filteredProvider.getChildren();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'speckit.specs.noFilterMatch',
                false,
            );
        });

        it('shows the full tree when filter is cleared', async () => {
            seedThreeSpecs();
            const filterState = buildFilterState('');
            const filteredProvider = new SpecExplorerProvider(context, outputChannel, filterState);

            const groups = await filteredProvider.getChildren();

            expect(groups.map(g => g.label)).toEqual(['Active (2)', 'Completed (1)']);
        });
    });
});

describe('lifecycleContextValue', () => {
    it('maps active to spec-active', () => {
        expect(lifecycleContextValue({ status: 'active' } as any)).toBe('spec-active');
    });

    it('maps tasks-done to spec-tasks-done', () => {
        expect(lifecycleContextValue({ status: 'tasks-done' } as any)).toBe('spec-tasks-done');
    });

    it('maps implemented to the terminal spec-implemented (not spec-active)', () => {
        // Regression: an `implemented` spec must NOT fall through to spec-active,
        // which would (a) match the Resume menu `when` and (b) group under Active.
        const ctx = lifecycleContextValue({ status: 'implemented' } as any);
        expect(ctx).toBe('spec-implemented');
        expect(ctx).not.toBe('spec-active');
    });

    it('maps completed to spec-completed', () => {
        expect(lifecycleContextValue({ status: 'completed' } as any)).toBe('spec-completed');
    });

    it('maps archived to spec-archived', () => {
        expect(lifecycleContextValue({ status: 'archived' } as any)).toBe('spec-archived');
    });

    it('defaults unknown/missing status to spec-active', () => {
        expect(lifecycleContextValue(undefined)).toBe('spec-active');
        expect(lifecycleContextValue({ status: 'draft' } as any)).toBe('spec-active');
    });

    it('treats spec-implemented as a lifecycle item but not a group item', () => {
        // Keeps lifecycle context-menu actions (Delete/Archive/Reveal/...) on the
        // row while staying distinct from the Resume-matching values.
        expect(isSpecLifecycleItem('spec-implemented')).toBe(true);
        expect(isSpecGroupItem('spec-implemented')).toBe(false);
    });
});

describe('speckit.markCompleted menu eligibility', () => {
    it('offers Mark as Completed for active, tasks-done, and implemented specs', () => {
        const pkg = require('../../../../package.json');
        const menus: Array<{ command: string; when: string }> =
            pkg.contributes.menus['view/item/context'];
        const markCompleted = menus.find(
            m => m.command === 'speckit.markCompleted' && m.when.includes('viewItem')
        );
        expect(markCompleted).toBeDefined();
        expect(markCompleted!.when).toContain('spec-active');
        expect(markCompleted!.when).toContain('spec-tasks-done');
        expect(markCompleted!.when).toContain('spec-implemented');
    });
});

describe('SpecExplorerProvider — pinned Companion install CTA', () => {
    let context: vscode.ExtensionContext;
    let outputChannel: vscode.OutputChannel;

    beforeEach(() => {
        jest.clearAllMocks();
        context = createMockContext();
        outputChannel = createMockOutputChannel();
        setupWorkspaceFolder();
        (mockFs.readdirSync as jest.Mock).mockReturnValue([]);
        (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: new Date(0) });
        (resolveSpecDirectories as jest.Mock).mockResolvedValue([
            { name: '070-a', path: 'specs/070-a' },
        ]);
        (readSpecContextSync as jest.Mock).mockReturnValue({ status: 'active', specName: 'A' });
    });

    it('prepends the CTA row when the spec-kit extension is not installed', async () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        const provider = new SpecExplorerProvider(context, outputChannel);
        const roots = await provider.getChildren();
        expect(roots[0].contextValue).toBe('companion-install-cta');
        expect(roots[0].command?.command).toBe('speckit.companion.installNudge');
        expect(roots[0].command?.arguments).toEqual(['pinnedRow']);
    });

    it('omits the CTA row when the extension is installed', async () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        const provider = new SpecExplorerProvider(context, outputChannel);
        const roots = await provider.getChildren();
        expect(roots.some(r => r.contextValue === 'companion-install-cta')).toBe(false);
    });
});
