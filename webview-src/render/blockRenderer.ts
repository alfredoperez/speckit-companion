/**
 * Block renderers for code blocks and tables
 */
import { escapeHtml, parseInlineMarkdown } from '../markdown';

export function renderCodeBlock(lines: string[], lang: string): string {
    // Handle mermaid diagrams specially
    if (lang === 'mermaid') {
        const code = lines.join('\n');
        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="mermaid-container" id="${id}">
                <div class="mermaid">${escapeHtml(code)}</div>
            </div>
        `;
    }

    const code = lines.join('\n');
    // Add language class for highlight.js (don't escape - hljs will handle it)
    const langClass = lang ? `language-${lang}` : '';
    return `
        <div class="code-block" data-lang="${lang || ''}">
            ${lang ? `<div class="code-lang">${escapeHtml(lang)}</div>` : ''}
            <pre><code class="${langClass}">${escapeHtml(code)}</code></pre>
        </div>
    `;
}

export function renderTable(lines: string[]): string {
    // Filter out separator row (|---|---|)
    const dataRows = lines.filter(line => !line.match(/^\|[\s\-:|]+\|$/));

    if (dataRows.length === 0) return '';

    // First row is header
    const headerCells = dataRows[0].split('|').filter(c => c.trim());
    const bodyRows = dataRows.slice(1);

    let html = '<table class="md-table"><thead><tr>';
    headerCells.forEach(cell => {
        html += `<th>${parseInlineMarkdown(cell.trim())}</th>`;
    });
    html += '</tr></thead><tbody>';

    bodyRows.forEach(row => {
        const cells = row.split('|').filter(c => c.trim());
        html += '<tr>';
        cells.forEach(cell => {
            html += `<td>${parseInlineMarkdown(cell.trim())}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}
