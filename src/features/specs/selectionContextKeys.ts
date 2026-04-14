import * as vscode from 'vscode';
import * as path from 'path';
import { readSpecContextSync } from './specContextManager';
import { SpecStatuses } from '../../core/constants';

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
    const specs = (selection || []).filter(i => i?.contextValue === 'spec');
    const statuses = specs.map(resolveStatus);
    const count = statuses.length;

    const isCompleted = (s: string) => s === SpecStatuses.COMPLETED;
    const isArchived = (s: string) => s === SpecStatuses.ARCHIVED;
    const isActive = (s: string) => !isCompleted(s) && !isArchived(s);

    const allActive = count > 0 && statuses.every(isActive);
    const allCompleted = count > 0 && statuses.every(isCompleted);
    const allArchived = count > 0 && statuses.every(isArchived);
    const mixed = count > 1 && !allActive && !allCompleted && !allArchived;

    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.count', count);
    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.allActive', allActive);
    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.allCompleted', allCompleted);
    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.allArchived', allArchived);
    vscode.commands.executeCommand('setContext', 'speckit.specs.selection.mixed', mixed);
}
