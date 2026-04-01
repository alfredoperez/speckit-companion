import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SpecExplorerProvider } from '../specExplorerProvider';

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

import { resolveSpecDirectories, hasDuplicateNames } from '../../../core/specDirectoryResolver';

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

        it('should group specs modified today under Active', async () => {
            const today = new Date();
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature-a', path: 'specs/feature-a' },
            ]);

            // Mock the spec directory to have a file modified today
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: today });

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Active');
            expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should group specs modified before today under Earlier', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'old-feature', path: 'specs/old-feature' },
            ]);

            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: yesterday });

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Earlier');
            expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('should show both Active and Earlier groups when specs span both', async () => {
            const today = new Date();
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'new-feature', path: 'specs/new-feature' },
                { name: 'old-feature', path: 'specs/old-feature' },
            ]);

            (mockFs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
                return [{ name: 'spec.md', isFile: () => true }];
            });

            (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('new-feature')) {
                    return { mtime: today };
                }
                return { mtime: lastWeek };
            });

            const children = await provider.getChildren();

            expect(children).toHaveLength(2);
            expect(children[0].label).toBe('Active');
            expect(children[1].label).toBe('Earlier');
        });

        it('should sort active specs newest-first', async () => {
            const now = new Date();
            const earlier = new Date(now.getTime() - 3600_000); // 1 hour ago

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'older-today', path: 'specs/older-today' },
                { name: 'newest-today', path: 'specs/newest-today' },
            ]);

            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);

            (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('newest-today')) {
                    return { mtime: now };
                }
                return { mtime: earlier };
            });

            const children = await provider.getChildren();
            expect(children).toHaveLength(1); // One Active group

            // Get specs within the Active group
            const activeGroup = children[0];
            const specs = await provider.getChildren(activeGroup);

            expect(specs[0].label).toBe('newest-today');
            expect(specs[1].label).toBe('older-today');
        });
    });

    describe('spec-group icons', () => {
        it('should use pulse icon for Active group', async () => {
            const today = new Date();
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: today });

            const children = await provider.getChildren();
            const activeGroup = children[0];

            expect(activeGroup.iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((activeGroup.iconPath as vscode.ThemeIcon).id).toBe('pulse');
        });

        it('should use archive icon for Earlier group', async () => {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: lastWeek });

            const children = await provider.getChildren();
            const earlierGroup = children[0];

            expect(earlierGroup.iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((earlierGroup.iconPath as vscode.ThemeIcon).id).toBe('archive');
        });
    });

    describe('spec item icons based on active state', () => {
        async function getSpecItems(isActive: boolean): Promise<any[]> {
            const today = new Date();
            const specName = 'my-feature';

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: specName, path: `specs/${specName}` },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: today });

            if (isActive) {
                provider.setActiveSpec(specName);
            }

            const groups = await provider.getChildren();
            const activeGroup = groups[0];
            return provider.getChildren(activeGroup);
        }

        it('should use sync~spin icon when spec is active', async () => {
            const specs = await getSpecItems(true);
            expect(specs[0].iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((specs[0].iconPath as vscode.ThemeIcon).id).toBe('sync~spin');
        });

        it('should use beaker icon when spec is not active', async () => {
            const specs = await getSpecItems(false);
            expect(specs[0].iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((specs[0].iconPath as vscode.ThemeIcon).id).toBe('beaker');
        });
    });

    describe('spec-document items have no status circle descriptions', () => {
        it('should not set description on spec-document items', async () => {
            const today = new Date();

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (hasDuplicateNames as jest.Mock).mockReturnValue(new Set());
            (mockFs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
                // For getSpecMaxMtime
                if (typeof dirPath === 'string' && !dirPath.includes('withFileTypes')) {
                    return [{ name: 'spec.md', isFile: () => true }];
                }
                return [{ name: 'spec.md', isFile: () => true }];
            });
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: today });
            (mockFs.existsSync as jest.Mock).mockReturnValue(true);
            (mockFs.readFileSync as jest.Mock).mockReturnValue('# Title\nLine 2\nLine 3\nLine 4\nLine 5');

            // Get groups -> specs -> documents
            const groups = await provider.getChildren();
            const specs = await provider.getChildren(groups[0]);
            const documents = await provider.getChildren(specs[0]);

            // Documents should not have circle status descriptions
            for (const doc of documents) {
                expect(doc.description).toBeUndefined();
            }
        });
    });

    describe('getSpecMaxMtime (tested indirectly)', () => {
        it('should use most recent file mtime for grouping', async () => {
            const today = new Date();
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);

            // Directory has two files: one old, one from today
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
                { name: 'plan.md', isFile: () => true },
            ]);

            (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => {
                if (filePath.includes('plan.md')) {
                    return { mtime: today };
                }
                return { mtime: lastMonth };
            });

            const children = await provider.getChildren();

            // Should be Active because max mtime is today
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Active');
        });

        it('should handle empty spec directory gracefully', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'empty-feature', path: 'specs/empty-feature' },
            ]);

            // No files in directory
            (mockFs.readdirSync as jest.Mock).mockReturnValue([]);

            const children = await provider.getChildren();

            // With mtime of epoch 0, it should go to Earlier
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Earlier');
        });

        it('should handle directory read errors gracefully', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'broken', path: 'specs/broken' },
            ]);

            (mockFs.readdirSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT');
            });

            const children = await provider.getChildren();

            // Error means mtime = epoch 0, so Earlier group
            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Earlier');
        });
    });

    describe('isToday (tested indirectly)', () => {
        it('should classify a date from a different year as not today', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({
                mtime: new Date(2020, 0, 1),
            });

            const children = await provider.getChildren();
            expect(children[0].label).toBe('Earlier');
        });

        it('should classify yesterday as not today', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            (resolveSpecDirectories as jest.Mock).mockResolvedValue([
                { name: 'feature', path: 'specs/feature' },
            ]);
            (mockFs.readdirSync as jest.Mock).mockReturnValue([
                { name: 'spec.md', isFile: () => true },
            ]);
            (mockFs.statSync as jest.Mock).mockReturnValue({ mtime: yesterday });

            const children = await provider.getChildren();
            expect(children[0].label).toBe('Earlier');
        });
    });

    describe('loading state', () => {
        it('should show loading item when isLoading is true', async () => {
            // Trigger loading state
            provider.refresh();
            // isLoading is true right after refresh()

            // Access internal state - provider.isLoading is protected but set by refresh()
            // The first call after refresh should return loading indicator
            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].label).toBe('Loading specs...');
            expect((children[0].iconPath as vscode.ThemeIcon).id).toBe('sync~spin');
        });
    });
});
