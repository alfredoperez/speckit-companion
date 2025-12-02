import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export class ConfigReader {
    private configPath: string;
    private watchCallback?: () => void;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.configPath = path.join(os.homedir(), '.claude.json');
    }

    /**
     * 读取 bypassPermissionsModeAccepted 字段的值
     */
    async getBypassPermissionStatus(): Promise<boolean> {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(this.configPath)) {
                this.outputChannel.appendLine(`[ConfigReader] Config file not found: ${this.configPath}`);
                return false;
            }

            // 读取文件内容
            const content = await fs.promises.readFile(this.configPath, 'utf8');

            // 解析 JSON
            const config = JSON.parse(content);

            // 返回权限字段值，默认为 false
            const hasPermission = config.bypassPermissionsModeAccepted === true;

            return hasPermission;
        } catch (error) {
            this.outputChannel.appendLine(`[ConfigReader] Error reading config: ${error}`);
            return false;
        }
    }

    /**
     * 设置 bypassPermissionsModeAccepted 字段的值
     */
    async setBypassPermission(value: boolean): Promise<void> {
        try {
            let config: any = {};

            // 如果文件存在，先读取现有配置
            if (fs.existsSync(this.configPath)) {
                const content = await fs.promises.readFile(this.configPath, 'utf8');
                let parseSuccess = false;

                try {
                    config = JSON.parse(content);
                    parseSuccess = true;
                } catch (e) {
                    // 如果解析失败，重试两次
                    this.outputChannel.appendLine(`[ConfigReader] Failed to parse existing config, retrying...`);
                    for (let i = 0; i < 2; i++) {
                        try {
                            config = JSON.parse(content);
                            parseSuccess = true;
                            break;
                        } catch (e) {
                            this.outputChannel.appendLine(`[ConfigReader] Retry ${i + 1} failed to parse config`);
                        }
                    }
                }

                // 如果仍然失败，则写入空对象
                if (!parseSuccess) {
                    this.outputChannel.appendLine(`[ConfigReader] All parse attempts failed, using empty config object`);
                    config = {};
                }
            }

            // 设置权限字段
            config.bypassPermissionsModeAccepted = value;

            // 确保目录存在
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }

            // 写回文件（保持 2 空格缩进格式）
            await fs.promises.writeFile(
                this.configPath,
                JSON.stringify(config, null, 2),
                'utf8'
            );

            this.outputChannel.appendLine(
                `[ConfigReader] Set bypassPermissionsModeAccepted to ${value}`
            );
        } catch (error) {
            this.outputChannel.appendLine(
                `[ConfigReader] Failed to set permission: ${error}`
            );
            throw error;
        }
    }

    /**
     * 监听配置文件变化
     */
    watchConfigFile(callback: () => void): void {
        // 保存回调
        this.watchCallback = callback;

        // 使用 fs.watchFile 监听文件变化
        // 测试表明这是最可靠的方法
        fs.watchFile(this.configPath, { interval: 2000 }, (curr, prev) => {
            if (curr.mtime.getTime() !== prev.mtime.getTime()) {
                // 文件变化时调用回调，日志在权限变化时才打印
                callback();
            }
        });

        this.outputChannel.appendLine(
            `[ConfigReader] Started watching config file: ${this.configPath}`
        );
    }

    /**
     * 清理资源
     */
    dispose(): void {
        // 停止监听文件
        if (this.watchCallback) {
            fs.unwatchFile(this.configPath);
            this.outputChannel.appendLine('[ConfigReader] Stopped watching config file');
        }
    }
}