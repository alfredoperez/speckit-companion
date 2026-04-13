import * as vscode from 'vscode';
import { IAIProvider, AIProviderType, getConfiguredProviderType, PROVIDER_PATHS } from './aiProvider';
import { ClaudeCodeProvider } from './claudeCodeProvider';
import { GeminiCliProvider } from './geminiCliProvider';
import { CopilotCliProvider } from './copilotCliProvider';
import { CodexCliProvider } from './codexCliProvider';
import { QwenCliProvider } from './qwenCliProvider';
import { OpenCodeProvider } from './openCodeProvider';
import { AIProviders } from '../core/constants';

type ProviderConstructor = (
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
) => IAIProvider;

const PROVIDER_CONSTRUCTORS: Record<AIProviderType, ProviderConstructor> = {
    [AIProviders.CLAUDE]: (ctx, out) => new ClaudeCodeProvider(ctx, out),
    [AIProviders.GEMINI]: (ctx, out) => new GeminiCliProvider(ctx, out),
    [AIProviders.COPILOT]: (ctx, out) => new CopilotCliProvider(ctx, out),
    [AIProviders.CODEX]: (ctx, out) => new CodexCliProvider(ctx, out),
    [AIProviders.QWEN]: (ctx, out) => new QwenCliProvider(ctx, out),
    [AIProviders.OPENCODE]: (ctx, out) => new OpenCodeProvider(ctx, out),
};

/**
 * Factory for creating AI provider instances based on configuration
 */
export class AIProviderFactory {
    private static providers: Map<AIProviderType, IAIProvider> = new Map();

    static getProvider(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ): IAIProvider {
        return this.getProviderByType(getConfiguredProviderType(), context, outputChannel);
    }

    static getProviderByType(
        type: AIProviderType,
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ): IAIProvider {
        const cached = this.providers.get(type);
        if (cached) return cached;

        const ctor = PROVIDER_CONSTRUCTORS[type];
        let provider: IAIProvider;
        if (ctor) {
            provider = ctor(context, outputChannel);
        } else {
            outputChannel.appendLine(`[AIProviderFactory] Unknown provider type: ${type}, falling back to Claude Code`);
            provider = PROVIDER_CONSTRUCTORS[AIProviders.CLAUDE](context, outputChannel);
        }

        this.providers.set(type, provider);
        return provider;
    }

    static clearCache(): void {
        this.providers.clear();
    }

    static getSupportedProviders(): { type: AIProviderType; name: string; available: boolean }[] {
        return (Object.keys(PROVIDER_PATHS) as AIProviderType[]).map(type => ({
            type,
            name: PROVIDER_PATHS[type].displayName,
            available: true,
        }));
    }
}
