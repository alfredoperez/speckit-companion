import * as vscode from 'vscode';
import { ConfigKeys } from '../../core/constants';

const FILTER_ACTIVE_CONTEXT_KEY = 'speckit.specs.filterActive';

/**
 * Tracks the current specs-tree filter query and persists it to workspace state.
 * Notifies the provider via `onChange` whenever the query changes so the tree refreshes.
 */
export class SpecsFilterState {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly onChange: () => void
    ) {}

    getQuery(): string {
        return this.context.workspaceState.get<string>(ConfigKeys.workspaceState.specsFilterQuery) ?? '';
    }

    async setQuery(q: string): Promise<void> {
        const trimmed = (q ?? '').trim();
        if (trimmed.length === 0) {
            await this.clear();
            return;
        }
        await this.context.workspaceState.update(ConfigKeys.workspaceState.specsFilterQuery, trimmed);
        await vscode.commands.executeCommand('setContext', FILTER_ACTIVE_CONTEXT_KEY, true);
        this.onChange();
    }

    async clear(): Promise<void> {
        await this.context.workspaceState.update(ConfigKeys.workspaceState.specsFilterQuery, undefined);
        await vscode.commands.executeCommand('setContext', FILTER_ACTIVE_CONTEXT_KEY, false);
        this.onChange();
    }

    async initialize(): Promise<void> {
        const active = this.getQuery().length > 0;
        await vscode.commands.executeCommand('setContext', FILTER_ACTIVE_CONTEXT_KEY, active);
    }
}
