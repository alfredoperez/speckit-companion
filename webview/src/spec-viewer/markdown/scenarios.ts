/**
 * SpecKit Companion - Acceptance Scenario Parsing
 * Handles parsing of acceptance scenarios into structured tables
 */

import { escapeHtmlInScenario } from './inline';

// Counter for unique table IDs
let scenarioTableCounter = 0;

/**
 * Reset the scenario table counter (call before parsing new content)
 */
export function resetScenarioTableCounter(): void {
    scenarioTableCounter = 0;
}

/**
 * Parse acceptance scenarios into a structured table format
 * Looks for "**Acceptance Scenarios**:" followed by numbered list with GIVEN/WHEN/THEN
 */
export function parseAcceptanceScenarios(markdown: string): string {
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
