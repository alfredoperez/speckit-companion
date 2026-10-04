import { useEffect } from 'preact/hooks';
import type { BugStory, IdeaDecision, ReportNav } from '../../../../src/features/reports/reportPageModel';
import { applyHighlighting } from '../highlighting';
import { buildToc } from '../toc';
import { BugStoryPage } from './BugStoryPage';
import { IdeaDecisionPage } from './IdeaDecisionPage';

export function ReportPage({ report }: { report: ReportNav & { page: BugStory | IdeaDecision } }) {
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            applyHighlighting();
            buildToc(
                document.getElementById('content-area'),
                document.getElementById('markdown-content'),
                document.getElementById('spec-toc')
            );
        });
        return () => cancelAnimationFrame(frame);
    }, [report.page]);

    return report.kind === 'bug'
        ? <BugStoryPage story={report.page as BugStory} />
        : <IdeaDecisionPage decision={report.page as IdeaDecision} />;
}
