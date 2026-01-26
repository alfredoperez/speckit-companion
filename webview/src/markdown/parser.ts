/**
 * Markdown parsing utilities
 */

export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function parseInlineMarkdown(line: string): string {
    if (!line) return '';

    return line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Underscore bold+italic: only match at word boundaries (not intraword)
        .replace(/(?<![a-zA-Z0-9])___(?!\s)(.+?)(?<!\s)___(?![a-zA-Z0-9])/g, '<strong><em>$1</em></strong>')
        // Underscore bold: only match at word boundaries (not intraword)
        .replace(/(?<![a-zA-Z0-9])__(?!\s)(.+?)(?<!\s)__(?![a-zA-Z0-9])/g, '<strong>$1</strong>')
        // Underscore italic: only match at word boundaries (not intraword)
        .replace(/(?<![a-zA-Z0-9])_(?!\s)(.+?)(?<!\s)_(?![a-zA-Z0-9])/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function cleanSectionTitle(title: string): string {
    return title
        .replace(/\s*\*?\(mandatory\)\*?/gi, '')
        .replace(/\s*\*?\(optional\)\*?/gi, '')
        .trim();
}

export function getSectionType(title: string): string {
    const lower = title.toLowerCase();
    if (/user\s*stor/i.test(lower)) return 'user-story';
    if (/acceptance/i.test(lower)) return 'acceptance';
    if (/assumption/i.test(lower) || /constraint/i.test(lower)) return 'constraint';
    if (/requirement/i.test(lower) || /feature/i.test(lower)) return 'requirement';
    return 'default';
}
