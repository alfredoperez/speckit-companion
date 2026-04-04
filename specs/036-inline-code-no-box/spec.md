# Spec: Inline Code Without Boxes

**Slug**: 036-inline-code-no-box | **Date**: 2026-04-04

## Summary

Remove the boxed appearance (background, border, border-radius) from inline code highlights across all webviews. Inline code should render as a simple text highlight — colored monospace text without a surrounding box or pill shape.

## Requirements

- **R001** (MUST): Inline code (`<code>` not inside `<pre>`) must render without a visible border
- **R002** (MUST): Inline code must render without a background fill or box shape
- **R003** (MUST): Inline code must retain monospace font and distinct color for readability
- **R004** (MUST): Code blocks (`<pre><code>`) must be unaffected by this change
- **R005** (MUST): File reference pills (`.file-ref`) must be unaffected — they intentionally use a pill/box style

## Scenarios

### Inline code in spec viewer

**When** a spec contains inline code like `getChildren()` in paragraphs or list items
**Then** it renders as colored monospace text without background, border, or border-radius

### Inline code in task descriptions

**When** a task description in the workflow view contains inline code references
**Then** it renders as colored monospace text without a box

### Code blocks remain unchanged

**When** a spec contains fenced code blocks
**Then** they retain their existing styled container with background and border

## Out of Scope

- File reference pill styling (`.file-ref`) — intentionally boxed
- Code block (`pre`) styling changes
- Syntax highlighting changes
