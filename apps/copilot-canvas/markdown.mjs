// A small, dependency-free markdown renderer. Every piece of text is escaped before any tag is added,
// so the HTML it returns is safe to inject even though spec files are repository data.

export function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInline(text) {
    const codeSpans = [];
    let out = String(text).replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, _ticks, code) => {
        codeSpans.push(`<code>${escapeHtml(code.trim())}</code>`);
        return `\u0000${codeSpans.length - 1}\u0000`;
    });
    out = escapeHtml(out);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
        const url = href.replace(/&amp;/g, '&');
        if (/^https?:\/\//i.test(url)) {
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
        return `<span class="md-ref" title="${escapeHtml(url)}">${label}</span>`;
    });
    out = out
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
        .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codeSpans[Number(i)]);
}

const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+-]*)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TASK_ITEM = /^\[([ xX])\]\s+(.*)$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim());
}

function slug(text) {
    return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

function renderList(lines) {
    const items = [];
    for (const line of lines) {
        const match = line.match(LIST_ITEM);
        if (match) items.push({ indent: match[1].length, ordered: /\d/.test(match[2]), text: match[3] });
        else if (items.length) items[items.length - 1].text += ` ${line.trim()}`;
    }
    let html = '';
    const stack = [];
    for (const item of items) {
        while (stack.length && item.indent < stack[stack.length - 1].indent) html += `</li></${stack.pop().tag}>`;
        const top = stack[stack.length - 1];
        if (!top || item.indent > top.indent) {
            const tag = item.ordered ? 'ol' : 'ul';
            stack.push({ indent: item.indent, tag });
            html += `<${tag}>`;
        } else {
            html += '</li>';
        }
        const task = item.text.match(TASK_ITEM);
        if (task) {
            const checked = task[1].toLowerCase() === 'x';
            html += `<li class="task${checked ? ' done' : ''}"><input type="checkbox" disabled${checked ? ' checked' : ''} aria-label="${checked ? 'Done' : 'Not done'}"> <span>${renderInline(task[2])}</span>`;
        } else {
            html += `<li>${renderInline(item.text)}`;
        }
    }
    while (stack.length) html += `</li></${stack.pop().tag}>`;
    return html;
}

export function renderMarkdown(markdown) {
    const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;

    // Front matter is metadata, not content.
    if (lines[0] === '---') {
        const end = lines.indexOf('---', 1);
        if (end > 0) i = end + 1;
    }

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) { i++; continue; }

        if (/^\s*<!--/.test(line)) {
            while (i < lines.length && !lines[i].includes('-->')) i++;
            i++;
            continue;
        }

        const fence = line.match(FENCE);
        if (fence) {
            const marker = fence[1];
            const body = [];
            i++;
            while (i < lines.length && !(lines[i].trim().startsWith(marker[0].repeat(marker.length)))) body.push(lines[i++]);
            i++;
            const lang = fence[2] ? ` data-lang="${escapeHtml(fence[2])}"` : '';
            out.push(`<pre${lang}><code>${escapeHtml(body.join('\n'))}</code></pre>`);
            continue;
        }

        const heading = line.match(HEADING);
        if (heading) {
            const level = heading[1].length;
            const inner = renderInline(heading[2]);
            out.push(`<h${level} id="${escapeHtml(slug(inner))}">${inner}</h${level}>`);
            i++;
            continue;
        }

        if (HR.test(line)) { out.push('<hr>'); i++; continue; }

        if (line.includes('|') && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
            const header = splitRow(line);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
            const th = header.map(cell => `<th>${renderInline(cell)}</th>`).join('');
            const tb = rows.map(row => `<tr>${header.map((_, c) => `<td>${renderInline(row[c] ?? '')}</td>`).join('')}</tr>`).join('');
            out.push(`<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
            continue;
        }

        if (/^\s*>/.test(line)) {
            const quote = [];
            while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
            out.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
            continue;
        }

        if (LIST_ITEM.test(line)) {
            const block = [];
            while (i < lines.length && lines[i].trim() && (LIST_ITEM.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) block.push(lines[i++]);
            out.push(renderList(block));
            continue;
        }

        const paragraph = [];
        while (
            i < lines.length && lines[i].trim()
            && !FENCE.test(lines[i]) && !HEADING.test(lines[i]) && !LIST_ITEM.test(lines[i]) && !/^\s*>/.test(lines[i]) && !HR.test(lines[i])
        ) paragraph.push(lines[i++].trim());
        out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    }

    return out.join('\n');
}
