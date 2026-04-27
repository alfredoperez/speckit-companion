import * as vscode from 'vscode';
import * as path from 'path';
import { readSpecContextSync } from './specContextManager';
import { SpecStatuses } from '../../core/constants';
import { isSpecLifecycleItem } from './specExplorerProvider';

// Menu visibility is driven by per-item viewItem (see SpecItem.contextValue in specExplorerProvider.ts);
// this module now writes only count/mixed for any UI that still depends on them.

export interface SelectableSpecItem {
    contextValue?: string;
    specPath?: string;
}

function resolveStatus(item: SelectableSpecItem): string {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!ws || !item.specPath) return SpecStatuses.ACTIVE;
    const ctx = readSpecContextSync(path.join(ws, item.specPath));
    return ctx?.status || SpecStatuses.ACTIVE;
}

export function updateSelectionContextKeys(selection: readonly SelectableSpecItem[]): void {
    const specs = (selection || []).filter(i => isSpecLifecycleItem(i?.contextValue));
    const statuses = specs.map(resolveStatus);
    const count = statuses.length;

    const someCompleted = statuses.some(s => s === SpecStatuses.COMPLETED);
    const someArchived = statuses.some(s => s === SpecStatuses.ARCHIVED);
    const someActive = statuses.some(s => s !== SpecStatuses.COMPLETED && s !== SpecStatuses.ARCHIVED);
    const groupCount = (someCompleted ? 1 : 0) + (someArchived ? 1 : 0) + (someActive ? 1 : 0);
    const mixed = count > 1 && groupCount > 1;

    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.count', count);
    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.mixed', mixed);
}
