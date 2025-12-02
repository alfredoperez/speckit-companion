/**
 * Line classification for markdown content
 */
import type { LineClassification, LineType } from '../types';

export function classifyLine(line: string): LineClassification {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
        return { type: 'empty', removable: false, refinable: false };
    }

    // Document title (# )
    if (/^# /.test(trimmed)) {
        return { type: 'doc-title', removable: false, refinable: false };
    }

    // Section header (## )
    if (/^## /.test(trimmed)) {
        return { type: 'section-header', removable: false, refinable: false };
    }

    // Subsection header (### )
    if (/^### /.test(trimmed)) {
        return { type: 'subsection-header', removable: false, refinable: true };
    }

    // H4 header (#### )
    if (/^#### /.test(trimmed)) {
        return { type: 'h4-header', removable: false, refinable: true };
    }

    // Horizontal rule
    if (/^---$/.test(trimmed) || /^\*\*\*$/.test(trimmed)) {
        return { type: 'hr', removable: false, refinable: false };
    }

    // Checkbox item
    if (/^- \[[ x]\] /.test(trimmed)) {
        return { type: 'checkbox', removable: true, refinable: true };
    }

    // Bullet item
    if (/^[-*] /.test(trimmed)) {
        return { type: 'bullet', removable: true, refinable: true };
    }

    // Numbered item
    if (/^\d+\. /.test(trimmed)) {
        return { type: 'numbered', removable: true, refinable: true };
    }

    // User story pattern
    if (/^\*\*As a\*\*/.test(trimmed)) {
        return { type: 'user-story', removable: true, refinable: true };
    }

    // Regular content line
    return { type: 'content', removable: false, refinable: true };
}
