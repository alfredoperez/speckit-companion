# Tasks: Update Extension Docs & Marketplace Images

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-20

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Write README — hero, value prop, and Features section — `README.md`
  - **Do**: Rewrite the top of README.md: keep badges, add 2-3 sentence value prop (from blog article), hero image placeholder (`docs/screenshots/hero.png`), then a `## Features` section with subsections: Visual Workflow Editor, Inline Review Comments, Spec-Driven Phases (Specify → Plan → Tasks → Done), Sidebar at a Glance, Custom Workflows & Commands teaser. Each subsection gets 1-2 sentences + screenshot placeholder.
  - **Verify**: README renders cleanly in VS Code markdown preview with proper heading hierarchy

- [x] **T002** Write README — Getting Started and AI Providers *(depends on T001)* — `README.md`
  - **Do**: Add `## Getting Started` with 3 concise steps (install → open sidebar → create spec). Add `## Supported AI Providers` with the feature comparison table (keep existing table content, update if needed).
  - **Verify**: Getting Started is ≤10 lines, table renders correctly

- [x] **T003** Write README — Configuration section *(depends on T002)* — `README.md`
  - **Do**: Add `## Configuration` with subsections: `### Custom Workflows` (updated examples using `actionOnly` instead of `includeRelatedDocs`, add `specDirectories` setting), `### Custom Commands` (keep existing, minor updates), `### Step Properties` (updated table with `actionOnly`, remove `includeRelatedDocs`). Remove all stale `includeRelatedDocs` references.
  - **Verify**: No occurrences of `includeRelatedDocs` in README. `actionOnly` and `specDirectories` documented with examples.

- [x] **T004** Write README — Development, Acknowledgments, License *(depends on T003)* — `README.md`
  - **Do**: Add `## Development` (keep existing setup/build instructions), `## Acknowledgments`, `## License`. Trim workspace structure section to essentials.
  - **Verify**: `npm run compile` command documented, full README renders end-to-end

- [x] **T005** Capture screenshots (manual) — `docs/screenshots/`
  - **Do**: Manually capture and save: `hero.png` (sidebar + workflow editor), `create-spec.png` (create dialog), `inline-comments.png` (review comments), `sidebar-overview.png` (all sidebar sections). Update existing: `specify-spec.png`, `specify-plan.png`, `specify-tasks.png`, `other-views.png`.
  - **Verify**: All image paths referenced in README resolve to actual files in `docs/screenshots/`

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T005 | [x] |
