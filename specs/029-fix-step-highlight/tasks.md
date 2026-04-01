# Tasks: Fix Step Highlight for Completed Steps

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-01

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add CSS rules for completed+viewing state — `webview/styles/spec-viewer/_navigation.css` | R001, R003
  - **Do**: Add `.step-tab.viewing.exists` compound selector with green-tinted highlight: `border: 2px solid var(--success)`, `background: color-mix(in srgb, var(--success) 15%, transparent)`. Add `.step-tab.viewing.exists .step-status` with `box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 30%, transparent)`, keeping green background/border. Add `.step-tab.viewing.exists .step-label` with `color: var(--text-primary)` and `font-weight: 700`. Place these rules AFTER the `.step-tab.viewing` rules so they override.
  - **Verify**: Open a spec with completed steps, click on each — completed steps show green highlight, incomplete show purple
  - **Leverage**: Existing `.step-tab.viewing` rules (line ~86) and `.step-tab.exists` rules (line ~75) as pattern reference

---

## Progress

- Phase 1: T001 [x]
