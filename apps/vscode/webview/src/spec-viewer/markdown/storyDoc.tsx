import { useEffect } from 'preact/hooks';
import { renderMarkdown, setHasSpecContext, setTaskSummaries } from './index';
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
}

export function MarkdownDoc({ md, summaries }: MarkdownDocProps) {
    setHasSpecContext(false);
    setTaskSummaries(summaries ?? null);
    const html = renderMarkdown(md);
    // Apply syntax highlighting after paint, exactly as index.tsx does at runtime.
    useEffect(() => {
        setupLedgerRefs();
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
            style="max-width: 820px;"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
