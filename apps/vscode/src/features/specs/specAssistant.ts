import * as vscode from 'vscode';
import { SpecContext } from '../../core/types/specContext';
import {
    AIProviderType,
    coerceProviderType,
    getProviderDisplayName,
} from '../../ai-providers/aiProvider';
import { readSpecContextSyncSafe } from './specContextReader';
import { updateSpecContext } from './specContextWriter';
import { rememberSpecTerminal } from './specTerminals';

/** The one source both the sidebar row and the viewer read the assistant name from. */
export function resolveSpecAssistant(ctx: { assistant?: string } | null | undefined): string | undefined {
    const type = coerceProviderType(ctx?.assistant);
    return type ? getProviderDisplayName(type) : undefined;
}

export function recordSpecAssistant(specDir: string, assistant: AIProviderType): void {
    const ctx = readSpecContextSyncSafe(specDir);
    if (!ctx || ctx.assistant === assistant) return;
    // The writer hands back this same snapshot when its locked re-read fails; skip rather than publish stale state.
    const mutate = (current: SpecContext): SpecContext => {
        if (current === ctx) throw new Error('spec context unreadable');
        return { ...current, assistant };
    };
    void updateSpecContext(specDir, mutate, ctx).catch(() => {});
}

function isTerminal(value: unknown): value is vscode.Terminal {
    return typeof value === 'object' && value !== null
        && typeof (value as { show?: unknown }).show === 'function';
}

/** Call once a dispatch has resolved, with the provider read before it was sent. Never throws. */
export function noteSpecDispatch(specDir: string, result: unknown, assistant: AIProviderType): void {
    try {
        if (isTerminal(result)) rememberSpecTerminal(specDir, result);
        recordSpecAssistant(specDir, assistant);
    } catch {
        return;
    }
}
