import * as vscode from 'vscode';
import { IAIProvider, AIProviderType, getConfiguredProviderType } from './aiProvider';
import { ClaudeCodeProvider } from './claudeCodeProvider';
import { GeminiCliProvider } from './geminiCliProvider';
import { CopilotCliProvider } from './copilotCliProvider';

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
            case 'claude':
                provider = new ClaudeCodeProvider(context, outputChannel);
                break;
            case 'gemini':
                provider = new GeminiCliProvider(context, outputChannel);
                break;
            case 'copilot':
                provider = new CopilotCliProvider(context, outputChannel);
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
            { type: 'claude', name: 'Claude Code', available: true },
            { type: 'gemini', name: 'Gemini CLI', available: true },
            { type: 'copilot', name: 'GitHub Copilot CLI', available: true }
        ];
    }
}
