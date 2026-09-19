import { useEffect } from 'preact/hooks';
import { renderMarkdown, setHasSpecContext, setTaskSummaries } from './index';
import { applyHighlighting } from '../highlighting';

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
        const id = requestAnimationFrame(() => applyHighlighting());
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
