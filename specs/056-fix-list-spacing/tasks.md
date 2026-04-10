# Tasks: Fix List Item Spacing

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-10

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation

- [x] **T001** Reduce li line-height — `webview/styles/spec-viewer/_typography.css`
  - **Do**: Change `line-height` on `#markdown-content li` from `var(--leading-relaxed)` to `var(--leading-normal)`
  - **Verify**: List items in spec viewer have tighter spacing

- [x] **T002** Zero li.line padding — `webview/styles/spec-viewer/_line-actions.css`
  - **Do**: Add `padding-top: 0; padding-bottom: 0;` to the `li.line` rule to override `.line` padding
  - **Verify**: No extra padding between list items; hover highlight still works

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T002 | [x] |
