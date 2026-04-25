# Spec: Sticky Header & Responsive TOC

**Slug**: 085-sticky-header-toc | **Date**: 2026-04-25

## Summary

Long specs are painful to navigate today — the spec viewer's title/badge header scrolls away with the content, and there is no outline to jump between sections. Pin the header so it stays visible while reading, and add a sidebar table of contents (per issue #108) that auto-hides on narrow viewports so the main content remains readable.

## Requirements

- **R001** (MUST): The spec viewer header (`.spec-header` — title, badge, branch, date) stays pinned at the top of the scrolling content region while the user scrolls the markdown body.
- **R002** (MUST): A table-of-contents sidebar lists every H2 and H3 heading in the rendered markdown as anchor links; clicking a link scrolls the heading into view.
- **R003** (MUST): The TOC is hidden when the viewer's available width drops below the responsive threshold, so the main content keeps its readable column width on narrow editor splits.
- **R004** (MUST): When visible, the TOC itself sticks to the top of its column so the outline stays in view as the user scrolls the spec.
- **R005** (SHOULD): The TOC highlights the heading currently in view (active-section indicator) using scroll position.
- **R006** (SHOULD): The pinned header preserves its current visual treatment (badge color, branch chip, doctype label) without overlapping or clipping the first markdown heading.
- **R007** (MAY): Users can collapse/show the TOC manually via a toggle button on viewports where it would otherwise render.

## Scenarios

### Scrolling a long spec on a wide editor

**When** the user opens a >300-line spec in a wide editor pane and scrolls the content
**Then** the spec header remains visible at the top of the content region, the TOC remains visible on the side, and the active heading in the TOC updates as new sections enter the viewport.

### Resizing the editor pane below the TOC threshold

**When** the user drags the editor split or sidebar so the viewer's available width falls under the responsive threshold
**Then** the TOC hides and the markdown content reflows to use the full column width; the sticky header stays pinned.

### Resizing back above the threshold

**When** the user widens the editor pane back above the threshold
**Then** the TOC reappears in its sticky column and the active-heading state resyncs with the current scroll position.

### Spec with no H2/H3 headings

**When** the rendered markdown contains no H2 or H3 headings (e.g., a stub spec or short note)
**Then** the TOC column is suppressed entirely (regardless of width) and the content uses the full column.

### Anchor click navigation

**When** the user clicks a TOC link
**Then** the corresponding heading scrolls into view (smooth scroll honored when `prefers-reduced-motion` is not set), and the clicked link becomes the active item.

### Switching between core docs (spec → plan → tasks)

**When** the user switches the active document via the navigation bar
**Then** the TOC rebuilds from the new document's headings and the sticky header continues to reflect the current document's badge/title.

## Non-Functional Requirements

- **NFR001** (MUST): Layout shifts caused by toggling the TOC visibility do not introduce visible jank — the markdown column reflows once on resize, not on every scroll event.
- **NFR002** (SHOULD): TOC links are keyboard-navigable and the active link is announced to assistive tech via `aria-current="location"`.
- **NFR003** (SHOULD): Active-heading detection uses an `IntersectionObserver` rather than a per-scroll listener to keep scrolling smooth on long specs.
- **NFR004** (MAY): The responsive threshold is expressed as a single CSS custom property / media query so it can be tuned without code changes.

## Out of Scope

- Adding a TOC to the spec **editor** view (this spec covers the **viewer** only).
- Persisting user-toggled TOC collapse state across sessions.
- Auto-numbering of headings or rewriting heading anchors.
- Outline support for related documents beyond the current core/related document model.
- Mobile/touch-specific TOC affordances (the extension targets desktop VS Code).
