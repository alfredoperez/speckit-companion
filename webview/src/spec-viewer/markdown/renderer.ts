/**
 * SpecKit Companion - Markdown Renderer
 * Main rendering loop for converting markdown to HTML
 */

import { escapeHtml, parseInline } from './inline';
import {
    preprocessSpecMetadata,
    preprocessUserStories,
    preprocessAcceptanceScenarios,
    preprocessCallouts,
    preprocessHtmlComments
} from './preprocessors';
import { parseAcceptanceScenarios } from './scenarios';

// Line number counter for tracking editable content
let currentLineNum = 0;

/**
 * Check if content looks like a tree structure (file tree, directory listing, etc.)
 */
function isTreeStructure(text: string): boolean {
    const lines = text.split('\n');
    // Box drawing characters used in tree structures
    const treeChars = /^[\s]*[├└│─┬┴┼┌┐└┘┤├]+/;
    // Common tree patterns: │ ├ └ with dashes or spaces
    const treePattern = /^[\s]*[│├└]\s*[─-]/;
    // Indented list with dashes commonly used for trees
    const indentedDashPattern = /^(\s{2,}|\t)[-*]/;

    let treeLineCount = 0;
    for (const line of lines) {
        if (treeChars.test(line) || treePattern.test(line) || indentedDashPattern.test(line)) {
            treeLineCount++;
        }
    }

    // If more than 30% of non-empty lines look like tree structure, treat as tree
    const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
    return nonEmptyLines > 0 && (treeLineCount / nonEmptyLines) > 0.3;
}

/**
 * Wrap content with line action buttons for hover editing
 * Uses single "+" button for GitHub-style inline review
 */
// Comment icon SVG for line action buttons
const COMMENT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3" color="currentColor"/></svg>`;

function wrapWithLineActions(content: string, lineNum: number, _isRefinable: boolean = true): string {
    return `<div class="line" data-line="${lineNum}">
        <button class="line-add-btn" data-line="${lineNum}" title="Add comment">
            ${COMMENT_ICON_SVG}
        </button>
        <div class="line-content">${content}</div>
        <div class="line-comment-slot"></div>
    </div>`;
}

/**
 * Render a table from rows
 */
function renderTable(rows: string[]): string {
    if (rows.length < 2) return '';

    let html = '<table>\n';

    // Header row
    const headerCells = rows[0].split('|').filter(c => c.trim());
    html += '<thead><tr>\n';
    for (const cell of headerCells) {
        html += `<th>${parseInline(cell.trim())}</th>\n`;
    }
    html += '</tr></thead>\n';

    // Body rows (skip separator row)
    if (rows.length > 2) {
        html += '<tbody>\n';
        for (let i = 2; i < rows.length; i++) {
            const cells = rows[i].split('|').filter(c => c.trim());
            html += '<tr>\n';
            for (const cell of cells) {
                html += `<td>${parseInline(cell.trim())}</td>\n`;
            }
            html += '</tr>\n';
        }
        html += '</tbody>\n';
    }

    html += '</table>\n';
    return html;
}

/**
 * Add progress bars after section headings (h2/h3) that contain task lists
 */
function addTaskProgressHeaders(html: string): string {
    // Pattern to find h2 or h3 headings followed by content until next h2/h3 or end
    const sectionPattern = /(<h[23]>[\s\S]*?<\/h[23]>)([\s\S]*?)(?=<h[23]>|$)/g;

    return html.replace(sectionPattern, (match, heading, content) => {
        // Count tasks in this section
        const totalTasks = (content.match(/<li class="task-item/g) || []).length;
        const completedTasks = (content.match(/<li class="task-item checked"/g) || []).length;

        // Only add progress if section has tasks
        if (totalTasks === 0) return match;

        const percent = Math.round((completedTasks / totalTasks) * 100);
        const allDone = completedTasks === totalTasks;

        // Create compact progress bar
        const progressBar = `
<div class="section-progress">
    <div class="section-progress-bar">
        <div class="section-progress-fill ${allDone ? 'complete' : ''}" style="width: ${percent}%"></div>
    </div>
    <span class="section-progress-text">${completedTasks}/${totalTasks}${allDone ? ' ✓' : ''}</span>
</div>`;

        // Mark task lists with simplified class
        const updatedContent = content.replace(/<ul>\s*(<li class="task-item)/g, '<ul class="task-list-simple">$1');

        return `${heading}${progressBar}${updatedContent}`;
    });
}

/**
 * Parse and render markdown content to HTML
 */
export function renderMarkdown(markdown: string): string {
    // Preprocess special patterns before main rendering
    markdown = preprocessHtmlComments(markdown);
    markdown = preprocessSpecMetadata(markdown);
    markdown = preprocessUserStories(markdown);
    markdown = parseAcceptanceScenarios(markdown);  // New: Convert to tables
    markdown = preprocessAcceptanceScenarios(markdown);  // Legacy: kept for compatibility
    markdown = preprocessCallouts(markdown);

    // Reset line counter
    currentLineNum = 0;

    let html = '';
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeContent: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';
    let inTable = false;
    let tableRows: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track the original line number (1-indexed)
        const sourceLineNum = i + 1;

        // Code blocks
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = line.slice(3).trim();
                codeContent = [];
            } else {
                inCodeBlock = false;
                const codeText = codeContent.join('\n');

                // Handle mermaid diagrams
                if (codeBlockLang === 'mermaid') {
                    const mermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    html += `<div class="mermaid-container"><pre class="mermaid" id="${mermaidId}">${escapeHtml(codeText)}</pre></div>\n`;
                } else if (isTreeStructure(codeText) || codeBlockLang === 'text' || codeBlockLang === 'plaintext' || codeBlockLang === '') {
                    // Tree structure or plain text
                    html += `<pre class="tree-structure"><code>${escapeHtml(codeText)}</code></pre>\n`;
                } else {
                    // Regular code block with language
                    const langClass = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : '';
                    const dataLang = codeBlockLang ? ` data-language="${escapeHtml(codeBlockLang)}"` : '';
                    html += `<pre class="code-block"${dataLang}><code${langClass}>${escapeHtml(codeText)}</code></pre>\n`;
                }
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent.push(line);
            continue;
        }

        // Tables
        if (line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableRows = [];
            }
            tableRows.push(line);
            continue;
        } else if (inTable) {
            html += renderTable(tableRows);
            inTable = false;
            tableRows = [];
        }

        // Close list if we're not on a list item
        if (inList && !line.match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
            html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
            inList = false;
        }

        // Empty line
        if (!line.trim()) {
            if (inList) {
                html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                inList = false;
            }
            continue;
        }

        // Headings - wrap h3+ with line actions for commenting
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = parseInline(headingMatch[2]);
            // Wrap h3, h4, h5, h6 with line actions (subsection headers)
            if (level >= 3) {
                html += wrapWithLineActions(`<h${level}>${content}</h${level}>`, sourceLineNum);
            } else {
                html += `<h${level}>${content}</h${level}>\n`;
            }
            continue;
        }

        // Horizontal rule
        if (line.match(/^[-*_]{3,}$/)) {
            html += '<hr>\n';
            continue;
        }

        // Blockquote - wrap with line actions for commenting
        if (line.startsWith('>')) {
            const content = parseInline(line.slice(1).trim());
            html += wrapWithLineActions(`<blockquote><p>${content}</p></blockquote>`, sourceLineNum);
            continue;
        }

        // Unordered list
        const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                html += '<ul>\n';
                inList = true;
                listType = 'ul';
            }
            const content = parseInline(ulMatch[2]);
            // Check for task list
            const taskMatch = content.match(/^\[([ xX])\]\s*(.+)$/);
            if (taskMatch) {
                const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
                const checkedClass = checked ? ' class="task-item checked"' : ' class="task-item"';

                // Extract task ID pattern like "T017 [US3]" and show as tooltip
                const taskText = taskMatch[2];
                const taskIdMatch = taskText.match(/^(T\d+\s*\[US\d+\])\s*(.+)$/i);

                if (taskIdMatch) {
                    const taskId = taskIdMatch[1];
                    const cleanText = taskIdMatch[2];
                    html += `<li${checkedClass} title="${taskId}" data-line="${sourceLineNum}"><input type="checkbox" ${checked} data-line="${sourceLineNum}"><span class="task-text">${cleanText}</span></li>\n`;
                } else {
                    html += `<li${checkedClass} data-line="${sourceLineNum}"><input type="checkbox" ${checked} data-line="${sourceLineNum}"><span class="task-text">${taskText}</span></li>\n`;
                }
            } else {
                // Wrap regular list items with line actions for commenting
                html += `<li class="line" data-line="${sourceLineNum}">
                    <button class="line-add-btn" data-line="${sourceLineNum}" title="Add comment">
                        ${COMMENT_ICON_SVG}
                    </button>
                    <span class="line-content">${content}</span>
                    <div class="line-comment-slot"></div>
                </li>\n`;
            }
            continue;
        }

        // Ordered list
        const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
        if (olMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                html += '<ol>\n';
                inList = true;
                listType = 'ol';
            }
            const content = parseInline(olMatch[2]);
            // Wrap ordered list items with line actions for commenting
            html += `<li class="line" data-line="${sourceLineNum}">
                <button class="line-add-btn" data-line="${sourceLineNum}" title="Add comment">
                    ${COMMENT_ICON_SVG}
                </button>
                <span class="line-content">${content}</span>
                <div class="line-comment-slot"></div>
            </li>\n`;
            continue;
        }

        // Check if line is preprocessed HTML (callouts, user stories, metadata, scenario tables)
        // Match any line containing our custom class patterns or HTML structure elements
        if (line.includes('<div class="callout') ||
            line.includes('<div class="user-story-header') ||
            line.includes('<div class="spec-meta') ||
            line.includes('<div class="spec-input') ||
            line.includes('<p class="scenario-label') ||
            line.includes('<table class="scenario-table') ||
            line.includes('<details') ||
            line.includes('<summary') ||
            line.includes('</details>') ||
            line.includes('</summary>') ||
            line.includes('<span class="meta-') ||
            line.includes('<span class="story-') ||
            line.includes('<span class="priority-') ||
            line.includes('<span class="scenario-') ||
            line.includes('</div>') ||
            line.includes('</span>') ||
            line.includes('</p>') ||
            line.includes('</table>')) {
            html += line + '\n';
            continue;
        }

        // Paragraph - wrap with line actions for hover editing
        html += wrapWithLineActions(`<p>${parseInline(line)}</p>`, sourceLineNum);
    }

    // Close any open elements
    if (inList) {
        html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
    }
    if (inTable && tableRows.length > 0) {
        html += renderTable(tableRows);
    }
    if (inCodeBlock && codeContent.length > 0) {
        html += `<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>\n`;
    }

    return html;
}
