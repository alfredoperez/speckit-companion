/**
 * Unit tests for parseInline — inline.ts
 *
 * Coverage:
 *  - Filename code spans are rendered as <button class="file-ref"> elements
 *  - Non-filename code spans are rendered as plain <code> elements
 *  - Paths with directory prefixes store the full path in data-filename
 *  - Multiple file extensions are recognised
 */

import { parseInline } from './inline';

describe('parseInline', () => {
    // -------------------------------------------------------------------------
    // Filename detected → button emitted
    // -------------------------------------------------------------------------
    describe('filename code span → <button class="file-ref">', () => {
        it('wraps a simple .ts filename in a file-ref button', () => {
            // Arrange
            const input = '`card.component.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="card.component.ts"><code>card.component.ts</code></button>'
            );
        });

        it('wraps a .css filename in a file-ref button', () => {
            // Arrange
            const input = '`styles.css`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="styles.css"><code>styles.css</code></button>'
            );
        });

        it('wraps a .json filename in a file-ref button', () => {
            // Arrange
            const input = '`config.json`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="config.json"><code>config.json</code></button>'
            );
        });

        it('wraps a multi-part extension filename (.component.ts) in a file-ref button', () => {
            // Arrange
            const input = '`app.module.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="app.module.ts"><code>app.module.ts</code></button>'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Non-filename code spans → plain <code>
    // -------------------------------------------------------------------------
    describe('non-filename code span → plain <code>', () => {
        it('renders a shell command as plain <code>, not a button', () => {
            // Arrange
            const input = '`npm install`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>npm install</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders an identifier expression as plain <code>, not a button', () => {
            // Arrange
            const input = '`const x = 1`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>const x = 1</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders a plain word without extension as plain <code>', () => {
            // Arrange
            const input = '`foobar`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>foobar</code>');
            expect(result).not.toContain('file-ref');
        });
    });

    // -------------------------------------------------------------------------
    // Path with directory prefix → full path stored in data-filename
    // -------------------------------------------------------------------------
    describe('path with directory prefix → full path in data-filename', () => {
        it('displays basename and stores full path with title tooltip', () => {
            // Arrange
            const input = '`src/utils/helpers.ts`';

            // Act
            const result = parseInline(input);

            // Assert — full path preserved in data-filename, basename shown as text
            expect(result).toContain('data-filename="src/utils/helpers.ts"');
            expect(result).toContain('title="src/utils/helpers.ts"');
            expect(result).toContain('<code>helpers.ts</code>');
            expect(result).toContain('<button class="file-ref"');
        });

        it('displays basename for deeply nested path with title tooltip', () => {
            // Arrange
            const input = '`webview/src/spec-viewer/markdown/inline.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                'data-filename="webview/src/spec-viewer/markdown/inline.ts"'
            );
            expect(result).toContain('title="webview/src/spec-viewer/markdown/inline.ts"');
            expect(result).toContain('<code>inline.ts</code>');
            expect(result).toContain('<button class="file-ref"');
        });

        it('does not add title attribute for simple filenames without directory', () => {
            // Arrange
            const input = '`helpers.ts`';

            // Act
            const result = parseInline(input);

            // Assert — no directory means no title tooltip
            expect(result).toContain('data-filename="helpers.ts"');
            expect(result).toContain('<code>helpers.ts</code>');
            expect(result).not.toContain('title=');
        });
    });

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------
    describe('edge cases', () => {
        it('returns an empty string for empty input', () => {
            expect(parseInline('')).toBe('');
        });

        it('leaves plain text (no backticks) unchanged', () => {
            const input = 'Hello world';
            expect(parseInline(input)).toBe('Hello world');
        });

        it('handles multiple code spans in a single line correctly', () => {
            // Arrange
            const input = 'Run `npm install` then edit `app.component.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>npm install</code>');
            expect(result).not.toContain('file-ref" data-filename="npm install"');
            expect(result).toContain(
                '<button class="file-ref" data-filename="app.component.ts"><code>app.component.ts</code></button>'
            );
        });
    });
});
