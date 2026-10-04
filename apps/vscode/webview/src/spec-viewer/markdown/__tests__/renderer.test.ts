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

import { renderMarkdown } from '../renderer';
import { stripFrontmatter, stripTaskFormatLegend } from '../preprocessors';

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

    it('gives every comment affordance a line-specific accessible name', () => {
        const html = renderMarkdown('- [ ] **T001** Add accessible comments\n');
        expect(html).toContain('aria-label="Add comment to task line 1"');
        expect(html).toContain('stroke="currentColor"');
        expect(html).not.toContain('stroke="#ffffff"');
    });
});

describe('a callout line', () => {
    it('renders inline code in a Purpose line instead of showing the backticks', () => {
        const html = renderMarkdown('## Phase 1: Setup\n\n**Purpose**: Wire `getProjectRoot()` into the sidebar.\n');
        expect(html).toContain('callout-purpose');
        expect(html).toContain('<code');
        expect(html).not.toContain('`getProjectRoot()`');
    });

    it('escapes markup written in the line', () => {
        const html = renderMarkdown('**Note**: Never use <script>alert(1)</script> here.\n');
        expect(html).not.toContain('<script>');
    });

    it('shows markup written on the line as text, never as elements', () => {
        const html = renderMarkdown('**Note**: <div onclick="x()">click</div> and <span>more</span>\n');
        expect(html).not.toContain('<div onclick');
        expect(html).toContain('&lt;div onclick');
    });

    it('leaves a phase header that follows a checkpoint as a phase header', () => {
        const html = renderMarkdown('**Checkpoint**: done\n## Phase 2: Next\n\n- [ ] T001 first\n');
        expect(html).toContain('class="phase-header"');
        expect(html).not.toContain('&lt;div class="phase-header"');
    });

    it('keeps the line numbers below a callout that wraps onto a second line', () => {
        const source = [
            '## Phase 1: Setup',
            '',
            '**Purpose**: Wire `the thing` into',
            'the sidebar and more.',
            '',
            '- [ ] T001 first',
            '- [ ] T002 second',
        ].join('\n');
        const html = renderMarkdown(source);

        expect(html).toMatch(/data-line="6"[^>]*>(?:(?!data-line="7").)*T001/s);
        expect(html).toMatch(/data-line="7"[^>]*>(?:(?!data-line="8").)*T002/s);
    });
});

describe('renderMarkdown: a hard-wrapped paragraph', () => {
    it('joins consecutive source lines into one paragraph with one comment button', () => {
        const html = renderMarkdown('# T\n\nThe first half of a sentence\nand the second half,\nwrapped twice.\n\nNext paragraph.');
        expect(html).toContain('<p>The first half of a sentence and the second half, wrapped twice.</p>');
        expect(html).toMatch(/class="line" data-line="3" data-line-end="5"/);
        expect(html).not.toContain('data-line="4"');
        expect(html).toMatch(/class="line" data-line="7">/);
    });

    it('keeps bold-led field lines as their own lines', () => {
        const html = renderMarkdown('**Created**: today\n**Status**: Draft');
        expect(html).toContain('data-line="1"');
        expect(html).toContain('data-line="2"');
    });

    it('keeps a deliberate line break', () => {
        const html = renderMarkdown('first line  \nsecond line');
        expect(html).toMatch(/<p>first line\s*<\/p>/);
        expect(html).toContain('data-line="2"');
    });

    it.each([
        ['a trailing backslash', 'first line\\\nsecond line'],
        ['a label line', 'Branch: main\nCreated: today'],
        ['a scenario step', 'Given a user\nWhen they click'],
        ['an image line', 'intro text\n![a](a.png)'],
        ['a table row', 'intro text\n| a | b |'],
    ])('does not join across %s', (_name, source) => {
        expect(renderMarkdown(source)).not.toContain('data-line-end');
    });

    it('joins a continuation that only mentions a colon mid-line', () => {
        expect(renderMarkdown('The first half\nof a sentence: with a colon.')).toContain('data-line-end="2"');
    });
});
