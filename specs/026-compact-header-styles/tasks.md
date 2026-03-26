# Tasks: Compact Header & Callout Styles

**Date:** 2026-03-26

## Phase 1: Style Updates

- [x] **Task 1.1** — Update header sizes and margins in `_typography.css`
  - h1: font-size `2.074rem` → `1.6rem`, margin-bottom `20px` → `14px`
  - h2: font-size `1.35rem` → `1.15rem`, margin `32px 0 12px` → `20px 0 8px`
  - h3: font-size `1.125rem` → `1rem`, margin `20px 0 8px` → `14px 0 6px`
  - h4-h6: margin `16px 0 6px` → `12px 0 4px`

- [x] **Task 1.2** — Apply header color variables in `_typography.css`
  - h1: `color: var(--header-title)` (blue)
  - h2: `color: var(--header-section)` (amber/orange)
  - h3-h6: `color: var(--header-subsection)` (muted gray)

- [x] **Task 1.3** — Reduce callout margins in `_callouts.css`
  - `.callout`: margin `0 0 16px` → `0 0 10px`
  - `details.template-instructions`: margin `var(--space-2) 0 var(--space-4)` → `var(--space-1) 0 var(--space-2)`

- [x] **Task 1.4** — Reduce paragraph spacing between empty content
  - `p + p` margin-top from `var(--space-4)` → `var(--space-2)`
