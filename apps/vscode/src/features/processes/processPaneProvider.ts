import * as vscode from 'vscode';
import { Commands } from '../../core/constants';
import { BaseTreeDataProvider } from '../../core/providers/BaseTreeDataProvider';
import { getProjectRoot, hasSpecKitMarker } from '../../core/projectRoot';
import type { ReportFile, ReportSet } from '../reports/reportSet';
import { ProcessExtensionId, ProcessExtensionInfo, processExtensionInfo, processExtensionState } from '../../speckit/processExtensions';

const VIEW_DOCUMENT_COMMAND = 'speckit.viewSpecDocument';

export interface ProcessItem<K extends string = string> {
    slug: string;
    directory: string;
    title: string;
    reports: Record<K, ReportFile<K>>;
}

export interface ProcessGroup {
    id: string;
    label: string;
    icon: string;
}

/** Everything that differs between the Bugs pane and the Ideas pane. */
export interface ProcessPaneConfig<K extends string, T extends ProcessItem<K>> {
    name: string;
    set: ReportSet<K>;
    read(root: string): T[];
    groups: readonly ProcessGroup[];
    groupOf(item: T): string;
    describe(item: T): string | undefined;
    icon(item: T): vscode.ThemeIcon;
    extensionId: ProcessExtensionId;
    installLabel: string;
    emptyLabel(): string;
    /** A row shown ahead of the groups, for a setting that moved the folder this pane reads. */
    settingNote?(root: string): { label: string; tooltip: string; setting: string } | undefined;
}

export type ProcessRowKind =
    | 'process-group'
    | 'process-item'
    | 'process-report'
    | 'process-report-missing'
    | 'process-install'
    | 'process-empty'
    | 'process-setting-note'
    | 'process-extension-off'
    | 'process-extension-foreign';

export class ProcessRow extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: ProcessRowKind,
        public readonly children: ProcessRow[] = [],
    ) {
        super(label, collapsibleState);
    }
}

export class ProcessPaneProvider<K extends string, T extends ProcessItem<K>> extends BaseTreeDataProvider<ProcessRow> {
    constructor(
        context: vscode.ExtensionContext,
        private readonly config: ProcessPaneConfig<K, T>,
        outputChannel?: vscode.OutputChannel,
    ) {
        super(context, { name: `${config.name}Pane`, outputChannel });
    }

    getChildren(element?: ProcessRow): ProcessRow[] {
        if (element) return element.children;
        const root = getProjectRoot();
        if (!root) return [];

        const extension = processExtensionInfo(root, this.config.extensionId);
        void vscode.commands.executeCommand('setContext', `speckit.${this.config.set.id}.extensionOff`, extension.disabled);
        const items = this.config.read(root);
        const note = [...this.settingNoteRow(root), ...this.extensionNoteRow(extension, items.length)];
        if (items.length === 0) {
            if (!hasSpecKitMarker(root)) return note;
            return extension.disabled ? note : [...note, this.nothingToList(root)];
        }

        return [...note, ...this.config.groups
            .map(group => ({ group, members: items.filter(item => this.config.groupOf(item) === group.id) }))
            .filter(({ members }) => members.length > 0)
            .map(({ group, members }) => this.groupRow(group, members, extension.disabled))];
    }

    private extensionNoteRow(extension: ProcessExtensionInfo, count: number): ProcessRow[] {
        const id = this.config.extensionId;
        const named = [id, extension.version].filter(Boolean).join(' ');
        if (extension.disabled) {
            const row = new ProcessRow(`The ${id} extension is turned off`, vscode.TreeItemCollapsibleState.None, 'process-extension-off');
            row.id = `${this.config.set.id}:extension-off`;
            row.iconPath = new vscode.ThemeIcon('circle-slash');
            row.description = `${named} · Turn it on`;
            const folders = count === 1 ? 'Its 1 folder is' : `Its ${count} folders are`;
            row.tooltip = `${count > 0 ? `${folders} still here and you can read them. ` : ''}Its commands need the extension back on: specify extension enable ${id}`;
            row.command = { command: Commands.processesEnableExtension, title: 'Turn it on', arguments: [id] };
            return [row];
        }
        if (extension.foreign) {
            const row = new ProcessRow(`A different ${id} extension is installed`, vscode.TreeItemCollapsibleState.None, 'process-extension-foreign');
            row.id = `${this.config.set.id}:extension-foreign`;
            row.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
            row.description = `${named} · not the bundled one`;
            row.tooltip = `It uses the same name, but it comes from ${extension.author ? `"${extension.author}"` : 'another author'}, not spec-kit. Companion shows its folders, but its steps and fields may not match.`;
            if (extension.manifestPath) {
                row.command = { command: 'vscode.open', title: 'See where it came from', arguments: [vscode.Uri.file(extension.manifestPath)] };
            }
            return [row];
        }
        return [];
    }

    private settingNoteRow(root: string): ProcessRow[] {
        const note = this.config.settingNote?.(root);
        if (!note) return [];
        const row = new ProcessRow(note.label, vscode.TreeItemCollapsibleState.None, 'process-setting-note');
        row.id = `${this.config.set.id}:setting`;
        row.iconPath = new vscode.ThemeIcon('settings-gear');
        row.description = 'Open the setting';
        row.tooltip = note.tooltip;
        row.command = { command: 'workbench.action.openSettings', title: 'Open the setting', arguments: [note.setting] };
        return [row];
    }

    private nothingToList(root: string): ProcessRow {
        if (processExtensionState(root, this.config.extensionId) === 'absent') {
            const row = new ProcessRow(this.config.installLabel, vscode.TreeItemCollapsibleState.None, 'process-install');
            row.id = `${this.config.set.id}:install`;
            row.iconPath = new vscode.ThemeIcon('cloud-download');
            row.command = {
                command: Commands.processesInstallExtension,
                title: this.config.installLabel,
                arguments: [this.config.extensionId],
            };
            return row;
        }
        const row = new ProcessRow(this.config.emptyLabel(), vscode.TreeItemCollapsibleState.None, 'process-empty');
        row.id = `${this.config.set.id}:empty`;
        row.iconPath = new vscode.ThemeIcon('info');
        return row;
    }

    private groupRow(group: ProcessGroup, members: T[], readOnly: boolean): ProcessRow {
        const row = new ProcessRow(
            `${group.label} (${members.length})${readOnly ? ' · read only' : ''}`,
            vscode.TreeItemCollapsibleState.Expanded,
            'process-group',
            members.map(item => this.itemRow(item)),
        );
        row.id = `${this.config.set.id}:group:${group.id}`;
        row.iconPath = new vscode.ThemeIcon(group.icon);
        return row;
    }

    private itemRow(item: T): ProcessRow {
        const reports = this.config.set.kinds.map(kind => item.reports[kind]);
        const row = new ProcessRow(
            item.title,
            vscode.TreeItemCollapsibleState.Collapsed,
            'process-item',
            reports.map(report => this.reportRow(item, report)),
        );
        row.id = `${this.config.set.id}:${item.slug}`;
        row.iconPath = this.config.icon(item);
        const detail = this.config.describe(item);
        row.description = detail;
        row.tooltip = detail ? `${item.title}\n${detail}` : item.title;
        const first = reports.find(report => report.exists);
        if (first) row.command = this.open(first, item.title, true);
        return row;
    }

    private reportRow(item: T, report: ReportFile<K>): ProcessRow {
        const row = new ProcessRow(
            report.label,
            vscode.TreeItemCollapsibleState.None,
            report.exists ? 'process-report' : 'process-report-missing',
        );
        row.id = `${this.config.set.id}:${item.slug}:${report.kind}`;
        if (report.exists) {
            row.iconPath = new vscode.ThemeIcon('markdown');
            row.tooltip = report.path;
            row.command = this.open(report, report.label);
        } else {
            row.description = 'not created';
        }
        return row;
    }

    private open(report: ReportFile<K>, title: string, landing = false): vscode.Command {
        return {
            command: VIEW_DOCUMENT_COMMAND,
            title: `Open ${title}`,
            arguments: [report.path, { report: this.config.set.id, ...(landing ? { landing } : {}) }],
        };
    }
}
