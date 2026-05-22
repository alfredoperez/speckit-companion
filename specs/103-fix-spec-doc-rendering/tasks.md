# Tasks: Fix Spec Document Rendering (CRLF + Frontmatter)

**Plan**: [plan.md](./plan.md)

## Phase 1: Core Implementation

- [x] **T001** Add `stripFrontmatter` preprocessor — `webview/src/spec-viewer/markdown/preprocessors.ts` | R002, R003
  - **Do**: Export `stripFrontmatter(markdown: string): string` that removes a leading YAML frontmatter block matched by `/^\s*---\n[\s\S]*?\n---\s*\n?/` (anchored at document start, after optional blank lines). Return input unchanged when no leading block matches.
  - **Verify**: Unit test — frontmatter at top removed; mid-document `---` and frontmatter-free input returned unchanged.
  - **Leverage**: `preprocessHtmlComments` in the same file (same `markdown.replace` shape).

- [x] **T002** Normalize line endings + strip frontmatter in `renderMarkdown` *(depends on T001)* — `webview/src/spec-viewer/markdown/renderer.ts` | R001, R004
  - **Do**: As the first statements of `renderMarkdown`, add `markdown = markdown.replace(/\r\n?/g, '\n');` then `markdown = stripFrontmatter(markdown);`, before `preprocessHtmlComments`. Add `stripFrontmatter` to the import from `./preprocessors`. Add a brief comment referencing issue #158.
  - **Verify**: `npm run compile` passes; CRLF input renders headings/lists/hr (no literal `#`/`---`).

- [x] **T003** [P] Add renderer tests *(depends on T002)* — `webview/src/spec-viewer/markdown/*.test.ts` | R001, R002, R003
  - **Do**: Cover (a) a CRLF document (`# H\r\n\r\n- item\r\n`) renders `<h1>`/`<li>` not literal text; (b) leading frontmatter stripped — no `description:` paragraph, no leading `<hr>`; (c) mid-document `---` becomes `<hr>`; (d) frontmatter-free document unchanged.
  - **Verify**: `npm test` passes.

- [x] **T004** Strip spec-kit `## Format:` legend *(depends on T002)* — `webview/src/spec-viewer/markdown/preprocessors.ts`, `renderer.ts`, `renderer.test.ts` | R005
  - **Do**: Add `stripTaskFormatLegend()` removing the `## Format:` heading + notation bullets (up to the next heading); call it in `renderMarkdown` after `stripFrontmatter`; add tests covering removal, sibling-section preservation, and no-op when absent.
  - **Verify**: `npm test` passes; legend strip fires on real `specs/097-inline-comment-composer/tasks.md` while `## Path Conventions` survives.
