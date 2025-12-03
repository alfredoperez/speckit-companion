/**
 * Line rendering for markdown content
 */
import { escapeHtml, parseInlineMarkdown, cleanSectionTitle, getSectionType, classifyLine } from '../markdown';

interface PhaseInfo {
    startLine: number;
    total: number;
    completed: number;
    isComplete: boolean;
}

/**
 * Generate line action buttons based on classification
 */
function renderLineActions(lineNum: number, refinable: boolean, removable: boolean): string {
    const refineBtn = refinable
        ? `<button class="line-action refine" data-action="refine" data-line="${lineNum}" title="Refine this">&#9998;</button>`
        : '';
    const removeBtn = removable
        ? `<button class="line-action remove" data-action="remove" data-line="${lineNum}" title="Remove">&#128465;</button>`
        : '';
    return `<div class="line-actions">${refineBtn}${removeBtn}</div>`;
}

export function renderLine(line: string, lineNum: number, phaseInfo?: PhaseInfo): string {
    const classification = classifyLine(line);
    const trimmed = line.trim();

    // Skip empty lines but preserve spacing
    if (classification.type === 'empty') {
        return '<div class="line empty"></div>';
    }

    // Document title
    if (classification.type === 'doc-title') {
        const title = cleanSectionTitle(trimmed.replace(/^# /, ''));
        return `<h1 class="doc-title">${escapeHtml(title)}</h1>`;
    }

    // Section header
    if (classification.type === 'section-header') {
        const title = cleanSectionTitle(trimmed.replace(/^## /, ''));
        const sectionType = getSectionType(title);

        // Check if this is a Phase header and add completion indicator
        const isPhaseHeader = /^Phase\s+\d+/i.test(title);
        let phaseIndicator = '';
        let phaseClass = '';

        if (isPhaseHeader && phaseInfo) {
            if (phaseInfo.isComplete) {
                phaseIndicator = ' <span class="phase-complete">✅</span>';
                phaseClass = ' phase-completed';
            } else if (phaseInfo.total > 0) {
                phaseIndicator = ` <span class="phase-progress">(${phaseInfo.completed}/${phaseInfo.total})</span>`;
            }
        }

        return `<h2 class="section-header${phaseClass}" data-type="${sectionType}">${escapeHtml(title)}${phaseIndicator}</h2>`;
    }

    // Subsection header
    if (classification.type === 'subsection-header') {
        const title = cleanSectionTitle(trimmed.replace(/^### /, ''));
        return `
            <div class="line subsection-header" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <h3>${escapeHtml(title)}</h3>
            </div>
        `;
    }

    // H4 header
    if (classification.type === 'h4-header') {
        const title = cleanSectionTitle(trimmed.replace(/^#### /, ''));
        return `
            <div class="line h4-header" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <h4>${escapeHtml(title)}</h4>
            </div>
        `;
    }

    // Horizontal rule
    if (classification.type === 'hr') {
        return '<hr class="divider">';
    }

    // Checkbox item
    if (classification.type === 'checkbox') {
        const isChecked = /^- \[x\]/i.test(trimmed);
        const content = trimmed.replace(/^- \[[ xX]\] /, '');
        return `
            <div class="line checkbox-line ${isChecked ? 'checked' : ''}" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <span class="checkbox-marker">${isChecked ? '✅' : '⬜'}</span>
                <span class="line-content">${parseInlineMarkdown(content)}</span>
            </div>
        `;
    }

    // Bullet item
    if (classification.type === 'bullet') {
        const content = trimmed.replace(/^[-*] /, '');
        return `
            <div class="line bullet-line" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <span class="bullet-marker">&#8226;</span>
                <span class="line-content">${parseInlineMarkdown(content)}</span>
            </div>
        `;
    }

    // Numbered item
    if (classification.type === 'numbered') {
        const match = trimmed.match(/^(\d+)\. (.*)$/);
        const num = match ? match[1] : '';
        const content = match ? match[2] : trimmed;
        return `
            <div class="line numbered-line" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <span class="number-marker">${num}.</span>
                <span class="line-content">${parseInlineMarkdown(content)}</span>
            </div>
        `;
    }

    // User story line
    if (classification.type === 'user-story') {
        return `
            <div class="line user-story-line" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <span class="line-content">${parseInlineMarkdown(trimmed)}</span>
            </div>
        `;
    }

    // Regular content line
    if (classification.refinable) {
        return `
            <div class="line content-line" data-line-num="${lineNum}">
                ${renderLineActions(lineNum, classification.refinable, classification.removable)}
                <span class="line-content">${parseInlineMarkdown(trimmed)}</span>
            </div>
        `;
    }

    // Fallback - plain line
    return `<div class="line">${parseInlineMarkdown(trimmed)}</div>`;
}
