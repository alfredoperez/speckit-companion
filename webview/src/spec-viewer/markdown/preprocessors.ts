/**
 * SpecKit Companion - Markdown Preprocessors
 * Handles spec metadata, user stories, and callouts preprocessing
 */

import { parseInline } from './inline';

/**
 * Preprocess spec metadata (Feature Branch, Created, Status, Input) into a compact header.
 * When `stripForContext` is true (spec-context.json data available), the entire metadata
 * block is stripped to avoid duplication with the structured header.
 */
export function preprocessSpecMetadata(markdown: string, stripForContext = false): string {
    // Pattern to match metadata lines at the start (after h1)
    // Matches lines like: **Feature Branch**: `value` or **Created:** value
    const metadataPattern = /^(# .+\n+)((?:\*\*[^*]+\*\*:?\s*.+\n*)+)/m;

    const match = markdown.match(metadataPattern);
    if (!match) return markdown;

    // When context-driven header is active, strip the entire metadata block
    if (stripForContext) {
        return markdown.replace(metadataPattern, '$1');
    }

    const title = match[1];
    const metadataBlock = match[2];

    // Parse individual metadata items - captures **Label** or **Label:** then the value
    // Also handles pipe-separated fields like: **Plan**: value | **Date**: value
    const items: { label: string; value: string }[] = [];
    const itemPattern = /\*\*([^*]+)\*\*:?\s*(.+?)(?=\s*\|\s*\*\*|\n\*\*|\n\n|$)/g;
    let itemMatch;

    while ((itemMatch = itemPattern.exec(metadataBlock)) !== null) {
        let label = itemMatch[1].trim();
        let value = itemMatch[2].trim();

        // Remove trailing colon from label if present (handles **Label:** format)
        label = label.replace(/:$/, '');

        // Clean up value - remove backticks for inline display
        value = value.replace(/`([^`]+)`/g, '$1');

        // Only include recognized metadata fields
        const recognizedFields = ['Feature Branch', 'Status', 'Input', 'Version', 'Author', 'Slug'];
        if (!recognizedFields.includes(label)) continue;

        if (label === 'Slug') continue;

        items.push({ label, value });
    }

    if (items.length === 0) return markdown;

    // Build compact metadata HTML
    const metadataHtml = items.map(item => {
        if (item.label === 'Status') {
            const statusClass = item.value.toLowerCase().replace(/\s+/g, '-');
            return `<span class="meta-item"><span class="meta-status meta-status-${statusClass}">${item.value}</span></span>`;
        }
        if (item.label === 'Feature Branch') {
            return `<span class="meta-item"><span class="meta-branch">${item.value}</span></span>`;
        }
        if (item.label === 'Input') {
            return `</div><div class="spec-input"><span class="meta-label">Input:</span> ${item.value}</div><div class="spec-meta">`;
        }
        return `<span class="meta-item"><span class="meta-label">${item.label}:</span> ${item.value}</span>`;
    }).join('');

    // Place metadata ABOVE the title
    const metaBar = items.length > 0 ? `<div class="spec-meta">${metadataHtml}</div>\n\n` : '';
    const replacement = `${metaBar}${title}\n`;

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

        return `<div class="user-story-header"><div class="user-story-meta">${ticketIcon}<span class="story-id">US-${num}</span><span class="meta-separator">·</span><span class="story-priority priority-${priorityClass}"><span class="priority-dot ${priorityClass}"></span>${priorityLabel}</span></div><h3 class="user-story-title">${parseInline(title.trim())}</h3></div>`;
    });
}

/**
 * Preprocess tasks.md "## Phase N: …" headings into styled phase headers, lifting
 * any MVP marker (🎯 MVP) and priority tag (P1..P5) out of the title into chips.
 */
export function preprocessTaskPhases(markdown: string): string {
    const phasePattern = /^##\s+Phase\s+(\d+)\s*:\s*(.+)$/gm;

    return markdown.replace(phasePattern, (_full, num, rest) => {
        let title = String(rest);
        const chips: string[] = [];

        if (/🎯|\bMVP\b/.test(title)) {
            chips.push('<span class="phase-chip mvp">MVP</span>');
            title = title.replace(/🎯/g, '').replace(/\bMVP\b/g, '');
        }

        const prio = title.match(/\((P[1-5])\)/);
        if (prio) {
            const p = prio[1].toLowerCase();
            chips.push(`<span class="phase-chip prio ${p}">${prio[1]}</span>`);
            title = title.replace(/\((P[1-5])\)/, '');
        }

        title = title.replace(/\s{2,}/g, ' ').trim();

        return `<div class="phase-header" data-phase="${num}"><div class="phase-header-meta"><span class="phase-num">Phase ${num}</span>${chips.join('')}</div><h2 class="phase-title" id="phase-${num}">${parseInline(title)}</h2></div>`;
    });
}

/**
 * Preprocess requirement / criteria bullets — `- **FR-001** …`, `- **SC-001**: …`,
 * `- **NFR-002** …` — into styled ID-badged rows. Matches an uppercase prefix +
 * hyphen + number so plain bullets, key-entity bold labels (`**SpecContext**:`),
 * and task IDs (`T001`, no hyphen) are left untouched. Inline markdown in the
 * body (code spans, bold) is rendered via parseInline.
 */
export function preprocessRequirements(markdown: string): string {
    const reqPattern = /^-\s+\*\*([A-Z]{2,5}-\d+)\*\*:?\s*(.+)$/gm;

    return markdown.replace(reqPattern, (_full, id, text) => {
        const kind = String(id).split('-')[0].toLowerCase();
        const body = parseInline(String(text).trim());
        return `<div class="req-row" data-kind="${kind}"><span class="req-badge">${id}</span><span class="req-text">${body}</span></div>`;
    });
}

const CHECK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 8.5l3.5 3.5L13 4.5"/></svg>';

/**
 * Preprocess the `Key Entities` section's `- **Name** (qualifier) — description`
 * bullets into styled entity rows. Scoped to that one section so bold-led bullets
 * elsewhere (and the requirement rows above) are left alone.
 */
export function preprocessEntities(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let inEntities = false;
    for (const line of lines) {
        if (/^#{2,3}[ \t]+Key Entities\b/.test(line)) { inEntities = true; out.push(line); continue; }
        if (inEntities && /^#{1,6}[ \t]/.test(line)) { inEntities = false; }
        if (inEntities) {
            const m = line.match(/^-[ \t]+\*\*(.+?)\*\*[ \t]*(\([^)]*\))?[ \t]*[:—–-]?[ \t]*(.*)$/);
            if (m) {
                const paren = m[2] ? `<span class="entity-paren">${parseInline(m[2])}</span>` : '';
                const desc = m[3] ? `<span class="entity-desc">${parseInline(m[3].trim())}</span>` : '';
                out.push(`<div class="entity-row"><span class="entity-name">${parseInline(m[1])}</span>${paren}${desc}</div>`);
                continue;
            }
        }
        out.push(line);
    }
    return out.join('\n');
}

/**
 * Render a spec quality checklist (`# … Checklist`) as grouped pass/fail report
 * cards — one per `## Section`, each with a pass count. Gated on the H1 naming a
 * checklist so tasks.md (whose checkboxes live under `## Phase`) is untouched.
 */
export function preprocessChecklist(markdown: string): string {
    const h1 = markdown.match(/^#[ \t]+(.+)$/m);
    if (!h1 || !/checklist/i.test(h1[1])) return markdown;

    const lines = markdown.split('\n');
    const out: string[] = [];
    let group: { name: string; items: string[]; pass: number; total: number } | null = null;
    const flush = () => {
        if (group) {
            out.push(`<div class="ck-group"><div class="ck-group-head"><span class="ck-name">${parseInline(group.name)}</span><span class="ck-count">${group.pass}/${group.total}</span></div>${group.items.join('')}</div>`);
            group = null;
        }
    };
    for (const line of lines) {
        let m: RegExpMatchArray | null;
        if (m = line.match(/^##[ \t]+(.+)$/)) {
            flush();
            if (/^notes\b/i.test(m[1])) { out.push(line); }
            else { group = { name: m[1], items: [], pass: 0, total: 0 }; }
            continue;
        }
        if (group && (m = line.match(/^-[ \t]+\[([ xX])\][ \t]+(.+)$/))) {
            const ok = m[1].toLowerCase() === 'x';
            group.total++; if (ok) group.pass++;
            group.items.push(`<div class="ck-item${ok ? ' ok' : ''}"><span class="ck-box">${ok ? CHECK_SVG : ''}</span><span class="ck-text">${parseInline(m[2])}</span></div>`);
            continue;
        }
        if (group && line.trim()) { flush(); }
        out.push(line);
    }
    flush();
    return out.join('\n');
}

/**
 * Preprocess plan.md's `## Technical Context` section — the `**Key**: value`
 * lines (Language/Version, Primary Dependencies, …) — into a key/value grid.
 * Scoped to that one section so other `**Label**: …` lines are untouched.
 */
export function preprocessTechnicalContext(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let inSection = false;
    let cells: string[] = [];
    const flush = () => {
        if (cells.length) {
            out.push(`<details class="md-collapsible"><summary class="md-collapsible__summary">Technical Context</summary><div class="tech-grid">${cells.join('')}</div></details>`);
            cells = [];
        }
    };
    for (const line of lines) {
        if (/^##[ \t]+Technical Context\b/.test(line)) { flush(); inSection = true; continue; }
        if (inSection && /^#{1,6}[ \t]/.test(line)) { inSection = false; flush(); out.push(line); continue; }
        if (inSection) {
            const m = line.match(/^\*\*(.+?)\*\*:[ \t]*(.+)$/);
            if (m) {
                cells.push(`<div class="tech-cell"><span class="tech-key">${parseInline(m[1])}</span><span class="tech-val">${parseInline(m[2].trim())}</span></div>`);
                continue;
            }
            if (!line.trim()) { continue; }
            flush();
        }
        out.push(line);
    }
    flush();
    return out.join('\n');
}

/**
 * Preprocess plan.md's `## Constitution Check` bullet list
 * (`- **I. Name**: PASS — note`) into verdict rows with a PASS/FAIL chip. Scoped
 * to that section; the table form (used by some plans) renders as a table as-is.
 */
export function preprocessConstitution(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let inSection = false;
    let rows: string[] = [];
    const flush = () => {
        if (rows.length) {
            out.push(`<details class="md-collapsible"><summary class="md-collapsible__summary">Constitution Check</summary>${rows.join('')}</details>`);
            rows = [];
        }
    };
    for (const line of lines) {
        if (/^##[ \t]+Constitution Check\b/.test(line)) { flush(); inSection = true; continue; }
        if (inSection && /^#{1,6}[ \t]/.test(line)) { inSection = false; flush(); out.push(line); continue; }
        if (inSection) {
            let name: string | undefined, verdict: string | undefined, note: string | undefined;
            // Verdict right after the name: `- **Name**: PASS — note`
            let m = line.match(/^-[ \t]+\*\*(.+?)\*\*:?[ \t]*(?:[✅❌]\s*)?(PASS|FAIL)\b[ \t]*[—–-]?[ \t]*(.*)$/i);
            if (m) { [, name, verdict, note] = m; }
            // Verdict at the end of the sentence: `- **Name** — note … PASS.`
            else if (m = line.match(/^-[ \t]+\*\*(.+?)\*\*[ \t]*[—–:-]?[ \t]*(.*?)[ \t]*(?:[✅❌]\s*)?(PASS|FAIL)\b\.?[ \t]*$/i)) {
                [, name, note, verdict] = m;
            }
            if (name && verdict) {
                const v = verdict.toUpperCase();
                const noteHtml = note && note.trim() ? `<span class="con-note">${parseInline(note.trim())}</span>` : '';
                rows.push(`<div class="con-row"><span class="verdict ${v.toLowerCase()}">${v}</span><span class="con-name">${parseInline(name)}</span>${noteHtml}</div>`);
                continue;
            }
            if (!line.trim()) { continue; }
            flush();
        }
        out.push(line);
    }
    flush();
    return out.join('\n');
}

/**
 * Preprocess research.md `## Decision N: Title` blocks into cards. Opens a card
 * div per decision (letting Rationale/Alternatives render inside) and turns the
 * `**Decision**` / `**Rationale**` / `**Alternatives**` labels into field rows.
 */
export function preprocessDecisions(markdown: string): string {
    if (!/^##[ \t]+Decision\b/m.test(markdown)) return markdown;

    const lines = markdown.split('\n');
    const out: string[] = [];
    let cardOpen = false;
    const close = () => { if (cardOpen) { out.push('</div>'); cardOpen = false; } };
    for (const line of lines) {
        let m: RegExpMatchArray | null;
        if (m = line.match(/^##[ \t]+Decision\s+(\d+)\s*:\s*(.+)$/)) {
            close();
            out.push(`<div class="decision-card"><div class="decision-card__head"><span class="decision-num">Decision ${m[1]}</span><span class="decision-title">${parseInline(m[2])}</span></div>`);
            cardOpen = true;
            continue;
        }
        if (cardOpen && /^#{1,6}[ \t]/.test(line)) { close(); out.push(line); continue; }
        if (cardOpen && (m = line.match(/^\*\*(Decision|Rationale|Alternatives)(?:\s+considered)?\*\*:?[ \t]*(.*)$/i))) {
            const label = m[1];
            const val = m[2] ? `<span class="decision-val">${parseInline(m[2].trim())}</span>` : '';
            out.push(`<div class="decision-field"><span class="decision-label decision-label--${label.toLowerCase()}">${label}</span>${val}</div>`);
            continue;
        }
        out.push(line);
    }
    close();
    return out.join('\n');
}

/**
 * Strip a leading YAML frontmatter block (`---` … `---`) from the document.
 * spec-kit prepends a block like `---\ndescription: "…"\n---` to generated
 * spec/plan/tasks files. The renderer has no frontmatter handling, so the
 * delimiters render as `<hr>` and the keys leak as a paragraph. Only a block at
 * the very start (after optional blank lines) is removed, so a `---` used later
 * in the body as a thematic break still renders as a horizontal rule. See #158.
 */
export function stripFrontmatter(markdown: string): string {
    return markdown.replace(/^\s*---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/, '');
}

/**
 * Strip spec-kit's tasks.md "## Format:" legend — the boilerplate block that
 * explains the `[ID] [P?] [Story] Description` task notation (what `[P]` and
 * `[Story]` mean, "include file paths", etc.). It's authoring scaffolding, not
 * content for the reader. Removes the heading and the lines that follow it up to
 * the next heading (or end of document). See #158.
 */
export function stripTaskFormatLegend(markdown: string): string {
    return markdown.replace(/^##[ \t]+Format:.*(?:\n(?!#{1,6}[ \t]).*)*\n?/m, '');
}

/**
 * Preprocess HTML comments into collapsible "Template Instructions" blocks
 * Empty comments are removed entirely.
 */
export function preprocessHtmlComments(markdown: string): string {
    return markdown.replace(/<!--([\s\S]*?)-->/g, (_match, content) => {
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `\n<details class="template-instructions"><summary>Template Instructions</summary>\n\n${trimmed}\n\n</details>\n`;
    });
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
