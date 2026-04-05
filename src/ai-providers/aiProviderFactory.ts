import * as vscode from 'vscode';
import { IAIProvider, AIProviderType, getConfiguredProviderType } from './aiProvider';
import { ClaudeCodeProvider } from './claudeCodeProvider';
import { GeminiCliProvider } from './geminiCliProvider';
import { CopilotCliProvider } from './copilotCliProvider';
import { CodexCliProvider } from './codexCliProvider';
import { QwenCliProvider } from './qwenCliProvider';
import { AIProviders } from '../core/constants';

/**
 * Factory for creating AI provider instances based on configuration
 */
export class AIProviderFactory {
    private static providers: Map<AIProviderType, IAIProvider> = new Map();

    /**
     * Get the configured AI provider instance
     */
    static getProvider(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ): IAIProvider {
        const providerType = getConfiguredProviderType();
        return this.getProviderByType(providerType, context, outputChannel);
    }

    /**
     * Get a specific AI provider by type
     */
    static getProviderByType(
        type: AIProviderType,
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ): IAIProvider {
        // Return cached instance if available
        const cached = this.providers.get(type);
        if (cached) {
            return cached;
        }

        // Create new instance
        let provider: IAIProvider;

        switch (type) {
            case AIProviders.CLAUDE:
                provider = new ClaudeCodeProvider(context, outputChannel);
                break;
            case AIProviders.GEMINI:
                provider = new GeminiCliProvider(context, outputChannel);
                break;
            case AIProviders.COPILOT:
                provider = new CopilotCliProvider(context, outputChannel);
                break;
            case AIProviders.CODEX:
                provider = new CodexCliProvider(context, outputChannel);
                break;
            case AIProviders.QWEN:
                provider = new QwenCliProvider(context, outputChannel);
                break;
            default:
                outputChannel.appendLine(`[AIProviderFactory] Unknown provider type: ${type}, falling back to Claude Code`);
                provider = new ClaudeCodeProvider(context, outputChannel);
        }

        this.providers.set(type, provider);
        return provider;
    }

    /**
     * Clear cached providers (useful for testing or config changes)
     */
    static clearCache(): void {
        this.providers.clear();
    }

    /**
     * Get all supported provider types
     */
    static getSupportedProviders(): { type: AIProviderType; name: string; available: boolean }[] {
        return [
            { type: AIProviders.CLAUDE, name: 'Claude Code', available: true },
            { type: AIProviders.GEMINI, name: 'Gemini CLI', available: true },
            { type: AIProviders.COPILOT, name: 'GitHub Copilot CLI', available: true },
            { type: AIProviders.CODEX, name: 'Codex CLI', available: true },
            { type: AIProviders.QWEN, name: 'Qwen Code', available: true }
        ];
    }
}
