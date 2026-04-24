# Tasks: Fix Step Chip Contrast

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-24

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Bump `.step-tab.current` fill mix and add outer accent glow — `webview/styles/spec-viewer/_navigation.css` | R001, R002, R003, R004
  - **Do**: In the `.step-tab.current` rule (currently lines 97–101), change `color-mix(in srgb, var(--accent, #4a9eff) 15%, transparent)` to `22%`, and add a second shadow layer alongside the inset ring: `box-shadow: inset 0 0 0 2px var(--accent, #4a9eff), 0 0 0 1px color-mix(in srgb, var(--accent, #4a9eff) 25%, transparent);`
  - **Verify**: `npm run compile` passes; webpack rebuilds the bundled CSS without errors.
  - **Leverage**: existing `color-mix(in srgb, var(--accent, …) X%, transparent)` pattern already used on line 98.
