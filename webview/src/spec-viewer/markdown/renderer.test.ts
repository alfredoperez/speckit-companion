/**
 * Unit tests for renderMarkdown + stripFrontmatter — issue #158.
 *
 * Coverage:
 *  - CRLF documents render block elements (headings/lists/rules) instead of
 *    falling through to raw paragraphs (the Windows / git-autocrlf bug).
 *  - Leading spec-kit YAML frontmatter is stripped, not leaked as <hr>+text.
 *  - A `---` used mid-document as a thematic break still renders as <hr>.
 *  - Documents without frontmatter are returned unchanged.
 */

import { renderMarkdown } from './renderer';
import { stripFrontmatter, stripTaskFormatLegend } from './preprocessors';

describe('renderMarkdown — CRLF normalization (issue #158)', () => {
    it('renders a CRLF heading as <h1>, not a literal "#" paragraph', () => {
        // Arrange — Windows / git autocrlf checkout: every line ends with \r\n
        const input = '# Tasks: Demo\r\n\r\n- item one\r\n- item two\r\n';

        // Act
        const result = renderMarkdown(input);

        // Assert
        expect(result).toContain('<h1 id="tasks-demo">Tasks: Demo</h1>');
        expect(result).not.toContain('<p>'); // nothing fell through to raw text
        expect(result).not.toContain('\r');
    });

    it('renders CRLF list items as <li>, not raw "- " text', () => {
        // Arrange
        const input = '- item one\r\n- item two\r\n';

        // Act
        const result = renderMarkdown(input);

        // Assert
        expect(result).toContain('<ul>');
        expect(result).toContain('item one');
        expect(result).toContain('item two');
        expect(result).not.toContain('- item one');
    });

    it('renders a CRLF "---" line as <hr>, not literal dashes', () => {
        // Arrange — leading text so the rule is mid-document, not frontmatter
        const input = 'before\r\n\r\n---\r\n\r\nafter\r\n';

        // Act
        const result = renderMarkdown(input);

        // Assert
        expect(result).toContain('<hr>');
    });
});

describe('renderMarkdown — leading YAML frontmatter (issue #158)', () => {
    it('strips spec-kit frontmatter so it does not leak as content', () => {
        // Arrange — exactly the shape spec-kit writes atop tasks.md
        const input =
            '---\n' +
            'description: "Task list for Demo"\n' +
            '---\n\n' +
            '# Tasks: Demo\n\n' +
            '- a\n';

        // Act
        const result = renderMarkdown(input);

        // Assert
        expect(result).not.toContain('description:');
        expect(result).toContain('<h1 id="tasks-demo">Tasks: Demo</h1>');
    });

    it('keeps a mid-document "---" rule when there is no frontmatter', () => {
        // Arrange
        const input = '# Heading\n\nbody\n\n---\n\nmore\n';

        // Act
        const result = renderMarkdown(input);

        // Assert
        expect(result).toContain('<hr>');
    });
});

describe('renderMarkdown — strips the spec-kit "## Format:" legend (issue #158)', () => {
    it('removes the Format heading and its notation bullets, keeps later sections', () => {
        // Arrange — the exact boilerplate spec-kit writes into tasks.md
        const input =
            '# Tasks: Demo\n\n' +
            '## Format: `[ID] [P?] [Story] Description`\n\n' +
            '- **[P]**: Can run in parallel (different files, no dependencies)\n' +
            '- **[Story]**: Which user story this task belongs to (US1, US2, US3)\n' +
            '- Include exact file paths in descriptions\n\n' +
            '## Path Conventions\n\n' +
            'Real content here.\n';

        // Act
        const result = renderMarkdown(input);

        // Assert
        expect(result).not.toContain('Can run in parallel');
        expect(result).not.toContain('Format:');
        expect(result).toContain('Path Conventions');
        expect(result).toContain('Real content here.');
    });
});

describe('stripTaskFormatLegend', () => {
    it('strips the Format legend section up to the next heading', () => {
        // Arrange
        const input =
            '## Format: `[ID] [P?] [Story] Description`\n' +
            '- **[P]**: parallel\n\n' +
            '## Next\n\nbody\n';

        // Act
        const result = stripTaskFormatLegend(input);

        // Assert
        expect(result).toBe('## Next\n\nbody\n');
    });

    it('leaves documents without a Format legend unchanged', () => {
        // Arrange
        const input = '# Tasks\n\n- **T001** do a thing\n';

        // Act / Assert
        expect(stripTaskFormatLegend(input)).toBe(input);
    });
});

describe('stripFrontmatter', () => {
    it('removes a leading --- ... --- block', () => {
        // Arrange
        const input = '---\ndescription: "x"\n---\n\n# Title';

        // Act
        const result = stripFrontmatter(input);

        // Assert
        expect(result).not.toContain('description:');
        expect(result).toContain('# Title');
    });

    it('leaves a document without frontmatter unchanged', () => {
        // Arrange
        const input = '# Title\n\nbody text\n';

        // Act / Assert
        expect(stripFrontmatter(input)).toBe(input);
    });

    it('does not strip a mid-document --- thematic break', () => {
        // Arrange
        const input = '# Title\n\nbefore\n\n---\n\nafter\n';

        // Act / Assert
        expect(stripFrontmatter(input)).toBe(input);
    });
});

describe('task lines — id and markers render as metadata chips', () => {
    const TASK = '- [x] **T008** [P] [US1] Reading column: hide empty `.spec-meta` · `_content.css`\n';

    it('lifts the task id out of the sentence into its own chip', () => {
        const html = renderMarkdown(TASK);
        expect(html).toContain('<span class="task-item__id">T008</span>');
        // The id no longer hides in a tooltip, and never repeats inside the text.
        expect(html).not.toContain('<strong>T008</strong>');
        expect(html).not.toContain('title="T008');
    });

    it('renders [P] and [US#] as chips instead of raw brackets in the prose', () => {
        const html = renderMarkdown(TASK);
        expect(html).toContain('task-item__marker--parallel');
        expect(html).toContain('>P</span>');
        expect(html).toContain('>US1</span>');

        const text = html.replace(/<[^>]+>/g, '');
        expect(text).not.toContain('[P]');
        expect(text).not.toContain('[US1]');
        expect(text).toContain('Reading column');
    });

    it('chips a bare (unbolded) task id too — specs write it both ways', () => {
        const html = renderMarkdown('- [x] T002 [P] Copy the canonical JSON Schema\n');
        expect(html).toContain('<span class="task-item__id">T002</span>');
        expect(html).toContain('task-item__marker--parallel');
        const text = html.replace(/<[^>]+>/g, '');
        expect(text).not.toContain('[P]');
        expect(text).toContain('Copy the canonical JSON Schema');
    });

    it('leaves a task with no markers alone', () => {
        const html = renderMarkdown('- [ ] **T001** Create the shared-parts directory\n');
        expect(html).toContain('<span class="task-item__id">T001</span>');
        expect(html).toContain('Create the shared-parts directory');
        expect(html).not.toContain('task-item__marker');
    });
});
