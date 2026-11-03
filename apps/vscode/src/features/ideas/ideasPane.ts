import * as path from 'path';
import * as vscode from 'vscode';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import type { ProcessPaneConfig } from '../processes/processPaneProvider';
import { ConfigKeys } from '../../core/constants';
import { IDEAS_DIR, IDEA_SET, IdeaReport, IdeaStage, IdeaVerdict, ideasDir, readIdeaReports } from './ideaReports';

const VERDICT_COLOURS: Record<IdeaVerdict, string> = {
    go: 'testing.iconPassed',
    'needs-clarification': 'charts.yellow',
    kill: 'list.errorForeground',
};

export const ideasPaneConfig: ProcessPaneConfig<IdeaStage, IdeaReport> = {
    name: 'Ideas',
    set: IDEA_SET,
    read: readIdeaReports,
    groups: [
        { id: 'assessing', label: 'Assessing', icon: 'search' },
        { id: 'decided', label: 'Decided', icon: 'law' },
    ],
    groupOf: idea => idea.state,
    describe: idea => (idea.state === 'assessing' ? idea.latestStage : idea.verdict),
    icon: idea => {
        if (idea.state === 'assessing') return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('charts.blue'));
        if (!idea.verdict) return new vscode.ThemeIcon('lightbulb');
        return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor(VERDICT_COLOURS[idea.verdict]));
    },
    extensionId: 'assess',
    installLabel: "Install Spec Kit's assess extension",
    settingNote: root => {
        const folder = ideasDir(root).split(path.sep).join('/');
        if (folder === IDEAS_DIR.split(path.sep).join('/')) return undefined;
        return {
            label: `Reading ${folder}`,
            tooltip: `Reading ${folder}, set in Settings. Spec-kit's assess commands still write to .specify/assessments unless your project overrides them.`,
            setting: ConfigKeys.assessmentsDirectory,
        };
    },
    emptyLabel: () => `No ideas yet. Start one with /${formatCommandForProvider('speckit.assess.intake')}.`,
};

/** The folder the Ideas pane reads, shown beside the view title. */
export function ideasViewDescription(root: string): string {
    return ideasDir(root).split(path.sep).join('/');
}
