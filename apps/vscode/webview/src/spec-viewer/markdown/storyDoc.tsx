import { useEffect } from 'preact/hooks';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setTaskSummaries } from 'speckit-viewer/core/markdown/index';
import { setupLedgerTasks } from './ledger/tasksInteractions';
import { applyHighlighting } from '../highlighting';
import { resolveLedgerRefs } from './ledger/refs';
import { setupLedgerRefs } from '../ledgerRefs';

/**
 * Shared Storybook host: renders markdown through the real `renderMarkdown`
 * pipeline into a `#markdown-content` element so the shipped CSS applies. Not a
 * `.stories.tsx` file, so Storybook treats it as a plain helper module.
 */
export interface MarkdownDocProps {
    md: string;
    summaries?: Record<string, { did?: string; files?: string[] }>;
    currentTask?: string;
    width?: number;
}

export function MarkdownDoc({ md, summaries, currentTask, width }: MarkdownDocProps) {
    setCurrentTask(currentTask ?? null);
    setHasSpecContext(false);
    setTaskSummaries(summaries ?? null);
    const html = renderMarkdown(md);
    // Apply syntax highlighting after paint, exactly as index.tsx does at runtime.
    useEffect(() => {
        setupLedgerRefs();
        setupLedgerTasks();
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            const root = document.getElementById('markdown-content');
            if (root) resolveLedgerRefs(root);
        });
        return () => cancelAnimationFrame(id);
    }, [html]);
    return (
        <div
            id="markdown-content"
            style={`max-width: ${width ?? 820}px;`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
