/**
 * SpecKit Companion - Markdown Preprocessors
 * Handles spec metadata, user stories, and callouts preprocessing
 */

/**
 * Preprocess spec metadata (Feature Branch, Created, Status, Input) into a compact header
 */
export function preprocessSpecMetadata(markdown: string): string {
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
export function preprocessUserStories(markdown: string): string {
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

/**
 * Preprocess acceptance scenario keywords (Given/When/Then) - legacy no-op
 * Note: Scenario formatting is now handled by parseAcceptanceScenarios()
 */
export function preprocessAcceptanceScenarios(markdown: string): string {
    // No-op - scenario keywords are now processed in parseAcceptanceScenarios()
    return markdown;
}

/**
 * Preprocess markdown to convert special patterns into callout blocks
 */
export function preprocessCallouts(markdown: string): string {
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
