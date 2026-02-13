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

    // Protect inline code first: extract backtick spans so their contents
    // are not processed by emphasis/link regexes.
    const codeSpans: string[] = [];
    let result = text
        // Escape HTML first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Stash inline code
        .replace(/`([^`]+)`/g, (_match, code) => {
            codeSpans.push(`<code>${code}</code>`);
            return `\x00CODE${codeSpans.length - 1}\x00`;
        })
        // Bold + Italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Italic — asterisk variant works as before
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Italic — underscore variant: only match when not inside a word
        .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Images
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        // Restore inline code spans
        .replace(/\x00CODE(\d+)\x00/g, (_match, idx) => codeSpans[parseInt(idx)]);

    // Post-process: Style acceptance scenario keywords (Given/When/Then)
    result = result
        .replace(/<strong>Given<\/strong>/g, '<span class="scenario-keyword scenario-given">Given</span>')
        .replace(/<strong>When<\/strong>/g, '<span class="scenario-keyword scenario-when">When</span>')
        .replace(/<strong>Then<\/strong>/g, '<span class="scenario-keyword scenario-then">Then</span>');

    return result;
}
