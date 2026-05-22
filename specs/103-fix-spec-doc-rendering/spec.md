# Spec: Fix Spec Document Rendering (CRLF + Frontmatter)

**Slug**: 103-fix-spec-doc-rendering | **Date**: 2026-05-22

## Summary

The spec viewer's markdown renderer fails on two kinds of speckit-generated
document content. (1) On Windows and Windows-mounted dev-containers, files
checked out with CRLF line endings render entirely as raw text — headings show a
literal `#`, `---` shows literally, lists don't form — because the renderer's
block-level regexes are `$`-anchored and JavaScript's `.` does not match `\r`.
(2) On every platform, the leading YAML frontmatter block (`---\ndescription:
"…"\n---`) that spec-kit writes leaks into the rendered output as a stray
horizontal rule + paragraph + horizontal rule. This fix normalizes line endings
and strips leading frontmatter at the single renderer chokepoint, before any
preprocessor runs.

## Requirements

- **R001** (MUST): `renderMarkdown` MUST normalize CRLF (`\r\n`) and lone CR (`\r`) to LF (`\n`) before any preprocessing or line splitting, so CRLF-checked-out documents render identically to LF documents.
- **R002** (MUST): A leading YAML frontmatter block — an opening `---` on the first line, arbitrary lines, and a closing `---` — MUST be stripped from the document before rendering, so it does not appear as content.
- **R003** (MUST): Frontmatter stripping MUST only apply to a block at the very start of the document (after optional leading blank lines). A `---` used later as a thematic break (horizontal rule) MUST still render as `<hr>`.
- **R004** (SHOULD): Normalization MUST run before the existing preprocessors (`preprocessHtmlComments`, `preprocessSpecMetadata`, etc.) so their `\n`-based regexes also see clean input.
- **R005** (SHOULD): The spec-kit tasks.md `## Format:` legend (the block explaining the `[ID] [P?] [Story] Description` notation) MUST be stripped before rendering, since it is authoring scaffolding, not reader content. Only that section (heading through the line before the next heading) is removed; surrounding sections are untouched.

## Scenarios

### CRLF document renders correctly

**When** a spec/plan/tasks document whose text uses `\r\n` line endings is opened in the viewer
**Then** headings, horizontal rules, ordered/unordered lists, and tables render as formatted HTML (no literal `#`, `---`, or `-` prefixes), identical to the LF rendering

### Leading YAML frontmatter is hidden

**When** a document begins with `---\ndescription: "…"\n---` (spec-kit frontmatter)
**Then** the frontmatter block produces no visible output — no stray `<hr>`, no `description: …` paragraph — and the first visible element is the document's H1

### Mid-document thematic break still renders

**When** a document contains a `---` line surrounded by blank lines partway through the body (not at the top)
**Then** it renders as a horizontal rule (`<hr>`), unaffected by frontmatter stripping

### Document without frontmatter is unchanged

**When** a document does not start with a `---` block
**Then** rendering output is identical to current behavior (no content is stripped)

### Tasks "## Format:" legend is hidden

**When** a tasks.md contains the spec-kit `## Format: \`[ID] [P?] [Story] Description\`` heading followed by its notation bullets
**Then** that heading and its bullets produce no visible output, while the next section (e.g. `## Path Conventions`) and all task content render normally

## Out of Scope

- Parsing or displaying frontmatter values (description, status, etc.) as structured metadata in the header — frontmatter is simply hidden.
- Changing how `.spec-context.json`-driven metadata is rendered.
- Fixing line endings on disk (e.g., `.gitattributes`); this is a render-time normalization only.
- The shared `webview/src/render/` renderer used elsewhere — this fix targets the spec-viewer renderer that exhibits the bug.
