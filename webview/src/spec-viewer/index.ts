/**
 * SpecKit Companion - Spec Viewer Webview
 * v0.3.0 - Enhanced with Phase Stepper, Footer Actions, and Refine Modal
 */

import type {
    VSCodeApi,
    ViewerToExtensionMessage,
    ExtensionToViewerMessage,
    ViewerWebviewState,
    NavState,
    LineType,
    Refinement
} from './types';

// Get VS Code API
declare const vscode: VSCodeApi;
declare const hljs: {
    highlightElement: (element: Element) => void;
    highlightAll: () => void;
};
declare const mermaid: {
    initialize: (config: {
        startOnLoad: boolean;
        theme: string;
        themeVariables?: Record<string, string>;
    }) => void;
    run: (config: { querySelector: string }) => void;
};

// ============================================
// State
// ============================================

let currentRefineLineNum: number | null = null;
let currentRefineContent: string = '';

// Refinement state for GitHub-style review
let pendingRefinements: Refinement[] = [];
let activeInlineEditor: HTMLElement | null = null;

// ============================================
// DOM Elements
// ============================================

function getElements() {
    return {
        contentArea: document.getElementById('content-area') as HTMLElement,
        markdownContent: document.getElementById('markdown-content') as HTMLElement | null,
        editButton: document.getElementById('edit-button') as HTMLButtonElement,
        loadingOverlay: document.getElementById('loading-overlay') as HTMLElement,
        // Unified step-tabs
        stepTabs: document.querySelectorAll('.step-tab') as NodeListOf<HTMLButtonElement>,
        relatedTabs: document.querySelectorAll('.related-tab') as NodeListOf<HTMLButtonElement>,
        backLink: document.querySelector('.back-link') as HTMLButtonElement | null,
        // Footer buttons
        enhanceButton: document.getElementById('enhance') as HTMLButtonElement | null,
        editSourceButton: document.getElementById('editSource') as HTMLButtonElement | null,
        regenerateButton: document.getElementById('regenerate') as HTMLButtonElement | null,
        approveButton: document.getElementById('approve') as HTMLButtonElement | null,
        // Refine modal
        refineBackdrop: document.getElementById('refine-backdrop') as HTMLElement,
        refinePopover: document.getElementById('refine-popover') as HTMLElement,
        refineOriginalText: document.getElementById('refine-original-text') as HTMLElement,
        refineInput: document.getElementById('refine-input') as HTMLInputElement,
        refineCancel: document.getElementById('refine-cancel') as HTMLButtonElement,
        refineSubmit: document.getElementById('refine-submit') as HTMLButtonElement
    };
}

// ============================================
// Markdown Rendering
// ============================================

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
 * Decode base64 with proper UTF-8 handling
 */
function decodeBase64Utf8(base64: string): string {
    try {
        const binaryString = atob(base64);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        // Fallback: content might not be base64 encoded
        return base64;
    }
}

/**
 * Preprocess spec metadata (Feature Branch, Created, Status, Input) into a compact header
 */
function preprocessSpecMetadata(markdown: string): string {
    // Pattern to match metadata lines at the start (after h1)
    // Matches lines like: **Feature Branch**: `value` or **Created:** value
    const metadataPattern = /^(# .+\n+)((?:\*\*[^*]+\*\*:?\s*.+\n*)+)/m;

    const match = markdown.match(metadataPattern);
    if (!match) return markdown;

    const title = match[1];
    const metadataBlock = match[2];

    // Parse individual metadata items - captures **Label** or **Label:** then the value
    const items: { label: string; value: string }[] = [];
    const itemPattern = /\*\*([^*]+)\*\*:?\s*(.+?)(?=\n\*\*|\n\n|$)/g;
    let itemMatch;

    while ((itemMatch = itemPattern.exec(metadataBlock)) !== null) {
        let label = itemMatch[1].trim();
        let value = itemMatch[2].trim();

        // Remove trailing colon from label if present (handles **Label:** format)
        label = label.replace(/:$/, '');

        // Clean up value - remove backticks for inline display
        value = value.replace(/`([^`]+)`/g, '$1');

        // Only include recognized metadata fields
        const recognizedFields = ['Feature Branch', 'Created', 'Status', 'Input', 'Version', 'Author', 'Last Updated'];
        if (!recognizedFields.includes(label)) continue;

        items.push({ label, value });
    }

    if (items.length === 0) return markdown;

    // Build compact metadata HTML
    const metadataHtml = items.map(item => {
        // Special styling for certain fields
        if (item.label === 'Status') {
            const statusClass = item.value.toLowerCase().replace(/\s+/g, '-');
            return `<span class="meta-item"><span class="meta-status meta-status-${statusClass}">${item.value}</span></span>`;
        }
        if (item.label === 'Feature Branch') {
            return `<span class="meta-item"><span class="meta-branch">${item.value}</span></span>`;
        }
        if (item.label === 'Created' || item.label === 'Last Updated') {
            return `<span class="meta-item"><span class="meta-label">${item.label}:</span> <span class="meta-date">${item.value}</span></span>`;
        }
        if (item.label === 'Input') {
            // Input is longer, show on its own line
            return `</div><div class="spec-input"><span class="meta-label">Input:</span> ${item.value}</div><div class="spec-meta">`;
        }
        return `<span class="meta-item"><span class="meta-label">${item.label}:</span> ${item.value}</span>`;
    }).join('');

    const replacement = `${title}<div class="spec-meta">${metadataHtml}</div>\n\n`;

    return markdown.replace(metadataPattern, replacement);
}

/**
 * Get human-readable priority label from priority code
 */
function getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
        'P1': 'Critical',
        'P2': 'High',
        'P3': 'Medium',
        'P4': 'Low',
        'P5': 'Trivial'
    };
    return labels[priority.toUpperCase()] || priority;
}

/**
 * Preprocess user story headings into styled cards with metadata line
 */
function preprocessUserStories(markdown: string): string {
    // Pattern: ### User Story N - Title (Priority: PN)
    const storyPattern = /^(###)\s*User Story\s*(\d+)\s*[-–]\s*([^(]+)\s*\(Priority:\s*(P\d)\)/gm;

    return markdown.replace(storyPattern, (_, _hashes, num, title, priority) => {
        const priorityClass = priority.toLowerCase();
        const priorityLabel = getPriorityLabel(priority);

        // Compact single-line HTML to avoid markdown parser splitting issues
        const ticketIcon = `<svg class="meta-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v1.384c.63.313 1.033.95 1.033 1.616 0 .666-.403 1.303-1.033 1.616V10.5A1.5 1.5 0 0 0 1.5 12h13a1.5 1.5 0 0 0 1.5-1.5V9.116c-.63-.313-1.033-.95-1.033-1.616 0-.666.403-1.303 1.033-1.616V4.5A1.5 1.5 0 0 0 14.5 3h-13z"/></svg>`;

        return `<div class="user-story-header"><div class="user-story-meta">${ticketIcon}<span class="story-id">US-${num}</span><span class="meta-separator">·</span><span class="story-priority priority-${priorityClass}"><span class="priority-dot ${priorityClass}"></span>${priorityLabel}</span></div><h3 class="user-story-title">${title.trim()}</h3></div>`;
    });
}

// Counter for unique table IDs
let scenarioTableCounter = 0;

/**
 * Parse acceptance scenarios into a structured table format
 * Looks for "**Acceptance Scenarios**:" followed by numbered list with GIVEN/WHEN/THEN
 */
function parseAcceptanceScenarios(markdown: string): string {
    // Reset counter for each parse
    scenarioTableCounter = 0;

    // Pattern to match acceptance scenarios section followed by numbered list
    // Matches: **Acceptance Scenarios**: or **Acceptance Scenarios:**
    // Uses lookahead to capture until next section (heading, bold section, or double newline not followed by number)
    const sectionPattern = /(\*\*Acceptance Scenarios\*\*:?\s*\n)((?:\d+\.\s+[\s\S]+?)(?=\n\n(?!\s*\d+\.)|$|\n#|\n\*\*))/gi;

    return markdown.replace(sectionPattern, (_match, header, listContent) => {
        // Generate unique table ID
        const tableId = `scenario-table-${++scenarioTableCounter}`;
        // Pre-process: join lines that don't start with a number (wrapped scenarios)
        const rawLines = listContent.trim().split('\n');
        const joinedLines: string[] = [];

        for (const line of rawLines) {
            if (/^\d+\.\s+/.test(line)) {
                // New numbered item
                joinedLines.push(line);
            } else if (joinedLines.length > 0 && line.trim()) {
                // Continuation of previous item - append to last line
                joinedLines[joinedLines.length - 1] += ' ' + line.trim();
            }
        }

        const scenarios: Array<{ given: string; when: string; then: string }> = [];

        for (const line of joinedLines) {
            // Remove numbering (1. 2. etc.)
            const content = line.replace(/^\d+\.\s*/, '').trim();
            if (!content) continue;

            // Extract GIVEN/WHEN/THEN parts
            // Handles: **Given** X, **When** Y, **Then** Z
            // Also handles: Given X, When Y, Then Z (without bold)
            const givenMatch = content.match(/\*?\*?Given\*?\*?\s*([^,]+(?:,(?!\s*\*?\*?When)[^,]*)*)/i);
            const whenMatch = content.match(/\*?\*?When\*?\*?\s*([^,]+(?:,(?!\s*\*?\*?Then)[^,]*)*)/i);
            const thenMatch = content.match(/\*?\*?Then\*?\*?\s*(.+?)(?:\.|$)/i);

            if (givenMatch || whenMatch || thenMatch) {
                scenarios.push({
                    given: givenMatch ? givenMatch[1].trim().replace(/,\s*$/, '') : '',
                    when: whenMatch ? whenMatch[1].trim().replace(/,\s*$/, '') : '',
                    then: thenMatch ? thenMatch[1].trim().replace(/\.$/, '') : ''
                });
            } else {
                // Fallback: if pattern doesn't match, put whole content in "then"
                scenarios.push({
                    given: '',
                    when: '',
                    then: content
                });
            }
        }

        // If no valid scenarios parsed, return original
        if (scenarios.length === 0) {
            return header + listContent;
        }

        // Build table HTML - compact single-line to avoid markdown parser splitting
        // Row number column on left with hover-reveal "+" button
        // Each row includes data-table-id for scoped selection
        const tableRows = scenarios.map((s, idx) =>
            `<tr class="scenario-row" data-row="${idx + 1}" data-table-id="${tableId}"><td class="col-num"><span class="row-num">${idx + 1}</span><button class="row-add-btn" data-row="${idx + 1}" data-table-id="${tableId}" title="Add comment">+</button></td><td class="col-given">${escapeHtmlInScenario(s.given) || '<span class="scenario-empty">—</span>'}</td><td class="col-when">${escapeHtmlInScenario(s.when) || '<span class="scenario-empty">—</span>'}</td><td class="col-then">${escapeHtmlInScenario(s.then) || '<span class="scenario-empty">—</span>'}</td></tr>`
        ).join('');

        // Output as HTML (not markdown) so label doesn't get wrapped in .line
        return `<p class="scenario-label"><strong>Acceptance Scenarios:</strong></p>
<table class="scenario-table" id="${tableId}"><thead><tr><th class="col-num">#</th><th class="col-given">Given</th><th class="col-when">When</th><th class="col-then">Then</th></tr></thead><tbody>${tableRows}</tbody></table>

`;
    });
}

/**
 * Simple HTML escape for scenario content (doesn't escape markdown bold)
 */
function escapeHtmlInScenario(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Preprocess acceptance scenario keywords (Given/When/Then) - legacy no-op
 * Note: Scenario formatting is now handled by parseAcceptanceScenarios()
 */
function preprocessAcceptanceScenarios(markdown: string): string {
    // No-op - scenario keywords are now processed in parseAcceptanceScenarios()
    return markdown;
}

/**
 * Preprocess markdown to convert special patterns into callout blocks
 */
function preprocessCallouts(markdown: string): string {
    // Define callout patterns - each captures the keyword and content
    // Patterns handle:
    // - **Keyword:** and **Keyword**: formats (colon inside or outside bold)
    // - Optional emoji prefix (e.g., ⚠️ **CRITICAL**:)
    // - Optional leading whitespace
    const patterns = [
        { regex: /(?:^|\n)\s*(?:[\u{1F300}-\u{1F9FF}]\s*)?\*\*Purpose:?\*\*:?\s*([^\n]+(?:\n(?!\n|\*\*|#|-).*)*)/giu, type: 'purpose', label: 'Purpose' },
        { regex: /(?:^|\n)\s*(?:[\u{1F300}-\u{1F9FF}]\s*)?\*\*CRITICAL:?\*\*:?\s*([^\n]+(?:\n(?!\n|\*\*|#|-).*)*)/giu, type: 'critical', label: 'Critical' },
        { regex: /(?:^|\n)\s*(?:[\u{1F300}-\u{1F9FF}]\s*)?\*\*Checkpoint:?\*\*:?\s*([^\n]+(?:\n(?!\n|\*\*|#|-).*)*)/giu, type: 'checkpoint', label: 'Checkpoint' },
        { regex: /(?:^|\n)\s*(?:[\u{1F300}-\u{1F9FF}]\s*)?\*\*Note:?\*\*:?\s*([^\n]+(?:\n(?!\n|\*\*|#|-).*)*)/giu, type: 'note', label: 'Note' },
        { regex: /(?:^|\n)\s*(?:[\u{1F300}-\u{1F9FF}]\s*)?\*\*Warning:?\*\*:?\s*([^\n]+(?:\n(?!\n|\*\*|#|-).*)*)/giu, type: 'warning', label: 'Warning' },
        { regex: /(?:^|\n)\s*(?:[\u{1F300}-\u{1F9FF}]\s*)?\*\*Important:?\*\*:?\s*([^\n]+(?:\n(?!\n|\*\*|#|-).*)*)/giu, type: 'important', label: 'Important' },
    ];

    // Also handle GitHub-style admonitions > [!NOTE], > [!WARNING], etc.
    const admonitionPatterns = [
        { regex: /^>\s*\[!NOTE\]\s*\n((?:>.*\n?)*)/gim, type: 'note', label: 'Note' },
        { regex: /^>\s*\[!WARNING\]\s*\n((?:>.*\n?)*)/gim, type: 'warning', label: 'Warning' },
        { regex: /^>\s*\[!IMPORTANT\]\s*\n((?:>.*\n?)*)/gim, type: 'important', label: 'Important' },
        { regex: /^>\s*\[!TIP\]\s*\n((?:>.*\n?)*)/gim, type: 'tip', label: 'Tip' },
        { regex: /^>\s*\[!CAUTION\]\s*\n((?:>.*\n?)*)/gim, type: 'critical', label: 'Caution' },
    ];

    // Process standard callout patterns
    for (const { regex, type, label } of patterns) {
        markdown = markdown.replace(regex, (_, content) => {
            const trimmedContent = content.trim();
            return `\n<div class="callout callout-${type}"><span class="callout-icon"></span><div class="callout-content"><strong class="callout-label">${label}:</strong> ${trimmedContent}</div></div>\n`;
        });
    }

    // Process GitHub-style admonitions
    for (const { regex, type, label } of admonitionPatterns) {
        markdown = markdown.replace(regex, (_, content) => {
            // Remove the > prefix from each line
            const cleanContent = content
                .split('\n')
                .map((line: string) => line.replace(/^>\s?/, ''))
                .join(' ')
                .trim();
            return `\n<div class="callout callout-${type}"><span class="callout-icon"></span><div class="callout-content"><strong class="callout-label">${label}:</strong> ${cleanContent}</div></div>\n`;
        });
    }

    return markdown;
}

// Line number counter for tracking editable content
let currentLineNum = 0;

/**
 * Wrap content with line action buttons for hover editing
 * Now uses single "+" button for GitHub-style inline review
 */
function wrapWithLineActions(content: string, lineNum: number, _isRefinable: boolean = true): string {
    return `<div class="line" data-line="${lineNum}">
        <button class="line-add-btn" data-line="${lineNum}" title="Add comment">+</button>
        <div class="line-content">${content}</div>
        <div class="line-comment-slot"></div>
    </div>`;
}

/**
 * Parse and render markdown content to HTML
 */
function renderMarkdown(markdown: string): string {
    // Preprocess special patterns before main rendering
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
                html += `<li>${content}</li>\n`;
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
            html += `<li>${content}</li>\n`;
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

    // Post-process: Add progress header to task lists
    html = addTaskProgressHeaders(html);

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
 * Parse inline markdown elements
 */
function parseInline(text: string): string {
    if (!text) return '';

    let result = text
        // Escape HTML first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold + Italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Images
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Post-process: Style acceptance scenario keywords (Given/When/Then)
    result = result
        .replace(/<strong>Given<\/strong>/g, '<span class="scenario-keyword scenario-given">Given</span>')
        .replace(/<strong>When<\/strong>/g, '<span class="scenario-keyword scenario-when">When</span>')
        .replace(/<strong>Then<\/strong>/g, '<span class="scenario-keyword scenario-then">Then</span>');

    return result;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// Content Updates
// ============================================

/**
 * Update the content area with rendered markdown
 */
function updateContent(content: string): void {
    const { contentArea } = getElements();

    // Decode base64 content with proper UTF-8 handling
    const decoded = decodeBase64Utf8(content);

    // Render markdown
    const html = renderMarkdown(decoded);
    contentArea.innerHTML = `<div id="markdown-content">${html}</div>`;

    // Apply syntax highlighting and mermaid diagrams after DOM update
    requestAnimationFrame(() => {
        applyHighlighting();
        initializeMermaid();
    });
}

/**
 * Apply syntax highlighting to code blocks
 * Includes retry mechanism if hljs is not yet loaded
 */
function applyHighlighting(retryCount: number = 0): void {
    const maxRetries = 15;
    const retryDelay = 150;

    // Retry mechanism if hljs not yet loaded
    if (typeof hljs === 'undefined') {
        if (retryCount < maxRetries) {
            setTimeout(() => applyHighlighting(retryCount + 1), retryDelay);
        } else {
            console.warn('[SpecViewer] highlight.js not loaded after max retries');
        }
        return;
    }

    // Find all code blocks that need highlighting (skip already highlighted ones)
    const codeBlocks = document.querySelectorAll('pre.code-block code[class*="language-"]');

    if (codeBlocks.length === 0) {
        return;
    }

    codeBlocks.forEach((block) => {
        try {
            const el = block as HTMLElement;

            // Remove previous hljs classes to allow re-highlighting
            el.classList.forEach(cls => {
                if (cls.startsWith('hljs-') || cls === 'hljs') {
                    el.classList.remove(cls);
                }
            });

            // Apply highlighting
            hljs.highlightElement(el);

            // Ensure hljs class is present for CSS
            if (!el.classList.contains('hljs')) {
                el.classList.add('hljs');
            }
        } catch (e) {
            console.warn('[SpecViewer] Failed to highlight block:', e);
        }
    });
}

/**
 * Initialize mermaid diagrams
 */
function initializeMermaid(): void {
    if (typeof mermaid === 'undefined') {
        console.warn('[SpecViewer] mermaid not loaded');
        return;
    }

    const mermaidBlocks = document.querySelectorAll('.mermaid');
    if (mermaidBlocks.length === 0) {
        return;
    }

    try {
        // Detect theme based on body class
        const isDark = document.body.classList.contains('vscode-dark') ||
                       document.body.classList.contains('vscode-high-contrast');

        // Get computed CSS variables for theme-aware colors
        const computedStyle = getComputedStyle(document.documentElement);
        const accent = computedStyle.getPropertyValue('--accent').trim() || '#007fd4';
        const bgPrimary = computedStyle.getPropertyValue('--bg-primary').trim() || (isDark ? '#1e1e1e' : '#ffffff');
        const bgSecondary = computedStyle.getPropertyValue('--bg-secondary').trim() || (isDark ? '#252526' : '#f3f3f3');
        const textPrimary = computedStyle.getPropertyValue('--text-primary').trim() || (isDark ? '#d4d4d4' : '#333333');
        const headerSection = computedStyle.getPropertyValue('--header-section').trim() || '#ee9d28';

        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                // Background colors
                primaryColor: bgSecondary,
                primaryBorderColor: accent,
                primaryTextColor: textPrimary,

                // Secondary colors
                secondaryColor: bgPrimary,
                secondaryBorderColor: accent,
                secondaryTextColor: textPrimary,

                // Tertiary colors
                tertiaryColor: bgSecondary,
                tertiaryBorderColor: accent,
                tertiaryTextColor: textPrimary,

                // Lines and labels
                lineColor: accent,
                textColor: textPrimary,

                // State diagram specific
                labelBackground: bgSecondary,
                labelTextColor: headerSection,

                // Node styling
                nodeBorder: accent,
                nodeTextColor: textPrimary,

                // Edge labels
                edgeLabelBackground: bgSecondary,

                // Fonts
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '14px'
            }
        });

        mermaid.run({ querySelector: '.mermaid' });
    } catch (e) {
        console.warn('[SpecViewer] Failed to initialize mermaid:', e);
    }
}

// ============================================
// Navigation State Updates (for message-based content switching)
// ============================================

/**
 * Update navigation state without full page reload
 * Called when content is updated via message to reflect new active tab/phase
 */
function updateNavState(navState: NavState): void {
    const { currentDoc, workflowPhase, taskCompletionPercent, isViewingRelatedDoc, relatedDocs, coreDocs } = navState;

    // Determine the parent phase for related docs
    // Related docs are associated with 'plan' phase (research, data-model, etc.)
    const parentPhaseForRelated = 'plan';

    // Update step-tabs: active/viewing/reviewing states
    document.querySelectorAll('.step-tab').forEach(tab => {
        const tabEl = tab as HTMLElement;
        const phase = tabEl.dataset.phase;
        if (!phase) return;

        // Check if this phase's document exists
        const docExists = coreDocs?.find(d => d.type === phase)?.exists ?? tabEl.classList.contains('exists');
        // When viewing a related doc, highlight the parent phase (plan)
        const isViewing = phase === currentDoc || (isViewingRelatedDoc && phase === parentPhaseForRelated);
        const inProgress = phase === 'tasks' && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        // Review mode: viewing a completed step that isn't the current workflow phase
        // Don't apply review styling when viewing related docs - just show normal viewing state
        const isReviewing = isViewing && docExists && phase !== workflowPhase && !isViewingRelatedDoc;

        // Tasks-active: viewing tasks with progress (special prominent state)
        const isTasksActive = phase === 'tasks' && isViewing && inProgress;

        // Reset classes
        tabEl.classList.remove('viewing', 'reviewing', 'tasks-active', 'workflow', 'in-progress');

        // Apply appropriate viewing class
        if (isReviewing) {
            tabEl.classList.add('reviewing');
        } else if (isViewing) {
            tabEl.classList.add('viewing');
        }

        // Apply tasks-active for prominent progress badge
        if (isTasksActive) {
            tabEl.classList.add('tasks-active');
        }

        // Mark workflow phase (when not viewing)
        if (phase === workflowPhase && !isViewing) {
            tabEl.classList.add('workflow');
        }

        // Update Tasks tab progress indicator
        if (phase === 'tasks') {
            const statusEl = tabEl.querySelector('.step-status');
            if (statusEl && inProgress) {
                statusEl.textContent = `${taskCompletionPercent}%`;
                if (!isTasksActive) {
                    tabEl.classList.add('in-progress');
                }
            }
        }
    });

    // Update completion badge visibility
    const existingBadge = document.querySelector('.completion-badge');
    if (taskCompletionPercent === 100 && !existingBadge) {
        // Add completion badge if not present (insert before step-tabs)
        const navPrimary = document.querySelector('.nav-primary');
        const stepTabs = document.querySelector('.step-tabs');
        if (navPrimary && stepTabs) {
            const badge = document.createElement('span');
            badge.className = 'completion-badge';
            badge.textContent = 'PROJECT COMPLETE';
            navPrimary.insertBefore(badge, stepTabs);
        }
    } else if (taskCompletionPercent < 100 && existingBadge) {
        // Remove badge if tasks not complete
        existingBadge.remove();
    }

    // Update related tabs visibility and active state
    const relatedBar = document.querySelector('.related-bar') as HTMLElement | null;
    if (relatedBar) {
        // Show related bar only when viewing plan/tasks or their related docs
        // Hide when viewing spec since related docs typically belong to plan phase
        const showRelatedBar = relatedDocs.length > 0 && currentDoc !== 'spec';
        relatedBar.style.display = showRelatedBar ? 'flex' : 'none';

        // Update related tab active states
        relatedBar.querySelectorAll('.related-tab').forEach(tab => {
            const tabEl = tab as HTMLElement;
            const docType = tabEl.dataset.doc;
            tabEl.classList.toggle('active', docType === currentDoc);
        });

        // Update Overview tab state
        const overviewTab = relatedBar.querySelector('.overview-tab') as HTMLElement | null;
        if (overviewTab) {
            const isCoreDoc = ['spec', 'plan', 'tasks'].includes(currentDoc);
            const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;
            overviewTab.classList.toggle('active', isOverviewActive);

            // Update the overview tab's data-doc to point to the current parent phase
            const parentPhase = isViewingRelatedDoc ? 'plan' : currentDoc;
            if (['spec', 'plan', 'tasks'].includes(parentPhase)) {
                overviewTab.dataset.doc = parentPhase;
            }
        }
    }
}

// ============================================
// Step-Tab Navigation (Unified Stepper + Tabs)
// ============================================

function setupTabNavigation(): void {
    const { stepTabs, relatedTabs, backLink } = getElements();

    // Unified step-tabs (Spec, Plan, Tasks, Done)
    stepTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;

            const phase = btn.dataset.phase as 'spec' | 'plan' | 'tasks' | 'done';
            if (phase && phase !== 'done') {
                vscode.postMessage({
                    type: 'stepperClick',
                    phase
                });
            }
        });
    });

    // Related document tabs
    relatedTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const docType = btn.dataset.doc;
            if (docType) {
                vscode.postMessage({
                    type: 'switchDocument',
                    documentType: docType
                });
            }
        });
    });

    // Overview tab (navigates to main document - spec.md, plan.md, or tasks.md)
    const overviewTab = document.querySelector('.overview-tab') as HTMLButtonElement | null;
    if (overviewTab) {
        overviewTab.addEventListener('click', () => {
            const docType = overviewTab.dataset.doc;
            if (docType) {
                vscode.postMessage({
                    type: 'switchDocument',
                    documentType: docType
                });
            }
        });
    }

    // Back link (← Plan)
    if (backLink) {
        backLink.addEventListener('click', () => {
            const docType = backLink.dataset.doc;
            if (docType) {
                vscode.postMessage({
                    type: 'switchDocument',
                    documentType: docType
                });
            }
        });
    }
}

// ============================================
// Stepper Navigation (Legacy - kept for compatibility)
// ============================================

function setupStepperNavigation(): void {
    // Now handled by setupTabNavigation with unified step-tabs
}

// ============================================
// Edit Button
// ============================================

function setupEditButton(): void {
    const { editButton } = getElements();

    editButton?.addEventListener('click', () => {
        if (!editButton.disabled) {
            vscode.postMessage({ type: 'editDocument' });
        }
    });
}

// ============================================
// Footer Actions
// ============================================

function setupFooterActions(): void {
    const { enhanceButton, editSourceButton, regenerateButton, approveButton } = getElements();

    enhanceButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'clarify' });
    });

    editSourceButton?.addEventListener('click', () => {
        if (!editSourceButton.disabled) {
            vscode.postMessage({ type: 'editSource' });
        }
    });

    regenerateButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'regenerate' });
    });

    approveButton?.addEventListener('click', () => {
        vscode.postMessage({ type: 'approve' });
    });
}

// ============================================
// Refine Modal
// ============================================

function setupRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput, refineCancel, refineSubmit } = getElements();

    if (!refineBackdrop || !refinePopover) return;

    // Cancel button
    refineCancel?.addEventListener('click', () => {
        hideRefineModal();
    });

    // Backdrop click to close
    refineBackdrop?.addEventListener('click', () => {
        hideRefineModal();
    });

    // Submit button
    refineSubmit?.addEventListener('click', () => {
        submitRefine();
    });

    // Enter key to submit
    refineInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitRefine();
        }
        if (e.key === 'Escape') {
            hideRefineModal();
        }
    });
}

function showRefineModal(lineNum: number, content: string): void {
    const { refineBackdrop, refinePopover, refineOriginalText, refineInput } = getElements();

    currentRefineLineNum = lineNum;
    currentRefineContent = content;

    if (refineOriginalText) {
        refineOriginalText.textContent = content;
    }
    if (refineInput) {
        refineInput.value = '';
    }

    refineBackdrop.style.display = 'block';
    refinePopover.style.display = 'block';

    // Focus input after animation
    setTimeout(() => {
        refineInput?.focus();
    }, 100);
}

function hideRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput } = getElements();

    refineBackdrop.style.display = 'none';
    refinePopover.style.display = 'none';

    if (refineInput) {
        refineInput.value = '';
    }

    currentRefineLineNum = null;
    currentRefineContent = '';
}

function submitRefine(): void {
    const { refineInput } = getElements();

    if (currentRefineLineNum === null || !refineInput?.value.trim()) {
        hideRefineModal();
        return;
    }

    vscode.postMessage({
        type: 'refineLine',
        lineNum: currentRefineLineNum,
        content: currentRefineContent,
        instruction: refineInput.value.trim()
    });

    hideRefineModal();
}

// ============================================
// Line Type Detection (for context-aware actions)
// ============================================

/**
 * Detect the type of a line element for context-aware actions
 */
function detectLineType(element: HTMLElement): LineType {
    // Check if inside a user story header
    if (element.closest('.user-story-header')) return 'user-story';

    // Check if this is a task item
    if (element.closest('li.task-item')) return 'task';

    // Check if this is a heading (section)
    const lineContent = element.querySelector('.line-content');
    if (lineContent) {
        const firstChild = lineContent.firstElementChild;
        if (firstChild && (firstChild.tagName === 'H2' || firstChild.tagName === 'H3')) {
            return 'section';
        }
    }

    // Check if inside acceptance scenarios (numbered list with Given/When/Then)
    const parentList = element.closest('ol');
    if (parentList) {
        const listText = parentList.textContent || '';
        if (listText.includes('Given') || listText.includes('When') || listText.includes('Then')) {
            return 'acceptance';
        }
    }

    return 'paragraph';
}

/**
 * Get context-aware quick action buttons based on line type
 * Uses ghost-style buttons with muted text (no emojis, minimal styling)
 */
function getContextActions(lineType: LineType, lineNum: number): string {
    const actions: Record<LineType, string> = {
        'user-story': `<button class="context-action" data-action="remove-story" data-line="${lineNum}">Remove</button>`,
        'acceptance': `<button class="context-action" data-action="remove-scenario" data-line="${lineNum}">Remove</button>`,
        'task': `<button class="context-action" data-action="toggle-task" data-line="${lineNum}">Toggle</button><button class="context-action" data-action="remove-task" data-line="${lineNum}">Remove</button>`,
        'section': `<button class="context-action" data-action="remove-section" data-line="${lineNum}">Remove</button>`,
        'paragraph': `<button class="context-action" data-action="remove-line" data-line="${lineNum}">Remove</button>`
    };
    return actions[lineType];
}

// ============================================
// Inline Editor (GitHub-style)
// ============================================

/**
 * Show inline editor below a line
 */
function showInlineEditor(lineElement: HTMLElement): void {
    // Close any existing editor first
    closeInlineEditor();

    const lineNum = parseInt(lineElement.dataset.line || '0', 10);
    if (!lineNum) return;

    const lineType = detectLineType(lineElement);

    const editor = document.createElement('div');
    editor.className = 'inline-editor';
    editor.innerHTML = `
        <div class="editor-actions">
            ${getContextActions(lineType, lineNum)}
        </div>
        <div class="editor-divider"></div>
        <div class="editor-comment-section">
            <textarea class="editor-textarea" placeholder="Add a comment or refinement instruction..."></textarea>
            <div class="editor-buttons">
                <button class="editor-cancel">Cancel</button>
                <button class="editor-add">Add Comment</button>
            </div>
        </div>
    `;

    // Insert editor into the comment slot
    const commentSlot = lineElement.querySelector('.line-comment-slot');
    if (commentSlot) {
        commentSlot.appendChild(editor);
    }

    activeInlineEditor = editor;
    lineElement.classList.add('editing');

    // Setup event listeners
    const textarea = editor.querySelector('.editor-textarea') as HTMLTextAreaElement;
    const cancelBtn = editor.querySelector('.editor-cancel') as HTMLButtonElement;
    const addBtn = editor.querySelector('.editor-add') as HTMLButtonElement;

    // Focus textarea
    setTimeout(() => textarea?.focus(), 50);

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
        closeInlineEditor();
    });

    // Add comment button
    addBtn?.addEventListener('click', () => {
        const comment = textarea?.value.trim();
        if (comment) {
            addRefinement(lineNum, comment, lineElement);
        }
        closeInlineEditor();
    });

    // Keyboard shortcuts
    textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInlineEditor();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const comment = textarea.value.trim();
            if (comment) {
                addRefinement(lineNum, comment, lineElement);
            }
            closeInlineEditor();
        }
    });

    // Context action buttons
    const contextButtons = editor.querySelectorAll('.context-action');
    contextButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = (e.target as HTMLElement).dataset.action;
            handleContextAction(action || '', lineNum);
        });
    });
}

/**
 * Close the inline editor
 */
function closeInlineEditor(): void {
    if (activeInlineEditor) {
        const lineEl = activeInlineEditor.closest('.line');
        const rowEl = activeInlineEditor.closest('.scenario-row');
        lineEl?.classList.remove('editing');
        rowEl?.classList.remove('editing');
        activeInlineEditor.remove();
        activeInlineEditor = null;
    }
}

/**
 * Show inline editor for a scenario table row
 */
function showInlineEditorForRow(rowElement: HTMLElement, rowNum: number): void {
    // Close any existing editor first
    closeInlineEditor();

    // Get the scenario content from table cells
    const given = rowElement.querySelector('.col-given')?.textContent?.trim() || '';
    const when = rowElement.querySelector('.col-when')?.textContent?.trim() || '';
    const then = rowElement.querySelector('.col-then')?.textContent?.trim() || '';
    const scenarioContent = `Given ${given}, When ${when}, Then ${then}`;

    const editor = document.createElement('tr');
    editor.className = 'inline-editor-row';
    editor.innerHTML = `
        <td colspan="4" class="editor-cell">
            <div class="inline-editor">
                <div class="editor-context">
                    <span class="editor-context-label">Scenario ${rowNum}:</span>
                    <span class="editor-context-text">${escapeHtml(scenarioContent)}</span>
                </div>
                <div class="editor-divider"></div>
                <div class="editor-comment-section">
                    <textarea class="editor-textarea" placeholder="Add a comment or refinement instruction..."></textarea>
                    <div class="editor-buttons">
                        <button class="editor-cancel">Cancel</button>
                        <button class="editor-add">Add Comment</button>
                    </div>
                </div>
            </div>
        </td>
    `;

    // Insert editor row after the scenario row
    rowElement.after(editor);

    activeInlineEditor = editor.querySelector('.inline-editor') as HTMLElement;
    rowElement.classList.add('editing');

    // Setup event listeners
    const textarea = editor.querySelector('.editor-textarea') as HTMLTextAreaElement;
    const cancelBtn = editor.querySelector('.editor-cancel') as HTMLButtonElement;
    const addBtn = editor.querySelector('.editor-add') as HTMLButtonElement;

    // Focus textarea
    setTimeout(() => textarea?.focus(), 50);

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
        closeInlineEditor();
        editor.remove();
    });

    // Add comment button
    addBtn?.addEventListener('click', () => {
        const comment = textarea?.value.trim();
        if (comment) {
            addRefinementForRow(rowNum, comment, scenarioContent, rowElement);
        }
        closeInlineEditor();
        editor.remove();
    });

    // Keyboard shortcuts
    textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInlineEditor();
            editor.remove();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const comment = textarea.value.trim();
            if (comment) {
                addRefinementForRow(rowNum, comment, scenarioContent, rowElement);
            }
            closeInlineEditor();
            editor.remove();
        }
    });
}

/**
 * Add a refinement comment for a scenario table row
 */
function addRefinementForRow(rowNum: number, comment: string, scenarioContent: string, rowEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const refinement: Refinement = {
        id,
        lineNum: rowNum,  // Use row number as line number
        lineContent: scenarioContent,
        comment,
        lineType: 'acceptance'
    };

    pendingRefinements.push(refinement);
    renderInlineCommentForRow(rowEl, refinement);
    updateRefineButton();
}

/**
 * Render an inline comment card below a scenario table row
 */
function renderInlineCommentForRow(rowEl: HTMLElement, ref: Refinement): void {
    rowEl.classList.add('has-refinement');

    // Create a new row for the comment
    const commentRow = document.createElement('tr');
    commentRow.className = 'comment-row';
    commentRow.dataset.refId = ref.id;
    commentRow.innerHTML = `
        <td colspan="4" class="comment-cell">
            <div class="inline-comment">
                <span class="comment-icon">💬</span>
                <span class="comment-text">${escapeHtml(ref.comment)}</span>
                <button class="comment-delete" data-ref-id="${ref.id}" title="Remove comment">×</button>
            </div>
        </td>
    `;

    // Insert comment row after the scenario row
    rowEl.after(commentRow);

    // Setup delete button
    const deleteBtn = commentRow.querySelector('.comment-delete');
    deleteBtn?.addEventListener('click', () => {
        removeRefinementForRow(ref.id, rowEl, commentRow);
    });
}

/**
 * Remove a refinement for a scenario table row
 */
function removeRefinementForRow(refId: string, rowEl: HTMLElement, commentRow: HTMLElement): void {
    const index = pendingRefinements.findIndex(r => r.id === refId);
    if (index > -1) {
        pendingRefinements.splice(index, 1);
        commentRow.remove();

        // Remove has-refinement class if no more refinements on this row
        const rowNum = parseInt(rowEl.dataset.row || '0', 10);
        const hasMoreRefinements = pendingRefinements.some(r => r.lineNum === rowNum && r.lineType === 'acceptance');
        if (!hasMoreRefinements) {
            rowEl.classList.remove('has-refinement');
        }

        updateRefineButton();
    }
}

/**
 * Handle context-aware action clicks
 */
function handleContextAction(action: string, lineNum: number): void {
    closeInlineEditor();

    switch (action) {
        case 'remove-line':
        case 'remove-story':
        case 'remove-section':
        case 'remove-scenario':
        case 'remove-task':
            if (confirm('Delete this content?')) {
                vscode.postMessage({ type: 'removeLine', lineNum });
            }
            break;
        case 'toggle-task':
            // Find the checkbox and toggle it
            const lineEl = document.querySelector(`.line[data-line="${lineNum}"]`);
            const checkbox = lineEl?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
            break;
    }
}

// ============================================
// Refinement State Management
// ============================================

/**
 * Add a refinement comment for a line
 */
function addRefinement(lineNum: number, comment: string, lineEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lineContent = lineEl.querySelector('.line-content')?.textContent?.trim() || '';
    const lineType = detectLineType(lineEl);

    const refinement: Refinement = {
        id,
        lineNum,
        lineContent,
        comment,
        lineType
    };

    pendingRefinements.push(refinement);
    renderInlineComment(lineEl, refinement);
    updateRefineButton();
}

/**
 * Remove a refinement by ID
 */
function removeRefinement(refId: string): void {
    const index = pendingRefinements.findIndex(r => r.id === refId);
    if (index > -1) {
        const refinement = pendingRefinements[index];
        pendingRefinements.splice(index, 1);

        // Remove the comment card from DOM
        const commentCard = document.querySelector(`.inline-comment[data-ref-id="${refId}"]`);
        const lineEl = commentCard?.closest('.line');

        commentCard?.remove();

        // Remove has-refinement class if no more refinements on this line
        if (lineEl) {
            const hasMoreRefinements = pendingRefinements.some(r => r.lineNum === refinement.lineNum);
            if (!hasMoreRefinements) {
                lineEl.classList.remove('has-refinement');
            }
        }

        updateRefineButton();
    }
}

/**
 * Render an inline comment card below a line
 */
function renderInlineComment(lineEl: HTMLElement, ref: Refinement): void {
    lineEl.classList.add('has-refinement');

    const commentCard = document.createElement('div');
    commentCard.className = 'inline-comment';
    commentCard.dataset.refId = ref.id;
    commentCard.innerHTML = `
        <span class="comment-icon">💬</span>
        <span class="comment-text">${escapeHtml(ref.comment)}</span>
        <button class="comment-delete" data-ref-id="${ref.id}" title="Remove comment">×</button>
    `;

    // Add to comment slot
    const commentSlot = lineEl.querySelector('.line-comment-slot');
    if (commentSlot) {
        commentSlot.appendChild(commentCard);
    }

    // Setup delete button
    const deleteBtn = commentCard.querySelector('.comment-delete');
    deleteBtn?.addEventListener('click', () => {
        removeRefinement(ref.id);
    });
}

/**
 * Update the refine button visibility and count
 */
function updateRefineButton(): void {
    const count = pendingRefinements.length;
    let btn = document.getElementById('refine-submit-btn') as HTMLButtonElement | null;

    // Create button if it doesn't exist
    if (!btn) {
        const actionsRight = document.querySelector('.actions-right');
        if (actionsRight) {
            btn = document.createElement('button');
            btn.id = 'refine-submit-btn';
            btn.className = 'refine-submit-btn';
            btn.addEventListener('click', submitAllRefinements);
            actionsRight.insertBefore(btn, actionsRight.firstChild);
        }
    }

    if (btn) {
        if (count > 0) {
            btn.classList.add('visible');
            btn.innerHTML = `📝 Refine (${count} comment${count > 1 ? 's' : ''}) →`;
        } else {
            btn.classList.remove('visible');
        }
    }
}

/**
 * Submit all refinements to the extension
 */
function submitAllRefinements(): void {
    if (pendingRefinements.length === 0) return;

    // Send refinements to extension
    vscode.postMessage({
        type: 'submitRefinements',
        refinements: pendingRefinements.map(r => ({
            lineNum: r.lineNum,
            lineContent: r.lineContent,
            comment: r.comment
        }))
    });

    // Clear all refinements
    clearAllRefinements();
}

/**
 * Clear all pending refinements
 */
function clearAllRefinements(): void {
    // Remove all comment cards
    document.querySelectorAll('.inline-comment').forEach(el => el.remove());

    // Remove has-refinement class from all lines
    document.querySelectorAll('.line.has-refinement').forEach(el => {
        el.classList.remove('has-refinement');
    });

    pendingRefinements = [];
    updateRefineButton();
}

// ============================================
// Line Actions (GitHub-style "+" Button)
// ============================================

/**
 * Setup click handlers for the "+" button
 */
function setupLineActions(): void {
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Handle "+" button click for lines
        if (target.classList.contains('line-add-btn')) {
            const lineNum = parseInt(target.dataset.line || '0', 10);
            const lineEl = document.querySelector(`.line[data-line="${lineNum}"]`) as HTMLElement;
            if (lineEl) {
                showInlineEditor(lineEl);
            }
            return;
        }

        // Handle "+" button click for scenario table rows
        if (target.classList.contains('row-add-btn')) {
            const rowNum = parseInt(target.dataset.row || '0', 10);
            const tableId = target.dataset.tableId;
            // Use table-scoped selector to find the correct row
            const selector = tableId
                ? `.scenario-row[data-row="${rowNum}"][data-table-id="${tableId}"]`
                : `.scenario-row[data-row="${rowNum}"]`;
            const rowEl = document.querySelector(selector) as HTMLElement;
            if (rowEl) {
                showInlineEditorForRow(rowEl, rowNum);
            }
            return;
        }

        // Close editor when clicking outside
        if (activeInlineEditor && !target.closest('.inline-editor') && !target.classList.contains('line-add-btn') && !target.classList.contains('row-add-btn')) {
            closeInlineEditor();
        }
    });
}

/**
 * Show inline edit input for a line (legacy - kept for compatibility)
 */
function showInlineEdit(lineEl: HTMLElement | null, lineNum: number, content: string): void {
    if (!lineEl) return;

    const contentEl = lineEl.querySelector('.line-content');
    if (!contentEl) return;

    // Store original content for cancel
    const originalHtml = contentEl.innerHTML;

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = content.trim();
    input.className = 'inline-edit-input';

    // Handle keyboard events
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newText = input.value.trim();
            if (newText && newText !== content.trim()) {
                vscode.postMessage({ type: 'editLine', lineNum, newText });
            }
            contentEl.innerHTML = originalHtml;
        }
        if (e.key === 'Escape') {
            contentEl.innerHTML = originalHtml;
        }
    });

    // Handle blur (click away)
    input.addEventListener('blur', () => {
        // Small delay to allow Enter key to fire first
        setTimeout(() => {
            if (contentEl.contains(input)) {
                contentEl.innerHTML = originalHtml;
            }
        }, 100);
    });

    // Replace content with input
    contentEl.innerHTML = '';
    contentEl.appendChild(input);
    input.focus();
    input.select();
}

// ============================================
// State Persistence
// ============================================

function saveState(): void {
    const { contentArea } = getElements();
    const activeTab = document.querySelector('.tab-button.active') as HTMLButtonElement;

    const state: ViewerWebviewState = {
        currentDocument: activeTab?.dataset.doc || 'spec',
        scrollPosition: contentArea.scrollTop,
        specDirectory: ''
    };

    vscode.setState(state);
}

function restoreState(): void {
    const state = vscode.getState<ViewerWebviewState>();
    if (state?.scrollPosition) {
        const { contentArea } = getElements();
        contentArea.scrollTop = state.scrollPosition;
    }
}

// ============================================
// Message Handler
// ============================================

function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToViewerMessage;

    switch (message.type) {
        case 'contentUpdated':
            updateContent(message.content);
            // Update navigation state if provided (for smooth tab switching)
            if (message.navState) {
                updateNavState(message.navState);
            }
            break;

        case 'navStateUpdated':
            updateNavState(message.navState);
            break;

        case 'documentsUpdated':
            // Tab state is managed by HTML regeneration
            break;

        case 'error':
            console.error('[SpecViewer] Error:', message.message);
            break;

        case 'fileDeleted':
            // Show deleted state
            const { contentArea } = getElements();
            contentArea.innerHTML = `<div class="empty-state">The file has been deleted.</div>`;
            break;
    }
}

// ============================================
// Checkbox Toggle (for task items)
// ============================================

function setupCheckboxToggle(): void {
    // Use event delegation for checkbox changes
    document.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
            return;
        }

        const checkbox = target as HTMLInputElement;
        const lineNum = parseInt(checkbox.dataset.line || '0', 10);
        if (!lineNum) return;

        const isChecked = checkbox.checked;

        // Update the li class for visual feedback
        const li = checkbox.closest('li');
        if (li) {
            li.classList.toggle('checked', isChecked);
        }

        // Send message to extension to update the file
        vscode.postMessage({
            type: 'toggleCheckbox',
            lineNum,
            checked: isChecked
        });
    });
}

// ============================================
// Initialization
// ============================================

function init(): void {
    setupTabNavigation();
    setupStepperNavigation();
    setupEditButton();
    setupFooterActions();
    setupRefineModal();
    setupLineActions();
    setupCheckboxToggle();
    restoreState();

    // Handle initial content (passed via data attribute)
    const { markdownContent } = getElements();
    if (markdownContent) {
        const rawContent = markdownContent.dataset.raw;
        if (rawContent) {
            updateContent(rawContent);
        }
    }

    // Save state on scroll
    const { contentArea } = getElements();
    let scrollTimeout: number | undefined;
    contentArea.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(saveState, 100);
    });

    // Listen for messages from extension
    window.addEventListener('message', handleMessage);

    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
