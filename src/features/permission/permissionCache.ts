import * as vscode from 'vscode';
import { ConfigReader } from './configReader';

export interface IPermissionCache extends vscode.EventEmitter<boolean> {
    get(): Promise<boolean>;
    refresh(): Promise<void>;
    refreshAndGet(): Promise<boolean>;
}

export class PermissionCache extends vscode.EventEmitter<boolean> implements IPermissionCache {
    private cache?: boolean;

    constructor(
        private configReader: ConfigReader,
        private outputChannel: vscode.OutputChannel
    ) {
        super();
    }

    /**
     * 获取权限状态（使用缓存）
     */
    async get(): Promise<boolean> {
        // 如果有缓存直接返回
        if (this.cache !== undefined) {
            return this.cache;
        }

        // 否则调用 refreshAndGet
        return this.refreshAndGet();
    }

    /**
     * 刷新缓存（不返回值）
     */
    async refresh(): Promise<void> {
        await this.refreshAndGet();
    }

    /**
     * 刷新缓存并返回最新值
     */
    async refreshAndGet(): Promise<boolean> {
        // 保存旧值
        const oldValue = this.cache;

        // 从 ConfigReader 读取最新状态
        this.cache = await this.configReader.getBypassPermissionStatus();

        // 只在权限状态变化时打印日志
        if (oldValue !== this.cache) {
            this.outputChannel.appendLine(
                `[PermissionCache] Permission changed: ${oldValue} -> ${this.cache}`
            );

            // 如果权限从 false 变为 true，触发事件
            if (oldValue === false && this.cache === true) {
                this.outputChannel.appendLine(
                    '[PermissionCache] Permission granted! Firing event.'
                );
                this.fire(true);
            }

            // 如果权限从 true 变为 false，也触发事件
            if (oldValue === true && this.cache === false) {
                this.outputChannel.appendLine(
                    '[PermissionCache] Permission revoked! Firing event.'
                );
                this.fire(false);
            }
        }

        return this.cache;
    }

}