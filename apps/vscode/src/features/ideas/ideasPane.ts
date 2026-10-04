import * as vscode from 'vscode';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import type { ProcessPaneConfig } from '../processes/processPaneProvider';
import { IDEA_SET, IdeaReport, IdeaStage, IdeaVerdict, readIdeaReports } from './ideaReports';

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
    emptyLabel: () => `No ideas yet. Start one with /${formatCommandForProvider('speckit.assess.intake')}.`,
};
