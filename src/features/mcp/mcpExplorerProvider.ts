import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getConfiguredProviderType } from '../../ai-providers/aiProvider';
import { BaseTreeDataProvider } from '../../core/providers';

const execAsync = promisify(exec);

interface MCPServerInfo {
    name: string;
    type: 'stdio' | 'sse' | 'http';
    scope: 'local' | 'project' | 'user';
    scopeDisplay?: string;  // Full scope text from output
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    isLoadingDetails?: boolean;  // Whether details are being loaded
    status?: 'connected' | 'disconnected';  // Whether the server is connected
    removeCommand?: string;  // Command to remove the server
}

export class MCPExplorerProvider extends BaseTreeDataProvider<MCPItem> {
    private servers: Map<string, MCPServerInfo> = new Map();

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        super(context, { name: 'MCPExplorerProvider', outputChannel });
        this.isLoading = true;
        this.loadMCPServers();
    }

    refresh(): void {
        this.isLoading = true;
        this._onDidChangeTreeData.fire(); // Fire immediately to show loading state
        this.loadMCPServers();
    }

    async getChildren(element?: MCPItem): Promise<MCPItem[]> {
        if (!element) {
            // Root level - show all MCP servers
            const items: MCPItem[] = [];

            // For non-Claude providers, show info message about MCP config location
            const providerType = getConfiguredProviderType();
            if (providerType !== 'claude') {
                const configPath = providerType === 'gemini'
                    ? '~/.gemini/settings.json'
                    : '~/.copilot/mcp-config.json';
                items.push(new MCPItem(
                    `MCP config: ${configPath}`,
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-info',
                    'mcp-config-info',
                    undefined,
                    this.context
                ));
                items.push(new MCPItem(
                    'Use CLI to manage MCP servers',
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-info',
                    'mcp-cli-info',
                    undefined,
                    this.context
                ));
                return items;
            }

            if (this.isLoading) {
                items.push(new MCPItem(
                    'Loading MCP servers...',
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-loading',
                    'loading',
                    undefined,
                    this.context
                ));
                return items;
            }

            for (const [name, server] of this.servers) {
                items.push(new MCPItem(
                    name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'mcp-server',
                    `mcp-${name}`,
                    server,
                    this.context
                ));
            }

            if (items.length === 0) {
                items.push(new MCPItem(
                    'No MCP servers configured',
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-empty',
                    'empty',
                    undefined,
                    this.context
                ));
            }

            return items;
        } else if (element.contextValue === 'mcp-server' && element.serverInfo) {
            // Show server details as children in the order: Scope, Type, Command, Environment (if any)
            const server = element.serverInfo;
            const items: MCPItem[] = [];

            // If still loading details, show loading message
            if (server.isLoadingDetails) {
                items.push(new MCPItem(
                    'Loading server details...',
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-loading',
                    `${element.id}-loading`,
                    undefined,
                    this.context
                ));
                return items;
            }

            // 1. Scope (first)
            const scopeItem = new MCPItem(
                `Scope: ${server.scope}`,
                vscode.TreeItemCollapsibleState.None,
                'mcp-detail',
                `${element.id}-scope`,
                undefined,
                this.context
            );
            // If we have full scope display text, extract the description for tooltip
            if (server.scopeDisplay) {
                const match = server.scopeDisplay.match(/Scope:\s*\w+\s*\(([^)]+)\)/);
                if (match) {
                    scopeItem.tooltip = match[1];
                }
            }
            items.push(scopeItem);

            // 2. Type
            items.push(new MCPItem(
                `Type: ${server.type}`,
                vscode.TreeItemCollapsibleState.None,
                'mcp-detail',
                `${element.id}-type`,
                undefined,
                this.context
            ));

            // 3. Command (based on server type)
            if (server.type === 'stdio') {
                // Combine command and args
                let commandStr = server.command || '';
                if (server.args && server.args.length > 0) {
                    commandStr += ' ' + server.args.join(' ');
                }
                if (commandStr) {
                    items.push(new MCPItem(
                        `Command: ${commandStr}`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcp-detail',
                        `${element.id}-command`,
                        undefined,
                        this.context
                    ));
                }
            } else if (server.type === 'sse' || server.type === 'http') {
                if (server.url) {
                    items.push(new MCPItem(
                        `URL: ${server.url}`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcp-detail',
                        `${element.id}-url`,
                        undefined,
                        this.context
                    ));
                }
                if (server.headers && Object.keys(server.headers).length > 0) {
                    items.push(new MCPItem(
                        `Headers: ${Object.keys(server.headers).join(', ')}`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcp-detail',
                        `${element.id}-headers`,
                        undefined,
                        this.context
                    ));
                }
            }

            // 4. Environment variables - only show if not empty
            if (server.env && Object.keys(server.env).length > 0) {
                const envStr = Object.entries(server.env)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                items.push(new MCPItem(
                    `Environment: ${envStr}`,
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-detail',
                    `${element.id}-env`,
                    undefined,
                    this.context
                ));
            }

            return items;
        }

        return [];
    }

    private async loadMCPServers() {
        this.servers.clear();

        try {
            // Get workspace folder path
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

            // Execute claude mcp list command in the workspace directory
            const { stdout, stderr } = await execAsync('claude mcp list', { cwd });


            // Only log errors, not normal output
            if (stderr) {
                this.log(`claude mcp list stderr: ${stderr}`);

                if (!stdout) {
                    return;
                }
            }


            // Parse the output
            await this.parseMCPListOutput(stdout);

            // Mark loading complete and refresh UI to show the list
            this.isLoading = false;
            this._onDidChangeTreeData.fire();

            // Load detailed info for each server asynchronously (don't await)
            this.loadAllServerDetailsAsync();

        } catch (error) {
            this.log(`Failed to load MCP servers: ${error}`);
            // Show error in tree view
            this.servers.clear();
        }
    }

    private async parseMCPListOutput(output: string) {
        // Parse output format: "playwright: npx @playwright/mcp@latest - ✓ Connected"
        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const name = line.substring(0, colonIndex).trim();

                // Parse status from the line
                let status: 'connected' | 'disconnected' = 'disconnected';
                if (line.includes('✓ Connected')) {
                    status = 'connected';
                } else if (line.includes('✗ Failed to connect')) {
                    status = 'disconnected';
                }

                this.servers.set(name, {
                    name,
                    type: 'stdio', // Default, will be updated with details
                    scope: 'local', // Default, will be updated with details
                    status, // Set the parsed status
                    isLoadingDetails: true // Mark as loading
                });
            }
        }
    }

    private async loadAllServerDetailsAsync() {
        // Load all server details in parallel
        const detailPromises = Array.from(this.servers.keys()).map(async (name) => {
            await this.loadServerDetails(name);
            // After loading each server, refresh just that server in the UI
            this._onDidChangeTreeData.fire();
        });

        // Don't await - let them run in background
        Promise.all(detailPromises).catch(err => {
            this.log(`Error loading server details: ${err}`);
        });
    }

    private async loadServerDetails(name: string) {
        try {
            // Get workspace folder path
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

            const { stdout, stderr } = await execAsync(`claude mcp get ${name}`, { cwd });

            if (stderr) {
                this.log(`Error getting details for ${name}: ${stderr}`);
                // Don't return here - stderr might just be warnings
            }

            // Parse the details output
            const server = this.servers.get(name);
            if (server) {
                this.parseServerDetails(server, stdout);
                server.isLoadingDetails = false; // Mark as loaded
            }

        } catch (error) {
            this.log(`Failed to get details for ${name}: ${error}`);
            // Don't remove the server from the list, just show it with default values
            const server = this.servers.get(name);
            if (server) {
                server.isLoadingDetails = false; // Mark as loaded even on error
            }
        }
    }

    private parseServerDetails(server: MCPServerInfo, output: string) {
        const lines = output.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // Parse different fields
            if (trimmed.startsWith('Scope:')) {
                // Save the full scope display text
                server.scopeDisplay = trimmed;

                // Also parse the simple scope value
                const scopeMatch = trimmed.match(/Scope:\s*(\w+)/);
                if (scopeMatch) {
                    const scope = scopeMatch[1].toLowerCase();
                    if (scope === 'user' || scope === 'project' || scope === 'local') {
                        server.scope = scope as 'local' | 'project' | 'user';
                    }
                }
            } else if (trimmed.startsWith('Type:')) {
                const type = trimmed.substring(5).trim().toLowerCase();
                if (type === 'stdio' || type === 'sse' || type === 'http') {
                    server.type = type;
                }
            } else if (trimmed.startsWith('Command:')) {
                server.command = trimmed.substring(8).trim();
            } else if (trimmed.startsWith('Args:')) {
                const argsStr = trimmed.substring(5).trim();
                // Parse args more carefully, they might be on separate lines or contain spaces
                if (argsStr && !argsStr.startsWith('-')) {
                    server.args = argsStr.split(/\s+/);
                } else if (argsStr) {
                    // Args are flags like "-y @upstash/context7-mcp"
                    server.args = argsStr.split(/\s+/);
                }
            } else if (trimmed.startsWith('URL:')) {
                server.url = trimmed.substring(4).trim();
            } else if (trimmed.startsWith('Headers:')) {
                // Headers might be on multiple lines
                const headerStr = trimmed.substring(8).trim();
                if (headerStr) {
                    server.headers = {};
                    // Simple parsing, might need adjustment based on actual format
                    const pairs = headerStr.split(',');
                    for (const pair of pairs) {
                        const [key, value] = pair.split(':').map(s => s.trim());
                        if (key) {
                            server.headers[key] = value || '';
                        }
                    }
                }
            } else if (trimmed.startsWith('Environment:') || trimmed.startsWith('Env:')) {
                const envStr = trimmed.substring(trimmed.indexOf(':') + 1).trim();
                if (envStr && envStr !== '(none)' && envStr !== 'None') {
                    server.env = {};
                    // Parse KEY=value pairs
                    const pairs = envStr.split(/\s+/);
                    for (const pair of pairs) {
                        const [key, value] = pair.split('=');
                        if (key) {
                            server.env[key] = value || '';
                        }
                    }
                }
            } else if (trimmed.startsWith('To remove this server')) {
                // Parse remove command: "To remove this server, run: claude mcp remove "playwright" -s user"
                const match = trimmed.match(/claude mcp remove "(.+?)" -s (.+)$/);
                if (match) {
                    server.removeCommand = `claude mcp remove "${match[1]}" -s ${match[2]}`;
                }
            }
        }
    }
}

class MCPItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly id: string,
        public readonly serverInfo?: MCPServerInfo,
        private readonly extContext?: vscode.ExtensionContext
    ) {
        super(label, collapsibleState);

        // Set appropriate icons
        if (contextValue === 'mcp-empty') {
            this.iconPath = new vscode.ThemeIcon('info');
        } else if (contextValue === 'mcp-info') {
            this.iconPath = new vscode.ThemeIcon('info');
        } else if (contextValue === 'mcp-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
        } else if (contextValue === 'mcp-server') {
            // Use different icons based on connection status
            if (serverInfo?.status === 'disconnected') {
                this.iconPath = new vscode.ThemeIcon('debug-disconnect');
            } else {
                this.iconPath = new vscode.ThemeIcon('server-environment');
            }
        } else if (contextValue === 'mcp-detail') {
            if (label.startsWith('Type:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-property');
            } else if (label.startsWith('Command:')) {
                this.iconPath = new vscode.ThemeIcon('terminal');
            } else if (label.startsWith('URL:')) {
                this.iconPath = new vscode.ThemeIcon('link');
            } else if (label.startsWith('Environment:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
            } else if (label.startsWith('Scope:')) {
                this.iconPath = new vscode.ThemeIcon('globe');
            } else if (label.startsWith('Args:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-array');
            } else if (label.startsWith('Headers:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-key');
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-outline');
            }
        } else if (extContext) {
            this.iconPath = {
                light: vscode.Uri.file(extContext.asAbsolutePath('icons/server.svg')),
                dark: vscode.Uri.file(extContext.asAbsolutePath('icons/server.svg'))
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('server-environment');
        }

        // Set tooltips
        if (contextValue === 'mcp-server' && serverInfo) {
            let tooltipText = `MCP Server: ${label}\nType: ${serverInfo.type}\nScope: ${serverInfo.scope}`;

            // Add status info to tooltip
            if (serverInfo.status === 'disconnected') {
                tooltipText += '\nStatus: ✗ Failed to connect';
            } else if (serverInfo.status === 'connected') {
                tooltipText += '\nStatus: ✓ Connected';
            }

            this.tooltip = tooltipText;
        } else if (contextValue === 'mcp-detail') {
            this.tooltip = label;
        }
    }
}
