/**
 * SpecKit Companion - Acceptance Scenario Parsing
 * Handles parsing of acceptance scenarios into structured list format
 */

import { escapeHtmlInScenario } from './inline';

// Counter for unique list IDs
let scenarioListCounter = 0;

/**
 * Reset the scenario list counter (call before parsing new content)
 */
export function resetScenarioTableCounter(): void {
    scenarioListCounter = 0;
}

/**
 * Parse acceptance scenarios into a structured list format with emphasized keywords
 * Looks for "**Acceptance Scenarios**:" followed by numbered list with GIVEN/WHEN/THEN
 */
export function parseAcceptanceScenarios(markdown: string): string {
    // Reset counter for each parse
    scenarioListCounter = 0;

    // Pattern to match acceptance scenarios section followed by numbered list
    // Matches: **Acceptance Scenarios**: or **Acceptance Scenarios:**
    // Uses lookahead to capture until next section (heading, bold section, or double newline not followed by number)
    const sectionPattern = /(\*\*Acceptance Scenarios\*\*:?\s*\n)((?:\d+\.\s+[\s\S]+?)(?=\n\n(?!\s*\d+\.)|$|\n#|\n\*\*))/gi;

    return markdown.replace(sectionPattern, (_match, _header, listContent) => {
        // Generate unique list ID
        const listId = `scenario-list-${++scenarioListCounter}`;

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

        // If no lines, return original
        if (joinedLines.length === 0) {
            return _header + listContent;
        }

        // Comment icon SVG
        const commentIcon = `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3" color="currentColor"/></svg>`;

        // Build list items with emphasized keywords
        const listItems = joinedLines.map((line, idx) => {
            const lineNum = idx + 1;
            // Remove numbering (1. 2. etc.)
            const content = line.replace(/^\d+\.\s*/, '').trim();

            // Emphasize Given/When/Then keywords with <strong> tags
            const emphasized = escapeHtmlInScenario(content)
                .replace(/\*?\*?(Given)\*?\*?/gi, '<strong class="keyword-given">$1</strong>')
                .replace(/\*?\*?(When)\*?\*?/gi, '<strong class="keyword-when">$1</strong>')
                .replace(/\*?\*?(Then)\*?\*?/gi, '<strong class="keyword-then">$1</strong>');

            return `<li class="scenario-item line" data-line="${lineNum}" data-list-id="${listId}"><button class="line-add-btn" data-line="${lineNum}" data-list-id="${listId}" title="Add comment">${commentIcon}</button><div class="line-content">${emphasized}</div><div class="line-comment-slot"></div></li>`;
        }).join('');

        // Output as HTML (not markdown) so label doesn't get wrapped in .line
        return `<p class="scenario-label"><strong>Acceptance Scenarios:</strong></p>
<ol class="acceptance-scenarios" id="${listId}">${listItems}</ol>

`;
    });
}
