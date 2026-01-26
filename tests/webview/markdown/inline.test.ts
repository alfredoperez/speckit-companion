/**
 * Tests for inline markdown parsing
 * Verifies that underscore-based emphasis follows CommonMark behavior
 * and does not trigger within words (intraword underscores)
 */

import { parseInline, escapeHtml, escapeHtmlInScenario } from '../../../webview/src/spec-viewer/markdown/inline';

describe('parseInline', () => {
  describe('underscore emphasis - word boundaries', () => {
    it('should apply italic to text wrapped in underscores at word boundaries', () => {
      expect(parseInline('_italic text_')).toBe('<em>italic text</em>');
    });

    it('should apply italic when preceded by space', () => {
      expect(parseInline('hello _world_')).toBe('hello <em>world</em>');
    });

    it('should apply italic when followed by space', () => {
      expect(parseInline('_hello_ world')).toBe('<em>hello</em> world');
    });

    it('should apply bold to text wrapped in double underscores', () => {
      expect(parseInline('__bold text__')).toBe('<strong>bold text</strong>');
    });

    it('should apply bold+italic to text wrapped in triple underscores', () => {
      expect(parseInline('___bold italic___')).toBe('<strong><em>bold italic</em></strong>');
    });
  });

  describe('underscore emphasis - intraword (should NOT apply)', () => {
    it('should NOT apply emphasis to underscores within snake_case identifiers', () => {
      const input = 'ENV_VAR_AS_EXAMPLE';
      expect(parseInline(input)).toBe('ENV_VAR_AS_EXAMPLE');
    });

    it('should NOT apply emphasis to simple snake_case', () => {
      expect(parseInline('foo_bar')).toBe('foo_bar');
    });

    it('should NOT apply emphasis to snake_case with multiple underscores', () => {
      expect(parseInline('my_variable_name')).toBe('my_variable_name');
    });

    it('should NOT apply emphasis to SCREAMING_SNAKE_CASE', () => {
      expect(parseInline('SOME_CONSTANT_VALUE')).toBe('SOME_CONSTANT_VALUE');
    });

    it('should NOT apply emphasis to underscores in file paths', () => {
      expect(parseInline('path/to/my_file_name.ts')).toBe('path/to/my_file_name.ts');
    });

    it('should NOT apply emphasis when underscore is preceded by alphanumeric', () => {
      expect(parseInline('word_')).toBe('word_');
    });

    it('should NOT apply emphasis when underscore is followed by alphanumeric', () => {
      expect(parseInline('_word')).toBe('_word');
    });

    it('should handle mixed scenarios - intraword and word boundary', () => {
      // The word boundary _text_ should still work even near snake_case
      expect(parseInline('Use _emphasis_ with ENV_VAR here')).toBe('Use <em>emphasis</em> with ENV_VAR here');
    });
  });

  describe('asterisk emphasis - should always work', () => {
    it('should apply italic with single asterisks', () => {
      expect(parseInline('*italic*')).toBe('<em>italic</em>');
    });

    it('should apply bold with double asterisks', () => {
      expect(parseInline('**bold**')).toBe('<strong>bold</strong>');
    });

    it('should apply bold+italic with triple asterisks', () => {
      expect(parseInline('***bold italic***')).toBe('<strong><em>bold italic</em></strong>');
    });

    it('should work with asterisks inside words (different from underscores)', () => {
      // Note: asterisks work differently - this tests current behavior
      expect(parseInline('foo*bar*baz')).toBe('foo<em>bar</em>baz');
    });
  });

  describe('inline code - should preserve underscores', () => {
    it('should preserve underscores in inline code', () => {
      expect(parseInline('`ENV_VAR_NAME`')).toBe('<code>ENV_VAR_NAME</code>');
    });

    it('should preserve underscores in inline code within text', () => {
      expect(parseInline('Set the `MY_CONFIG_VAR` variable')).toBe('Set the <code>MY_CONFIG_VAR</code> variable');
    });
  });

  describe('other inline elements', () => {
    it('should handle strikethrough', () => {
      expect(parseInline('~~deleted~~')).toBe('<del>deleted</del>');
    });

    it('should handle links', () => {
      expect(parseInline('[link](https://example.com)')).toBe('<a href="https://example.com" target="_blank">link</a>');
    });

    it('should handle images', () => {
      // Note: Current implementation has a bug where images are parsed as links
      // This test documents the current behavior
      expect(parseInline('![alt](image.png)')).toBe('!<a href="image.png" target="_blank">alt</a>');
    });
  });

  describe('HTML escaping', () => {
    it('should escape angle brackets', () => {
      // Note: parseInline only escapes &, <, > (not quotes) - this is intentional
      // as quotes don't need escaping in rendered text content
      expect(parseInline('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(parseInline('foo & bar')).toBe('foo &amp; bar');
    });
  });

  describe('complex combinations', () => {
    it('should handle emphasis near code blocks with underscores', () => {
      const input = 'Use `ENV_VAR` and _also_ this';
      expect(parseInline(input)).toBe('Use <code>ENV_VAR</code> and <em>also</em> this');
    });

    it('should handle multiple snake_case identifiers', () => {
      const input = 'Configure MY_VAR and OTHER_VAR for the app';
      expect(parseInline(input)).toBe('Configure MY_VAR and OTHER_VAR for the app');
    });

    it('should handle emphasis with punctuation', () => {
      expect(parseInline('This is _important_!')).toBe('This is <em>important</em>!');
      expect(parseInline('Is it _true_?')).toBe('Is it <em>true</em>?');
    });
  });
});

describe('escapeHtml', () => {
  it('should escape all HTML entities', () => {
    expect(escapeHtml('<div class="test">\'hello\'</div>')).toBe(
      '&lt;div class=&quot;test&quot;&gt;&#039;hello&#039;&lt;/div&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });
});

describe('escapeHtmlInScenario', () => {
  it('should escape basic HTML but not quotes', () => {
    expect(escapeHtmlInScenario('<div class="test">')).toBe('&lt;div class="test"&gt;');
  });
});
