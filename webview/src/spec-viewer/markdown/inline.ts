/**
 * SpecKit Companion - Inline Markdown Parsing
 * Handles inline markdown elements like bold, italic, code, links
 */

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Simple HTML escape for scenario content (doesn't escape markdown bold)
 */
export function escapeHtmlInScenario(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Parse inline markdown elements
 */
export function parseInline(text: string): string {
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
