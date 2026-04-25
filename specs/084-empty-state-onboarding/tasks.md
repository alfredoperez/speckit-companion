# Tasks: Empty-State Onboarding Card

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-25

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Rewrite the zero-spec welcome view contents — `package.json` | R001, R002, R003, R006
  - **Do**: In `package.json`, locate the `viewsWelcome` entry whose `when` is `"speckit.detected && !speckit.constitutionNeedsSetup"` (currently `"Build features with specs\n\n[$(plus) Create New Spec](command:speckit.create)"`). Replace its `contents` value with a multi-paragraph markdown string containing: a headline ("Welcome to SpecKit"), a one-sentence description of what specs do, a primary button `[$(plus) Create your first spec](command:speckit.create)`, and a docs link `[$(book) Read the docs](https://github.com/alfredoperez/speckit-companion#readme)`. Use `\n\n` between paragraphs/buttons (matching the pattern already used in the constitution-needs-setup entry on the line above).
  - **Verify**: `npm run compile` passes. Press F5 to launch the Extension Development Host, open an initialized SpecKit workspace with no specs, and confirm: headline + description show, both buttons render, "Create your first spec" launches the create flow, "Read the docs" opens the README in the browser, and once a spec exists the welcome view disappears.
  - **Leverage**: `package.json` line ~99 — the existing `constitutionNeedsSetup` welcome entry already uses `\n\n` between two action links; mirror that pattern.
