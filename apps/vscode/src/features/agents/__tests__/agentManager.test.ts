import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentManager } from '../agentManager';

jest.mock('os', () => ({
    ...jest.requireActual('os'),
    homedir: jest.fn(),
}));
jest.mock('../../../ai-providers/aiProvider', () => ({
    getConfiguredProviderType: jest.fn(),
    getProviderPaths: jest.fn(),
}));

import { AIProviderType, getConfiguredProviderType, getProviderPaths, ProviderPaths } from '../../../ai-providers/aiProvider';

const mockGetConfiguredProviderType = getConfiguredProviderType as jest.MockedFunction<typeof getConfiguredProviderType>;
const mockGetProviderPaths = getProviderPaths as jest.MockedFunction<typeof getProviderPaths>;
const workspace = vscode.workspace as unknown as { workspaceFolders: unknown };
const workspaceFs = vscode.workspace.fs as unknown as { readDirectory: jest.Mock };
const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;

function writeAgent(root: string, directory: string, name: string): void {
    const dir = path.join(root, directory);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.md`), `---\nname: ${name}\ndescription: ${name} agent\n---\n`, 'utf8');
}

describe('AgentManager', () => {
    let workspaceRoot: string;
    let userRoot: string;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manager-workspace-'));
        userRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manager-user-'));
        mockHomedir.mockReturnValue(userRoot);
        workspace.workspaceFolders = [{ uri: vscode.Uri.file(workspaceRoot) }];
        workspaceFs.readDirectory.mockImplementation(async (uri: vscode.Uri) =>
            fs.readdirSync(uri.fsPath, { withFileTypes: true }).map(entry => [
                entry.name,
                entry.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
            ])
        );
        mockGetConfiguredProviderType.mockReturnValue('omp' as AIProviderType);
        mockGetProviderPaths.mockReturnValue({
            agentsDir: '.omp/agents',
            userAgentsDir: '.omp/agent/agents',
        } as ProviderPaths);
    });

    afterEach(() => {
        mockHomedir.mockReset();
        workspace.workspaceFolders = undefined;
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
        fs.rmSync(userRoot, { recursive: true, force: true });
        jest.clearAllMocks();
    });

    it('uses the provider-specific project and user agent directories', async () => {
        writeAgent(workspaceRoot, '.omp/agents', 'project-omp');
        writeAgent(userRoot, '.omp/agent/agents', 'user-omp');
        writeAgent(workspaceRoot, '.claude/agents', 'project-claude');

        const manager = new AgentManager({ extensionPath: '' } as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);

        await expect(manager.getAgentList('project')).resolves.toEqual([
            expect.objectContaining({ name: 'project-omp', type: 'project' }),
        ]);
        await expect(manager.getAgentList('user')).resolves.toEqual([
            expect.objectContaining({ name: 'user-omp', type: 'user' }),
        ]);
    });

    it.each(['claude', 'claude-vscode'])('hides the built-in agents folder and lists plugin agents for %s', async (provider) => {
        mockGetConfiguredProviderType.mockReturnValue(provider as AIProviderType);
        mockGetProviderPaths.mockReturnValue({ agentsDir: '.claude/agents' } as ProviderPaths);
        writeAgent(workspaceRoot, '.claude/agents', 'project-claude');
        writeAgent(workspaceRoot, '.claude/agents/kfc', 'built-in');

        const manager = new AgentManager({ extensionPath: '' } as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
        const pluginAgents = jest.spyOn(manager as unknown as { getPluginAgents: () => Promise<unknown[]> }, 'getPluginAgents').mockResolvedValue([]);

        await expect(manager.getAgentList('all')).resolves.toEqual([
            expect.objectContaining({ name: 'project-claude', type: 'project' }),
        ]);
        expect(pluginAgents).toHaveBeenCalled();
    });
});
