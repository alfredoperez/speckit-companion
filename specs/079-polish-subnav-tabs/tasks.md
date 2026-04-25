# Tasks: Polish Subnav Tabs

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-24

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Update related-tab base, hover, and active styles — `webview/styles/spec-viewer/_navigation.css` | R001, R002, R003, R004
  - **Do**: In the "Related Documents Tabs" section (lines ~183–205), rewrite the three rule blocks:
    - `.related-tab`: change `color: var(--text-muted)` → `color: var(--text-secondary)`; add `border-radius: var(--radius-sm)`; keep `border-bottom: 2px solid transparent` so the underline slot reserves space and prevents layout shift.
    - `.related-tab:hover`: leave as-is (`color: var(--text-primary)` + `background: var(--bg-hover)`).
    - `.related-tab.active`: add `background: color-mix(in srgb, var(--accent, #4a9eff) 18%, transparent)`; set `color: var(--text-primary)`; change `font-weight: 500` → `font-weight: 600`; keep `border-bottom-color: var(--accent)` so the underline sits flush to the pill bottom.
  - **Verify**: `npm run compile` passes. Open the spec viewer on a Plan with related sub-docs (Data Model / Quickstart / Research) — the active tab shows an accent-tinted pill with bold text and accent underline; inactives are `--text-secondary` and gain `--bg-hover` on hover; switching tabs causes no layout shift.
  - **Leverage**: `.step-tab.current` rule in the same file (lines ~97–103) — uses `color-mix(in srgb, var(--accent, #4a9eff) 22%, transparent)` for its pill fill; this task uses 18% to keep the secondary nav level visually quieter than the primary step chips.
