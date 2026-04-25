# Tasks: Sticky Header & Responsive TOC

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-25

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** [P] Slugify h1–h3 and emit `id` attributes — `webview/src/spec-viewer/markdown/renderer.ts` | R002
  - **Do**: In the heading branch (around line 213–227), add a `slugify(text)` helper (lowercase, non-alnum → `-`, collapse repeats, trim leading/trailing `-`) plus a per-render `Map<string, number>` to suffix collisions (`heading`, `heading-2`, `heading-3`). For `level <= 3`, emit `<h${level} id="${slug}">`. Keep `wrapWithLineActions` for h3+. Reset the collision map at the start of each render call.
  - **Verify**: `npm run compile` passes; rendered HTML for a doc with two `## Notes` headings produces `id="notes"` and `id="notes-2"`.
  - **Leverage**: existing `parseInline` import pattern at top of `renderer.ts`.

- [x] **T002** [P] Create TOC sidebar styles — `webview/styles/spec-viewer/_toc.css` | R003, R004, R005, R006, NFR002, NFR004
  - **Do**: New partial defining `aside.spec-toc` (flex item, `flex: 0 0 220px`, `position: sticky; top: 0`, `align-self: flex-start`, internal `overflow-y: auto`, max-height `calc(100vh - var(--space-4))`). List styling: `.spec-toc-list` removes bullets; `.spec-toc-link` muted color, padding `4px 8px`, border-left transparent. H3 entries indented (`.spec-toc-link--h3 { padding-left: var(--space-4); }`). Active state: `.spec-toc-link[aria-current="location"]` uses `var(--accent)` text + `border-left-color: var(--accent)`. Hidden state: `.content-area--narrow .spec-toc, .spec-toc--empty { display: none; }`. Define `--toc-min-width: 780px;` on `:root`. Add focus-visible outline.
  - **Verify**: `npm run compile` passes; visual inspection in dev host shows the sidebar pinned at the top of its column.

- [x] **T003** [P] Make `.content-area` a flex row container — `webview/styles/spec-viewer/_base.css` | R001, R003, NFR001
  - **Do**: Update `.content-area` (lines ~46–51) to `display: flex; flex-direction: row; gap: var(--space-6); align-items: flex-start;` while preserving `flex: 1; overflow-y: auto; padding: var(--content-padding); scroll-behavior: smooth;`. The markdown column keeps its width via `#markdown-content`'s existing `max-width: 72ch; margin: 0 auto;` rule. No new selector needed for the markdown wrapper — `#markdown-content` becomes a flex item directly.
  - **Verify**: Dev host shows TOC + markdown side by side on wide panes; markdown stays centered up to 72ch.

- [x] **T004** [P] Adjust `.spec-header` for lifted-header layout — `webview/styles/spec-viewer/_content.css` | R001, R006
  - **Do**: In the "Structured Header" block (lines ~197–238), drop `max-width: 72ch; margin: 0 auto var(--space-4);` from `.spec-header` since it now lives outside the column-constrained content area. Replace with `margin: 0; padding: var(--space-3) var(--content-padding); border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg-primary);`. Replace the `.spec-header[data-has-context="true"] ~ #markdown-content h1:first-of-type` sibling selector with a body-attribute hook: `body[data-has-spec-context="true"] #markdown-content h1:first-of-type { display: none; }`. Keep the inner `.spec-header-badges`, `.spec-header-main`, `.spec-header-title`, `.spec-header-doctype`, `.spec-header-branch`, `.spec-header-date` rules unchanged.
  - **Verify**: Dev host shows the header pinned above the scroll region with the same badge/branch/date treatment; first markdown H1 is suppressed when context is present.

- [x] **T005** [P] Register `_toc.css` in the partial index — `webview/styles/spec-viewer/index.css` | R002
  - **Do**: Add `@import '_toc.css';` after `@import '_content.css';` (line ~13).
  - **Verify**: Webpack build picks up the partial; `.spec-toc` styles apply in dev host.

- [x] **T006** [P] TOC builder + observers module — `webview/src/spec-viewer/toc.ts` | R002, R003, R004, R005, NFR002, NFR003, NFR004
  - **Do**: New module exporting `buildToc(scrollRoot: HTMLElement, markdownRoot: HTMLElement, tocRoot: HTMLElement): void`. Implementation:
    1. Tear down any prior `IntersectionObserver` / `ResizeObserver` stored on `tocRoot.dataset.observers` (use a module-level `WeakMap<HTMLElement, { io: IntersectionObserver; ro: ResizeObserver }>`).
    2. Query `markdownRoot.querySelectorAll('h2[id], h3[id]')`. If empty, set `tocRoot.classList.add('spec-toc--empty')` and return.
    3. Render `<ul class="spec-toc-list">` with `<li><a class="spec-toc-link spec-toc-link--h${level}" href="#${id}">${textContent}</a></li>` per heading.
    4. Wire click handlers on each link: `event.preventDefault()`, find target by `id`, call `target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })`, set `aria-current="location"` on the clicked link.
    5. Attach `IntersectionObserver` with `{ root: scrollRoot, rootMargin: '-10% 0px -70% 0px', threshold: 0 }`. Callback: track the topmost intersecting heading, update `aria-current` on the matching link.
    6. Attach `ResizeObserver` to `scrollRoot`. On resize, read `--toc-min-width` from `getComputedStyle(document.documentElement)`, parse to px, and toggle `scrollRoot.classList.toggle('content-area--narrow', scrollRoot.clientWidth < threshold)`.
    7. Helper `prefersReducedMotion()` reads `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
  - **Verify**: `npm run compile` passes; unit smoke test (or dev-host inspection) confirms rebuild on each call replaces prior observers.
  - **Leverage**: existing webview module shape from `webview/src/spec-viewer/actions.ts` (single-export setup pattern).

- [x] **T007** [P] Document the new TOC module + lifted-header layout — `docs/architecture.md`
  - **Do**: Add `webview/src/spec-viewer/toc.ts` to the spec-viewer module list with a one-line description. Update the layout description: header is now a sibling of `.compact-nav` (above `.content-area`), and `.content-area` is a flex row holding `aside.spec-toc` + `#markdown-content`. Mention `_toc.css` in the CSS partials list.
  - **Verify**: File reads cleanly; layout description matches App.tsx structure.

- [x] **T008** Restructure App layout (lift header + add TOC aside) *(depends on T002, T003, T004, T006)* — `webview/src/spec-viewer/App.tsx` | R001, R002, R004, R006
  - **Do**: Move `<SpecHeader />` from inside `<main class="content-area">` to between `<StaleBanner />` and `<main>` so it sits as a sibling of `.compact-nav` and stays pinned by the column flex layout. Inside `<main class="content-area" id="content-area">`, render `<aside class="spec-toc" id="spec-toc" aria-label="Table of contents"></aside>` followed by the existing `<div id="markdown-content" ref={contentRef} ... />`. Add a `useEffect` that mirrors `navState.value.specContextName || badgeText`-presence to `document.body.dataset.hasSpecContext = 'true' | 'false'` so the lifted-header H1 suppression rule (T004) can fire.
  - **Verify**: Dev host: header stays pinned at the top while scrolling; TOC and markdown render side-by-side; `<body data-has-spec-context="true">` toggles correctly when `navState` updates.
  - **Leverage**: existing `useEffect` pattern at the top of `App.tsx` for `content-rendered` event.

- [x] **T009** Wire `buildToc` into the update flow *(depends on T006, T008)* — `webview/src/spec-viewer/index.tsx` | R002, R005, scenario "Switching between core docs"
  - **Do**: Import `buildToc` from `./toc`. Inside `updateContent` (lines ~39–48), after the existing `requestAnimationFrame` callback, call `buildToc(scrollRoot, markdownRoot, tocRoot)` where `scrollRoot = document.getElementById('content-area')`, `markdownRoot = document.getElementById('markdown-content')`, `tocRoot = document.getElementById('spec-toc')` — guard each lookup. Also call once at the end of `init()` after the initial `updateContent(initialContent.dataset.raw)` block (the rAF in `updateContent` will already have fired by then because `buildToc` is invoked inside its callback). This rebuilds the TOC on every doc switch (spec → plan → tasks → related).
  - **Verify**: Switching tabs in dev host rebuilds the TOC anchors to match the active document; active-section indicator resyncs after switch.

---

## Phase 2: Polish (optional)

- [ ] **T010** Add a manual TOC collapse toggle *(depends on T008)* — `webview/src/spec-viewer/components/SpecHeader.tsx` + `_toc.css` | R007 (MAY)
  - **Do**: Skip unless explicitly requested — R007 is MAY. If pursued, add a small chevron button in the header that toggles `.content-area--toc-collapsed` on the scroll root; CSS hides `.spec-toc` when that class is present and the pane is wide enough that it would otherwise show.
  - **Verify**: Toggle hides/shows the TOC without affecting the responsive width-class logic.
