import * as vscode from 'vscode';
import { ConfigKeys } from '../../core/constants';
import { ALL_SORT_MODES, DEFAULT_SORT_MODE, SortMode } from './specsSortMode';

const SORT_ACTIVE_CONTEXT_KEY = 'speckit.specs.sortActive';

/**
 * Tracks the current specs-tree sort mode and persists it to workspace state.
 * Notifies the provider via `onChange` whenever the mode changes so the tree
 * refreshes. The `sortActive` context key is true whenever the mode is
 * non-default; gates a potential "reset sort" menu affordance without
 * affecting the default experience.
 */
export class SpecsSortState {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly onChange: () => void
    ) {}

    getMode(): SortMode {
        const raw = this.context.workspaceState.get<string>(ConfigKeys.workspaceState.specsSortMode);
        return this.coerce(raw);
    }

    async setMode(mode: SortMode): Promise<void> {
        const coerced = this.coerce(mode);
        if (coerced === DEFAULT_SORT_MODE) {
            await this.clear();
            return;
        }
        await this.context.workspaceState.update(ConfigKeys.workspaceState.specsSortMode, coerced);
        await vscode.commands.executeCommand('setContext', SORT_ACTIVE_CONTEXT_KEY, true);
        this.onChange();
    }

    async clear(): Promise<void> {
        await this.context.workspaceState.update(ConfigKeys.workspaceState.specsSortMode, undefined);
        await vscode.commands.executeCommand('setContext', SORT_ACTIVE_CONTEXT_KEY, false);
        this.onChange();
    }

    async initialize(): Promise<void> {
        const active = this.getMode() !== DEFAULT_SORT_MODE;
        await vscode.commands.executeCommand('setContext', SORT_ACTIVE_CONTEXT_KEY, active);
    }

    private coerce(raw: string | undefined): SortMode {
        if (raw && (ALL_SORT_MODES as readonly string[]).includes(raw)) {
            return raw as SortMode;
        }
        return DEFAULT_SORT_MODE;
    }
}
