/**
 * SpecKit Companion - Markdown Renderer
 * Main rendering loop for converting markdown to HTML
 */

import { escapeHtml, parseInline } from './inline';
import {
    preprocessSpecMetadata,
    preprocessUserStories,
    preprocessTaskPhases,
    preprocessRequirements,
    preprocessEntities,
    preprocessChecklist,
    preprocessTechnicalContext,
    preprocessConstitution,
    preprocessDecisions,
    preprocessCallouts,
    preprocessHtmlComments,
    stripFrontmatter,
    stripTaskFormatLegend
} from './preprocessors';
import { parseAcceptanceScenarios } from './scenarios';

// Current task ID from spec-context (for in-progress badge)
let currentTaskId: string | null = null;

// Whether spec-context.json data is available (controls metadata stripping)
let hasSpecContext = false;

// Per-task capture summaries (what each task did + files), keyed by task id.
// Injected from viewerState so the tasks.md document can show captured detail.
let taskSummaries: Record<string, { did?: string; files?: string[] }> = {};

/** Set the per-task capture summaries used to enrich the tasks.md document. */
export function setTaskSummaries(map: Record<string, { did?: string; files?: string[] }> | null): void {
    taskSummaries = map || {};
}

/**
 * Set the current task ID for in-progress badge rendering
 */
export function setCurrentTask(taskId: string | null): void {
    currentTaskId = taskId;
}

/**
 * Set whether spec-context data is available.
 * When true, preprocessSpecMetadata strips the raw metadata block.
 */
export function setHasSpecContext(value: boolean): void {
    hasSpecContext = value;
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/<[^>]+>/g, '')         // strip any inline HTML produced by parseInline
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

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
 * Light syntax coloring for a file tree: directory tokens (ending in `/`) and
 * trailing `# comments` get colored spans so the structure reads at a glance.
 */
function highlightTree(text: string): string {
    const colorDirs = (s: string) =>
        s.replace(/([\w.@-]+\/)/g, '<span class="tree-dir">$1</span>');
    return escapeHtml(text)
        .split('\n')
        .map(line => {
            // Split off a trailing comment first so dir-coloring never reaches into it.
            const m = line.match(/^(.*?)(#[^\n]*)$/);
            return m
                ? `${colorDirs(m[1])}<span class="tree-comment">${m[2]}</span>`
                : colorDirs(line);
        })
        .join('\n');
}

/**
 * Wrap content with line action buttons for hover editing
 * Uses single "+" button for GitHub-style inline review
 */
// Comment icon SVG for line action buttons
const COMMENT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3" color="currentColor"/></svg>`;

function wrapWithLineActions(content: string, lineNum: number): string {
    return `<div class="line" data-line="${lineNum}">
        <button class="line-add-btn" data-line="${lineNum}" title="Add comment">
            ${COMMENT_ICON_SVG}
        </button>
        <div class="line-content">${content}</div>
        <div class="line-comment-slot"></div>
    </div>`;
}

/**
 * Wrap a preprocessed component div as a commentable line — the component sits as
 * a direct child (not inside `.line-content`, to avoid prose style bleed) so the
 * inline "+" comment affordance still appears on hover.
 */
function wrapComponentLine(componentHtml: string, lineNum: number): string {
    return `<div class="line component-line" data-line="${lineNum}"><button class="line-add-btn" data-line="${lineNum}" title="Add comment">${COMMENT_ICON_SVG}</button>${componentHtml}<div class="line-comment-slot"></div></div>`;
}

/**
 * Split a markdown table row into cells, honoring escaped pipes (`\|`) inside a
 * cell so a `"a" \| "b"` value stays one cell instead of fragmenting the row.
 */
function splitTableRow(row: string): string[] {
    const cells = row.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
    if (cells.length && cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells;
}

/** Clamp/pad a row's cells to the header column count so rows can't run ragged. */
function clampCells(cells: string[], n: number): string[] {
    const out = cells.slice(0, n);
    while (out.length < n) out.push('');
    return out;
}

/**
 * Render a table from rows
 */
function renderTable(rows: string[]): string {
    if (rows.length < 2) return '';

    let html = '<table>\n';

    // Header row
    const headerCells = splitTableRow(rows[0]);
    html += '<thead><tr>\n';
    for (const cell of headerCells) {
        html += `<th>${parseInline(cell.trim())}</th>\n`;
    }
    html += '</tr></thead>\n';

    // Body rows (skip separator row)
    if (rows.length > 2) {
        html += '<tbody>\n';
        for (let i = 2; i < rows.length; i++) {
            const cells = clampCells(splitTableRow(rows[i]), headerCells.length);
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
 * Parse and render markdown content to HTML
 */
export function renderMarkdown(markdown: string): string {
    // Normalize line endings (CRLF / lone CR → LF) before anything else. The
    // block-level regexes below are $-anchored and JS '.' does not match '\r',
    // so a CRLF document (Windows / git autocrlf checkout) leaves a trailing
    // '\r' on every line, failing every heading/list/rule match and rendering
    // the whole document as raw paragraphs. See issue #158.
    markdown = markdown.replace(/\r\n?/g, '\n');

    // Strip spec-kit's leading YAML frontmatter so it doesn't leak as an <hr> +
    // paragraph. Runs after newline normalization so it only deals with '\n'.
    markdown = stripFrontmatter(markdown);

    // Strip spec-kit's tasks.md "## Format:" notation legend (author scaffolding).
    markdown = stripTaskFormatLegend(markdown);

    // Preprocess special patterns before main rendering
    markdown = preprocessHtmlComments(markdown);
    markdown = preprocessSpecMetadata(markdown, hasSpecContext);
    markdown = preprocessUserStories(markdown);
    markdown = preprocessTaskPhases(markdown);
    markdown = preprocessRequirements(markdown);
    markdown = preprocessEntities(markdown);
    markdown = preprocessChecklist(markdown);
    markdown = preprocessTechnicalContext(markdown);
    markdown = preprocessConstitution(markdown);
    markdown = preprocessDecisions(markdown);
    markdown = parseAcceptanceScenarios(markdown);
    markdown = preprocessCallouts(markdown);

    let html = '';
    const slugCounts = new Map<string, number>();
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeContent: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';
    let listItemCount = 0;
    let lastClosedListType: 'ul' | 'ol' | null = null;
    let lastClosedListCount = 0;
    let inTable = false;
    let tableRows: string[] = [];
    let inBlockquote = false;
    let blockquoteLines: string[] = [];
    let blockquoteStartLine = 0;

    const flushBlockquote = () => {
        if (!inBlockquote) return;
        const inner = blockquoteLines
            .map(l => parseInline(l) || '&nbsp;')
            .join('<br>\n');
        html += wrapWithLineActions(
            `<blockquote><p>${inner}</p></blockquote>`,
            blockquoteStartLine,
        );
        inBlockquote = false;
        blockquoteLines = [];
        blockquoteStartLine = 0;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track the original line number (1-indexed)
        const sourceLineNum = i + 1;

        // Code blocks (detect indented fences too, e.g. inside list items)
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('```')) {
            // Close any open list before the code block
            if (inList && !inCodeBlock) {
                html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                lastClosedListType = listType;
                lastClosedListCount = listItemCount;
                inList = false;
            }
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = trimmedLine.slice(3).trim();
                codeContent = [];
            } else {
                inCodeBlock = false;
                const codeText = codeContent.join('\n');

                // Handle mermaid diagrams
                if (codeBlockLang === 'mermaid') {
                    const mermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    html += `<div class="mermaid-container"><pre class="mermaid" id="${mermaidId}">${escapeHtml(codeText)}</pre></div>\n`;
                } else if (isTreeStructure(codeText) || codeBlockLang === 'text' || codeBlockLang === 'plaintext' || codeBlockLang === '') {
                    // Tree structure or plain text — light coloring for real trees.
                    const body = isTreeStructure(codeText) ? highlightTree(codeText) : escapeHtml(codeText);
                    html += `<pre class="tree-structure"><code>${body}</code></pre>\n`;
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

        // Blockquote (group consecutive '>' lines into one <blockquote>).
        // Must come before list/empty handling so we accumulate first and
        // flush on the first non-quoted line.
        if (line.startsWith('>')) {
            if (!inBlockquote) {
                if (inList) {
                    html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                    inList = false;
                }
                // A blockquote breaks ordered-list continuation: the next
                // ordered list must restart numbering rather than resume.
                lastClosedListType = null;
                lastClosedListCount = 0;
                inBlockquote = true;
                blockquoteStartLine = sourceLineNum;
            }
            // Trim a single leading "> " (preserve any further leading space).
            blockquoteLines.push(line.replace(/^>\s?/, ''));
            continue;
        } else if (inBlockquote) {
            flushBlockquote();
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
            lastClosedListType = listType;
            lastClosedListCount = listItemCount;
            inList = false;
        }

        // Empty line
        if (!line.trim()) {
            if (inList) {
                html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                lastClosedListType = listType;
                lastClosedListCount = listItemCount;
                inList = false;
            }
            continue;
        }

        // Headings - wrap h3+ with line actions for commenting
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            lastClosedListType = null;
            lastClosedListCount = 0;
            const level = headingMatch[1].length;
            const rawText = headingMatch[2];
            const content = parseInline(rawText);
            let openTag = `<h${level}>`;
            if (level <= 3) {
                const baseSlug = slugify(rawText) || `heading-${sourceLineNum}`;
                const prevCount = slugCounts.get(baseSlug) ?? 0;
                const nextCount = prevCount + 1;
                slugCounts.set(baseSlug, nextCount);
                const id = nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
                openTag = `<h${level} id="${id}">`;
            }
            // Wrap h3, h4, h5, h6 with line actions (subsection headers)
            if (level >= 3) {
                html += wrapWithLineActions(`${openTag}${content}</h${level}>`, sourceLineNum);
            } else {
                html += `${openTag}${content}</h${level}>\n`;
            }
            continue;
        }

        // Horizontal rule
        if (line.match(/^[-*_]{3,}$/)) {
            lastClosedListType = null;
            lastClosedListCount = 0;
            html += '<hr>\n';
            continue;
        }

        // Unordered list
        const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) {
                    html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                    lastClosedListType = listType;
                    lastClosedListCount = listItemCount;
                }
                html += '<ul>\n';
                inList = true;
                listType = 'ul';
                listItemCount = 0;
            }
            const content = parseInline(ulMatch[2]);
            // Check for task list
            const taskMatch = content.match(/^\[([ xX])\]\s*(.+)$/);
            if (taskMatch) {
                const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
                const taskText = taskMatch[2];

                // Extract task ID (T001, T002, …). Specs write it either bolded
                // (`**T001**`) or bare, so accept both.
                const taskIdExtract = taskText.match(/^\s*(?:<strong>\s*)?(T\d+)(?:\s*<\/strong>)?\b/i);
                const taskId = taskIdExtract ? taskIdExtract[1] : null;

                // Build classes — include 'line' so hover/comment affordances activate
                const classes = ['task-item', 'line'];
                if (checked) classes.push('checked');
                if (taskId && taskId === currentTaskId) classes.push('in-progress');

                const classAttr = `class="${classes.join(' ')}"`;
                const dataTaskAttr = taskId ? ` data-task-id="${taskId}"` : '';

                // The id and the `[P]` / `[US#]` markers are metadata, not prose:
                // they render as compact chips ahead of the description instead of
                // sitting in the sentence as raw bracket noise.
                let body = taskId
                    ? taskText.replace(/^\s*(?:<strong>\s*)?T\d+(?:\s*<\/strong>)?\s*/i, '')
                    : taskText;
                const chips: string[] = [];
                if (taskId) chips.push(`<span class="task-item__id">${taskId}</span>`);
                body = body.replace(/^(?:\s*\[(P|US\d+)\])+/gi, (markers) => {
                    for (const [, marker] of markers.matchAll(/\[(P|US\d+)\]/gi)) {
                        const parallel = marker.toUpperCase() === 'P';
                        chips.push(
                            `<span class="task-item__marker${parallel ? ' task-item__marker--parallel' : ''}"` +
                            ` title="${parallel ? 'Runs in parallel with its wave' : `User story ${marker.slice(2)}`}">` +
                            `${marker.toUpperCase()}</span>`,
                        );
                    }
                    return '';
                }).trimStart();
                const innerText = chips.join('') + body;
                const summary = taskId ? taskSummaries[taskId] : undefined;
                let captureHtml = '';
                if (summary && (summary.did || (summary.files && summary.files.length))) {
                    const didHtml = summary.did ? `<span class="task-item__did">${escapeHtml(summary.did)}</span>` : '';
                    const filesHtml = (summary.files && summary.files.length)
                        ? `<span class="task-item__files">${summary.files.map(f => `<code class="task-item__file">${escapeHtml(f)}</code>`).join('')}</span>`
                        : '';
                    captureHtml = `<div class="task-item__capture">${didHtml}${filesHtml}</div>`;
                }
                html += `<li ${classAttr} data-line="${sourceLineNum}"${dataTaskAttr}>` +
                    `<button class="line-add-btn" data-line="${sourceLineNum}" title="Add comment">${COMMENT_ICON_SVG}</button>` +
                    `<input type="checkbox" ${checked} data-line="${sourceLineNum}">` +
                    `<span class="task-text line-content">${innerText}</span>` +
                    captureHtml +
                    `<div class="line-comment-slot"></div>` +
                    `</li>\n`;
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
                if (inList) {
                    html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
                    lastClosedListType = listType;
                    lastClosedListCount = listItemCount;
                }
                // Continue numbering if resuming an interrupted ordered list
                const startAttr = (lastClosedListType === 'ol' && lastClosedListCount > 0)
                    ? ` start="${lastClosedListCount + 1}"`
                    : '';
                html += `<ol${startAttr}>\n`;
                inList = true;
                listType = 'ol';
                listItemCount = lastClosedListType === 'ol' ? lastClosedListCount : 0;
                lastClosedListType = null;
                lastClosedListCount = 0;
            }
            listItemCount++;
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

        // Per-item components keep the inline-comment "+" affordance: wrap them as
        // a commentable line (they replaced list items / headings that had it).
        if (line.includes('<div class="req-row') ||
            line.includes('<div class="entity-row') ||
            line.includes('<div class="con-row') ||
            line.includes('<div class="phase-header') ||
            line.includes('<div class="user-story-header')) {
            html += wrapComponentLine(line, sourceLineNum) + '\n';
            continue;
        }

        // Check if line is preprocessed HTML (callouts, user stories, metadata, scenario tables)
        // Match any line containing our custom class patterns or HTML structure elements
        if (line.includes('<div class="callout') ||
            line.includes('<div class="ck-group') ||
            line.includes('<div class="tech-grid') ||
            line.includes('<div class="decision-card') ||
            line.includes('<div class="decision-field') ||
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
    if (inBlockquote) {
        flushBlockquote();
    }
    if (inList) {
        html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
    }
    if (inTable && tableRows.length > 0) {
        html += renderTable(tableRows);
    }
    if (inCodeBlock && codeContent.length > 0) {
        html += `<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>\n`;
    }

    // Post-process: group task sub-items into .task-details containers
    html = groupTaskDetails(html);

    return html;
}

/**
 * Post-process rendered HTML to wrap consecutive non-task list items
 * after a task-item into a .task-details container for visual grouping.
 */
function groupTaskDetails(html: string): string {
    // Find task lists and group sub-items under each task
    return html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, content) => {
        if (!content.includes('class="task-item')) return match;
        const tag = match.match(/<ul[^>]*>/)?.[0] || '<ul>';
        return `${tag}${groupTaskItemDetails(content)}</ul>`;
    });
}

function groupTaskItemDetails(content: string): string {
    const items = content.split(/(?=<li\s)/);
    let result = '';
    let detailsBuffer = '';

    for (const item of items) {
        if (!item.trim()) continue;

        if (item.includes('class="task-item')) {
            if (detailsBuffer) {
                result += `<div class="task-details">${detailsBuffer}</div>\n`;
                detailsBuffer = '';
            }
            result += item;
        } else if (item.includes('class="line"')) {
            detailsBuffer += item;
        } else {
            if (detailsBuffer) {
                result += `<div class="task-details">${detailsBuffer}</div>\n`;
                detailsBuffer = '';
            }
            result += item;
        }
    }

    if (detailsBuffer) {
        result += `<div class="task-details">${detailsBuffer}</div>\n`;
    }

    return result;
}
