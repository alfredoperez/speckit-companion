import * as vscode from 'vscode';
import * as fs from 'fs';
import { SteeringExplorerProvider } from '../steeringExplorerProvider';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

jest.mock('../companionSteering', () => ({
    readCompanionConfigGroups: jest.fn().mockReturnValue([]),
    readCompanionCommands: jest.fn().mockReturnValue([]),
    readCompanionTemplates: jest.fn().mockReturnValue([]),
    isWithinRoot: jest.fn().mockReturnValue(true),
    companionCommandFilePath: jest.fn().mockReturnValue(undefined),
    COMPANION_STEERING_PATHS: {
        config: '.specify/companion.yml',
        manifest: '.specify/extensions/companion/extension.yml',
    },
}));

jest.mock('../../../ai-providers/aiProvider', () => ({
    getConfiguredProviderType: jest.fn().mockReturnValue('gemini'),
    getProviderDisplayName: jest.fn().mockReturnValue('Gemini'),
    getProviderPaths: jest.fn().mockReturnValue({
        steeringFile: 'GEMINI.md',
        globalSteeringFile: '.gemini/GEMINI.md',
        steeringDir: '.gemini/steering',
        steeringPattern: '*.md',
        agentsDir: '.gemini/agents',
        skillsDir: '.gemini/skills',
        mcpConfigPath: '.gemini/settings.json',
    }),
}));

import { isCompanionInstalled } from '../../settings/companionPresetReconciler';

const WORKSPACE = '/workspace';

function createProvider(): SteeringExplorerProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
    } as unknown as vscode.ExtensionContext;
    const provider = new SteeringExplorerProvider(context);
    provider.setSteeringManager({ getSteeringDocuments: jest.fn().mockResolvedValue([]) } as any);
    return provider;
}

describe('SteeringExplorerProvider', () => {
    let provider: SteeringExplorerProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: WORKSPACE } }];
        (vscode.workspace.fs.readDirectory as jest.Mock) = jest.fn().mockResolvedValue([]);
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn().mockReturnValue([]),
        });
        (mockFs.existsSync as jest.Mock).mockReturnValue(false);
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        provider = createProvider();
    });

    describe('root order', () => {
        it('puts Companion first, then the provider, and omits empty sections', async () => {
            const roots = await provider.getChildren();
            expect(roots.map(r => r.label)).toEqual(['Companion', 'Gemini']);
        });

        it('names the spec-kit section SpecKit Project Files when it has content', async () => {
            (mockFs.existsSync as jest.Mock).mockImplementation((p: any) =>
                String(p).endsWith('constitution.md')
            );

            const roots = await provider.getChildren();

            expect(roots.map(r => r.label)).toEqual(['Companion', 'Gemini', 'SpecKit Project Files']);
        });

        it('renders no create-rule rows at the root', async () => {
            const roots = await provider.getChildren();
            for (const row of roots) {
                expect(row.label).not.toContain('Create');
            }
        });
    });

    describe('companion node', () => {
        it('warns and offers no children when the extension is not installed', async () => {
            const roots = await provider.getChildren();
            const companion = roots[0];
            expect(companion.description).toBe('Not installed');
            expect(companion.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
            expect(await provider.getChildren(companion)).toEqual([]);
        });

        it('makes Configuration open the config file directly while keeping its children', async () => {
            (isCompanionInstalled as jest.Mock).mockReturnValue(true);
            provider = createProvider();

            const roots = await provider.getChildren();
            const children = await provider.getChildren(roots[0]);
            const config = children.find(c => c.label === 'Configuration')!;

            expect(config.command?.command).toBe('vscode.open');
            expect(config.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });
    });

    describe('missing rule actions', () => {
        it('nests the project create action under Project, naming the provider filename', async () => {
            const roots = await provider.getChildren();
            const providerNode = roots.find(r => r.label === 'Gemini')!;
            const scopes = await provider.getChildren(providerNode);
            const project = scopes.find(s => s.label === 'Project')!;

            const children = await provider.getChildren(project);
            const create = children.find(c => c.label === 'Create Project Rule')!;

            expect(create).toBeDefined();
            expect(create.command?.title).toBe('Create project-level GEMINI.md');
            expect(create.tooltip).toBe('Create project-level GEMINI.md');
        });

        it('nests the user create action under User, naming the provider filename', async () => {
            const roots = await provider.getChildren();
            const providerNode = roots.find(r => r.label === 'Gemini')!;
            const scopes = await provider.getChildren(providerNode);
            const user = scopes.find(s => s.label === 'User')!;

            const children = await provider.getChildren(user);
            const create = children.find(c => c.label === 'Create User Rule')!;

            expect(create).toBeDefined();
            expect(create.command?.title).toBe('Create user-level GEMINI.md');
        });

        it('uses the scope word User, never Global', async () => {
            const roots = await provider.getChildren();
            const providerNode = roots.find(r => r.label === 'Gemini')!;
            const scopes = await provider.getChildren(providerNode);

            expect(scopes.map(s => s.label)).toEqual(['Project', 'User']);
        });

        it('shows the rule file itself, not a create action, once the file exists', async () => {
            (mockFs.existsSync as jest.Mock).mockReturnValue(true);

            const roots = await provider.getChildren();
            const providerNode = roots.find(r => r.label === 'Gemini')!;
            const scopes = await provider.getChildren(providerNode);
            const children = await provider.getChildren(scopes[0]);

            expect(children.some(c => c.label === 'GEMINI.md')).toBe(true);
            expect(children.some(c => c.label === 'Create Project Rule')).toBe(false);
        });
    });

    describe('refresh', () => {
        it('fires once with no artificial loading state', () => {
            const listener = jest.fn();
            provider.onDidChangeTreeData(listener);

            provider.refresh();

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
