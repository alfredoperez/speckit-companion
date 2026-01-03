import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as yaml from 'js-yaml';
import type { AgentFrontmatter, InstalledPlugin, InstalledPluginsFile } from '../../core/types/config';
import { handleError } from '../../core/errors';

export interface AgentInfo {
    name: string;
    description: string;
    path: string;
    type: 'project' | 'user' | 'plugin';
    tools?: string[];
    pluginName?: string;
}

export class AgentManager {
    private outputChannel: vscode.OutputChannel;
    private extensionPath: string;
    private workspaceRoot: string | undefined;
    
    private readonly BUILT_IN_AGENTS = [
        'spec-requirements',
        'spec-design',
        'spec-tasks',
        'spec-system-prompt-loader',
        'spec-judge',
        'spec-impl',
        'spec-test'
    ];

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel = outputChannel;
        this.extensionPath = context.extensionPath;
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Initialize built-in agents (copy if not exist on startup)
     */
    async initializeBuiltInAgents(): Promise<void> {
        if (!this.workspaceRoot) {
            this.outputChannel.appendLine('[AgentManager] No workspace root found, skipping agent initialization');
            return;
        }

        const targetDir = path.join(this.workspaceRoot, '.claude/agents/kfc');
        
        try {
            // Ensure target directory exists
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
            
            // Copy each built-in agent (always overwrite to ensure latest version)
            for (const agentName of this.BUILT_IN_AGENTS) {
                const sourcePath = path.join(this.extensionPath, 'dist/resources/agents', `${agentName}.md`);
                const targetPath = path.join(targetDir, `${agentName}.md`);
                
                try {
                    const sourceUri = vscode.Uri.file(sourcePath);
                    const targetUri = vscode.Uri.file(targetPath);
                    await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: true });
                    this.outputChannel.appendLine(`[AgentManager] Updated agent ${agentName}`);
                } catch (error) {
                    handleError(error, { outputChannel: this.outputChannel, context: `AgentManager.copyAgent(${agentName})` });
                }
            }
            
            // Also copy system prompt if it doesn't exist
            await this.initializeSystemPrompt();
            
        } catch (error) {
            handleError(error, { outputChannel: this.outputChannel, context: 'AgentManager.initializeBuiltInAgents' });
        }
    }

    /**
     * Initialize system prompt (copy if not exist)
     */
    private async initializeSystemPrompt(): Promise<void> {
        if (!this.workspaceRoot) {
            return;
        }

        const systemPromptDir = path.join(this.workspaceRoot, '.claude/system-prompts');
        const sourcePath = path.join(this.extensionPath, 'dist/resources/prompts', 'spec-workflow-starter.md');
        const targetPath = path.join(systemPromptDir, 'spec-workflow-starter.md');

        try {
            // Ensure directory exists
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(systemPromptDir));
            
            // Always overwrite to ensure latest version
            await vscode.workspace.fs.copy(vscode.Uri.file(sourcePath), vscode.Uri.file(targetPath), { overwrite: true });
            this.outputChannel.appendLine('[AgentManager] Updated system prompt');
        } catch (error) {
            this.outputChannel.appendLine(`[AgentManager] Failed to initialize system prompt: ${error}`);
        }
    }

    /**
     * Get list of agents
     */
    async getAgentList(type: 'project' | 'user' | 'plugin' | 'all' = 'all'): Promise<AgentInfo[]> {
        const agents: AgentInfo[] = [];

        // Get project agents (excluding kfc built-in agents)
        if (type === 'project' || type === 'all') {
            if (this.workspaceRoot) {
                const projectAgentsPath = path.join(this.workspaceRoot, '.claude/agents');
                const projectAgents = await this.getAgentsFromDirectory(
                    projectAgentsPath,
                    'project',
                    true  // exclude kfc directory
                );
                agents.push(...projectAgents);
            }
        }

        // Get user agents
        if (type === 'user' || type === 'all') {
            const userAgentsPath = path.join(os.homedir(), '.claude/agents');
            const userAgents = await this.getAgentsFromDirectory(userAgentsPath, 'user');
            agents.push(...userAgents);
        }

        // Get plugin agents
        if (type === 'plugin' || type === 'all') {
            const pluginAgents = await this.getPluginAgents();
            agents.push(...pluginAgents);
        }

        return agents;
    }

    /**
     * Get agents from a specific directory (including subdirectories)
     */
    private async getAgentsFromDirectory(dirPath: string, type: 'project' | 'user', excludeKfc: boolean = false): Promise<AgentInfo[]> {
        const agents: AgentInfo[] = [];

        try {
            this.outputChannel.appendLine(`[AgentManager] Reading agents from directory: ${dirPath}`);
            await this.readAgentsRecursively(dirPath, type, agents, excludeKfc);
            this.outputChannel.appendLine(`[AgentManager] Total agents found in ${dirPath}: ${agents.length}`);
        } catch (error) {
            this.outputChannel.appendLine(`[AgentManager] Failed to read agents from ${dirPath}: ${error}`);
        }

        return agents;
    }

    /**
     * Recursively read agents from directory and subdirectories
     */
    private async readAgentsRecursively(dirPath: string, type: 'project' | 'user' | 'plugin', agents: AgentInfo[], excludeKfc: boolean = false): Promise<void> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            
            for (const [fileName, fileType] of entries) {
                const fullPath = path.join(dirPath, fileName);
                
                // Skip kfc directory if excludeKfc is true
                if (excludeKfc && fileName === 'kfc' && fileType === vscode.FileType.Directory) {
                    this.outputChannel.appendLine(`[AgentManager] Skipping kfc directory (built-in agents)`);
                    continue;
                }
                
                if (fileType === vscode.FileType.File && fileName.endsWith('.md')) {
                    this.outputChannel.appendLine(`[AgentManager] Processing agent file: ${fileName}`);
                    const agentInfo = await this.parseAgentFile(fullPath, type);
                    if (agentInfo) {
                        agents.push(agentInfo);
                        this.outputChannel.appendLine(`[AgentManager] Added agent: ${agentInfo.name}`);
                    } else {
                        this.outputChannel.appendLine(`[AgentManager] Failed to parse agent: ${fileName}`);
                    }
                } else if (fileType === vscode.FileType.Directory) {
                    // Recursively read subdirectories
                    this.outputChannel.appendLine(`[AgentManager] Entering subdirectory: ${fileName}`);
                    await this.readAgentsRecursively(fullPath, type, agents, excludeKfc);
                }
            }
        } catch (error) {
            this.outputChannel.appendLine(`[AgentManager] Error reading directory ${dirPath}: ${error}`);
        }
    }

    /**
     * Parse agent file and extract metadata
     */
    private async parseAgentFile(filePath: string, type: 'project' | 'user' | 'plugin'): Promise<AgentInfo | null> {
        try {
            this.outputChannel.appendLine(`[AgentManager] Parsing agent file: ${filePath}`);
            const content = await fs.promises.readFile(filePath, 'utf8');
            
            // Extract YAML frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) {
                this.outputChannel.appendLine(`[AgentManager] No frontmatter found in: ${filePath}`);
                return null;
            }

            let frontmatter: AgentFrontmatter | undefined;
            try {
                // Debug: log the frontmatter content for spec-system-prompt-loader
                if (path.basename(filePath) === 'spec-system-prompt-loader.md') {
                    this.outputChannel.appendLine(`[AgentManager] Frontmatter content for spec-system-prompt-loader:`);
                    this.outputChannel.appendLine(frontmatterMatch[1]);
                }

                frontmatter = yaml.load(frontmatterMatch[1]) as AgentFrontmatter | undefined;
                this.outputChannel.appendLine(`[AgentManager] Successfully parsed YAML for: ${path.basename(filePath)}`);
            } catch (yamlError) {
                this.outputChannel.appendLine(`[AgentManager] YAML parse error in ${path.basename(filePath)}: ${yamlError}`);
                if (path.basename(filePath) === 'spec-system-prompt-loader.md') {
                    this.outputChannel.appendLine(`[AgentManager] Raw frontmatter that failed:`);
                    this.outputChannel.appendLine(frontmatterMatch[1]);
                }
                return null;
            }
            
            return {
                name: frontmatter?.name || path.basename(filePath, '.md'),
                description: frontmatter?.description || '',
                path: filePath,
                type,
                tools: Array.isArray(frontmatter?.tools)
                    ? frontmatter.tools
                    : (frontmatter?.tools ? frontmatter.tools.split(',').map((t: string) => t.trim()) : undefined)
            };
        } catch (error) {
            this.outputChannel.appendLine(`[AgentManager] Failed to parse agent file ${filePath}: ${error}`);
            return null;
        }
    }

    /**
     * Check if agent exists
     */
    checkAgentExists(agentName: string, location: 'project' | 'user'): boolean {
        const basePath = location === 'project' 
            ? (this.workspaceRoot ? path.join(this.workspaceRoot, '.claude/agents/kfc') : null)
            : path.join(os.homedir(), '.claude/agents');

        if (!basePath) {
            return false;
        }

        const agentPath = path.join(basePath, `${agentName}.md`);
        return fs.existsSync(agentPath);
    }

    /**
     * Get agents from installed Claude Code plugins
     */
    async getPluginAgents(): Promise<AgentInfo[]> {
        const agents: AgentInfo[] = [];
        const installedPluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');

        try {
            if (!fs.existsSync(installedPluginsPath)) {
                this.outputChannel.appendLine('[AgentManager] No installed_plugins.json found, skipping plugin agents');
                return agents;
            }

            const installedPluginsContent = await fs.promises.readFile(installedPluginsPath, 'utf-8');
            const installedPlugins: InstalledPluginsFile = JSON.parse(installedPluginsContent);

            if (!installedPlugins.plugins) {
                this.outputChannel.appendLine('[AgentManager] No plugins found in installed_plugins.json');
                return agents;
            }

            for (const [pluginKey, pluginInfo] of Object.entries(installedPlugins.plugins)) {
                const pluginData: InstalledPlugin = pluginInfo;
                if (!pluginData.installPath) {
                    this.outputChannel.appendLine(`[AgentManager] Plugin ${pluginKey} has no installPath, skipping`);
                    continue;
                }

                const agentsDir = path.join(pluginData.installPath, 'agents');

                if (!fs.existsSync(agentsDir)) {
                    this.outputChannel.appendLine(`[AgentManager] Plugin ${pluginKey} has no agents directory`);
                    continue;
                }

                this.outputChannel.appendLine(`[AgentManager] Reading plugin agents from: ${agentsDir}`);

                // Extract plugin name from key (e.g., "angular-plugin@aiwyn-tools" -> "angular-plugin")
                const pluginName = pluginKey.split('@')[0];

                const pluginAgentsList: AgentInfo[] = [];
                await this.readAgentsRecursively(agentsDir, 'plugin', pluginAgentsList, false);

                // Namespace the agents with plugin name
                for (const agent of pluginAgentsList) {
                    agents.push({
                        ...agent,
                        pluginName,
                        name: `${pluginName}:${agent.name}`
                    });
                    this.outputChannel.appendLine(`[AgentManager] Added plugin agent: ${pluginName}:${agent.name}`);
                }
            }

            this.outputChannel.appendLine(`[AgentManager] Total plugin agents found: ${agents.length}`);
        } catch (error) {
            this.outputChannel.appendLine(`[AgentManager] Failed to read plugin agents: ${error}`);
        }

        return agents;
    }

    /**
     * Get agent file path (sync version for simple lookups)
     */
    getAgentPath(agentName: string): string | null {
        // Check project agents first
        if (this.workspaceRoot) {
            const projectPath = path.join(this.workspaceRoot, '.claude/agents/kfc', `${agentName}.md`);
            if (fs.existsSync(projectPath)) {
                return projectPath;
            }
        }

        // Check user agents
        const userPath = path.join(os.homedir(), '.claude/agents', `${agentName}.md`);
        if (fs.existsSync(userPath)) {
            return userPath;
        }

        return null;
    }

    /**
     * Get agent file path (async version that includes plugin agents)
     */
    async getAgentPathAsync(agentName: string): Promise<string | null> {
        // Check project and user agents first (sync)
        const syncPath = this.getAgentPath(agentName);
        if (syncPath) {
            return syncPath;
        }

        // Check plugin agents
        const pluginAgents = await this.getPluginAgents();
        const pluginAgent = pluginAgents.find(a => a.name === agentName);
        if (pluginAgent) {
            return pluginAgent.path;
        }

        return null;
    }
}