import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as yaml from 'js-yaml';

export type SkillType = 'plugin' | 'user' | 'project';

export interface SkillInfo {
    /** Skill name from YAML frontmatter (or derived from folder name) */
    name: string;
    /** Skill description from YAML frontmatter */
    description: string;
    /** Absolute path to the SKILL.md file */
    path: string;
    /** Source type: where the skill was discovered from */
    type: SkillType;
    /** Optional: restricted tools list from YAML frontmatter */
    allowedTools?: string[];
    /** Optional: plugin name (only for plugin-sourced skills) */
    pluginName?: string;
    /** True if YAML frontmatter was invalid (name derived from folder) */
    hasWarning?: boolean;
}

export class SkillManager {
    private outputChannel: vscode.OutputChannel;
    private workspaceRoot: string | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel = outputChannel;
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Get list of skills from all sources
     */
    async getSkillList(type: SkillType | 'all' = 'all'): Promise<SkillInfo[]> {
        const skills: SkillInfo[] = [];

        // Get project skills
        if (type === 'project' || type === 'all') {
            if (this.workspaceRoot) {
                const projectSkillsPath = path.join(this.workspaceRoot, '.claude/skills');
                skills.push(...await this.getSkillsFromDirectory(projectSkillsPath, 'project'));
            }
        }

        // Get user skills
        if (type === 'user' || type === 'all') {
            const userSkillsPath = path.join(os.homedir(), '.claude/skills');
            skills.push(...await this.getSkillsFromDirectory(userSkillsPath, 'user'));
        }

        // Get plugin skills
        if (type === 'plugin' || type === 'all') {
            skills.push(...await this.getPluginSkills());
        }

        return skills;
    }

    /**
     * Get skills from a specific directory
     * Skills are stored in subdirectories, each containing a SKILL.md file
     */
    async getSkillsFromDirectory(dirPath: string, type: 'project' | 'user'): Promise<SkillInfo[]> {
        const skills: SkillInfo[] = [];

        try {
            this.outputChannel.appendLine(`[SkillManager] Reading skills from directory: ${dirPath}`);

            if (!fs.existsSync(dirPath)) {
                this.outputChannel.appendLine(`[SkillManager] Skills directory does not exist: ${dirPath}`);
                return skills;
            }

            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

            for (const [folderName, fileType] of entries) {
                // Skills are in subdirectories
                if (fileType !== vscode.FileType.Directory) {
                    continue;
                }

                const skillMdPath = path.join(dirPath, folderName, 'SKILL.md');

                // Check if SKILL.md exists in the folder
                if (!fs.existsSync(skillMdPath)) {
                    this.outputChannel.appendLine(`[SkillManager] Skipping folder without SKILL.md: ${folderName}`);
                    continue;
                }

                const skillInfo = await this.parseSkillFile(skillMdPath, type, folderName);
                if (skillInfo) {
                    skills.push(skillInfo);
                    this.outputChannel.appendLine(`[SkillManager] Added skill: ${skillInfo.name}`);
                }
            }

            this.outputChannel.appendLine(`[SkillManager] Total skills found in ${dirPath}: ${skills.length}`);
        } catch (error) {
            this.outputChannel.appendLine(`[SkillManager] Failed to read skills from ${dirPath}: ${error}`);
        }

        return skills;
    }

    /**
     * Get skills from installed Claude Code plugins
     */
    async getPluginSkills(): Promise<SkillInfo[]> {
        const skills: SkillInfo[] = [];
        const installedPluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');

        try {
            if (!fs.existsSync(installedPluginsPath)) {
                this.outputChannel.appendLine('[SkillManager] No installed_plugins.json found, skipping plugin skills');
                return skills;
            }

            const installedPluginsContent = await fs.promises.readFile(installedPluginsPath, 'utf-8');
            const installedPlugins = JSON.parse(installedPluginsContent);

            if (!installedPlugins.plugins) {
                this.outputChannel.appendLine('[SkillManager] No plugins found in installed_plugins.json');
                return skills;
            }

            for (const [pluginKey, pluginInfo] of Object.entries(installedPlugins.plugins)) {
                const pluginData = pluginInfo as { installPath?: string };
                if (!pluginData.installPath) {
                    this.outputChannel.appendLine(`[SkillManager] Plugin ${pluginKey} has no installPath, skipping`);
                    continue;
                }

                const skillsDir = path.join(pluginData.installPath, 'skills');

                if (!fs.existsSync(skillsDir)) {
                    this.outputChannel.appendLine(`[SkillManager] Plugin ${pluginKey} has no skills directory`);
                    continue;
                }

                this.outputChannel.appendLine(`[SkillManager] Reading plugin skills from: ${skillsDir}`);

                // Extract plugin name from key (e.g., "angular-plugin@aiwyn-tools" -> "angular-plugin")
                const pluginName = pluginKey.split('@')[0];

                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(skillsDir));

                for (const [folderName, fileType] of entries) {
                    if (fileType !== vscode.FileType.Directory) {
                        continue;
                    }

                    const skillMdPath = path.join(skillsDir, folderName, 'SKILL.md');

                    if (!fs.existsSync(skillMdPath)) {
                        continue;
                    }

                    const skillInfo = await this.parseSkillFile(skillMdPath, 'plugin', folderName);
                    if (skillInfo) {
                        skills.push({
                            ...skillInfo,
                            pluginName,
                            name: `${pluginName}:${skillInfo.name}`
                        });
                        this.outputChannel.appendLine(`[SkillManager] Added plugin skill: ${pluginName}:${skillInfo.name}`);
                    }
                }
            }

            this.outputChannel.appendLine(`[SkillManager] Total plugin skills found: ${skills.length}`);
        } catch (error) {
            this.outputChannel.appendLine(`[SkillManager] Failed to read plugin skills: ${error}`);
        }

        return skills;
    }

    /**
     * Parse a SKILL.md file and extract metadata from YAML frontmatter
     */
    async parseSkillFile(filePath: string, type: SkillType, folderName: string): Promise<SkillInfo | null> {
        try {
            this.outputChannel.appendLine(`[SkillManager] Parsing skill file: ${filePath}`);
            const content = await fs.promises.readFile(filePath, 'utf8');

            // Extract YAML frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

            if (!frontmatterMatch) {
                this.outputChannel.appendLine(`[SkillManager] No frontmatter found in: ${filePath}, using folder name`);
                // Return skill with warning - use folder name as name
                return {
                    name: folderName,
                    description: '',
                    path: filePath,
                    type,
                    hasWarning: true
                };
            }

            let frontmatter: Record<string, unknown>;
            try {
                frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;
                this.outputChannel.appendLine(`[SkillManager] Successfully parsed YAML for: ${path.basename(path.dirname(filePath))}`);
            } catch (yamlError) {
                this.outputChannel.appendLine(`[SkillManager] YAML parse error in ${filePath}: ${yamlError}`);
                // Return skill with warning - use folder name as name
                return {
                    name: folderName,
                    description: '',
                    path: filePath,
                    type,
                    hasWarning: true
                };
            }

            // Parse allowed-tools if present
            let allowedTools: string[] | undefined;
            if (frontmatter['allowed-tools']) {
                const toolsValue = frontmatter['allowed-tools'];
                if (typeof toolsValue === 'string') {
                    allowedTools = toolsValue.split(',').map((t: string) => t.trim()).filter(Boolean);
                } else if (Array.isArray(toolsValue)) {
                    allowedTools = toolsValue.map(String);
                }
            }

            return {
                name: String(frontmatter.name || folderName),
                description: String(frontmatter.description || ''),
                path: filePath,
                type,
                allowedTools,
                hasWarning: false
            };
        } catch (error) {
            this.outputChannel.appendLine(`[SkillManager] Failed to parse skill file ${filePath}: ${error}`);
            return null;
        }
    }
}
