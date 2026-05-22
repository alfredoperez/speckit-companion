# Plan: Fix Spec Document Rendering (CRLF + Frontmatter)

**Spec**: [spec.md](./spec.md)

## Approach

Add two normalization steps at the top of `renderMarkdown` (the single entry
point in `webview/src/spec-viewer/markdown/renderer.ts`), running before the
existing preprocessor chain: (1) replace `\r\n?` with `\n` to normalize line
endings, and (2) strip a leading YAML frontmatter block via a small new
preprocessor. Doing both at the chokepoint means every downstream regex
(preprocessors + the main line loop) sees clean LF input with no frontmatter,
so no other code needs to change.

## Files to Change

### Modify

- `webview/src/spec-viewer/markdown/renderer.ts` — at the start of `renderMarkdown`, normalize line endings (`markdown = markdown.replace(/\r\n?/g, '\n')`) and call the new frontmatter stripper, before `preprocessHtmlComments`. Import the new preprocessor.
- `webview/src/spec-viewer/markdown/preprocessors.ts` — add `stripFrontmatter(markdown: string): string` (removes a leading `---\n…\n---` block, leaving mid-document `---` untouched) and `stripTaskFormatLegend(markdown: string): string` (removes the spec-kit `## Format:` notation legend section, up to the next heading).

### Tests

- `webview/src/spec-viewer/markdown/*.test.ts` — add cases: CRLF document renders headings/lists/hr correctly; leading frontmatter is stripped; mid-document `---` still becomes `<hr>`; document without frontmatter is unchanged.

## Notes

- Frontmatter regex anchored at start, e.g. `/^\s*---\n[\s\S]*?\n---\s*\n?/`. Run it after CRLF normalization so it only deals with `\n`.
- Keep the change confined to the spec-viewer renderer; the shared `render/` pipeline is out of scope (it didn't exhibit the bug and isn't on this path).
