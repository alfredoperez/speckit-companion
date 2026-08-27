# Faithful Bench — Report

Generated from `bench/stats.jsonl`. Each size shows the latest run per mode: **speckit** (plain upstream, no companion, blind) vs **companion** (the SpecKit Companion pipeline + capture). Both modes receive the SAME per-step GUI dispatch preamble, so this is a trustworthy RELATIVE comparison — the **Capture overhead** row isolates time spent journaling from work time. Absolute wall-clock here will NOT match a human's interactive GUI run (agents are far faster); your own GUI runs are the absolute yardstick.

### easy

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | 10m 37s | 4m 47s |
| Capture overhead | 0s | 2s |
| History total | 8m 5s | 3m 16s |
| · specify | 3m 14s | 1m 50s |
| · plan | 1m 35s | 0s |
| · tasks | 1m 1s | 0s |
| · implement | — | 23s |
| Build | ✓ | ✓ |
| Acceptance | 3/3 | 2/2 |
| Regression | 5/5 | 4/5 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 0 | 0 |
| Quality (rubric) | 5.0/5 | 4.3/5 |
| Capture eval | n/a | 19✓/0✗ |
| Spec shape | standard (US) | standard (US) |
| spec.md lines | 70 | 53 |
| plan.md lines | 75 | 2 |
| tasks.md lines | 126 | 5 |
| Artifact files (all) | 7 | 6 |
| Artifact total lines | 352 | 138 |
| Task count | 4 | 2 |
| Side files | research.md, data-model.md, quickstart.md, checklists | checklists |
| Files changed | 2 | 1 |
| LOC (+/−) | +2/−2 | +1/−1 |
| **Overall (health)** | 75 | 77 |
| · vs speckit | base | ▲+2 |
| · vs last run | = | ▼-17 |

- **speckit rubric:** The rename touches exactly the two places the app documents as owning the title (the Header <h1> and index.html's <title>) plus the co-located App test's role/name assertion, with no stray refactors, new files, or invented surface.
- **companion rubric:** Both user-visible surfaces were renamed with clean, minimal, verbatim edits and nothing extra was touched, but the co-located App.test.tsx still asserts the level-1 heading is 'Todo App', so the change ships a failing test suite.

### medium

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | 9m 55s | 17m |
| Capture overhead | 0s | 1s |
| History total | — | 13m 44s |
| · specify | — | 1m 50s |
| · plan | — | 1m 48s |
| · tasks | — | 43s |
| · implement | — | 5m 6s |
| Build | ✓ | ✓ |
| Acceptance | 12/12 | 12/12 |
| Regression | 28/28 | 14/14 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 1 | 0 |
| Quality (rubric) | 5.0/5 | 4.7/5 |
| Capture eval | n/a | 15✓/0✗ |
| Spec shape | standard (US) | standard (US) |
| spec.md lines | 102 | 92 |
| plan.md lines | 83 | 38 |
| tasks.md lines | 170 | 89 |
| Artifact files (all) | 7 | 8 |
| Artifact total lines | 503 | 424 |
| Task count | 18 | 11 |
| Side files | research.md, data-model.md, quickstart.md, checklists | research.md, data-model.md, checklists |
| Files changed | 11 | 6 |
| LOC (+/−) | +316/−5 | +166/−5 |
| **Overall (health)** | 75 | 96 |
| · vs speckit | base | ▲+21 |
| · vs last run | = | ▲+4 |

- **speckit out-of-scope:** components/SortToggle.tsx
- **speckit rubric:** Clean, minimal implementation: a pure dueDate helper module, a nullable dueDate on the Todo type with a setDueDate reducer action persisting through the existing storage layer, a prop-driven SortToggle and aria-labelled date input, co-located role/label-based tests, and no changes beyond the ask.
- **companion rubric:** A tight, well-named implementation that adds dueDate to the type, a setDueDate action in the existing store slice, an aria-labelled date input and Overdue badge in TodoItem, and a memoized page-level sort toggle, with no stray edits; only minor readability nits (the inline today-string construction and the pure isOverdue helper living in a component file, plus a slightly dense sort comparator) keep it from full marks.

### hard

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | 15m | 17m 24s |
| Capture overhead | — | 1s |
| History total | — | 15m 56s |
| · specify | — | 2m 6s |
| · plan | — | 1m 41s |
| · tasks | — | 56s |
| · implement | — | 7m 5s |
| Build | ✓ | ✓ |
| Acceptance | 11/11 | 13/13 |
| Regression | 28/28 | 21/23 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 0 | 0 |
| Quality (rubric) | 4.3/5 | 4.7/5 |
| Capture eval | n/a | 15✓/0✗ |
| Spec shape | standard (US) | standard (US) |
| spec.md lines | 113 | 118 |
| plan.md lines | 92 | 56 |
| tasks.md lines | 199 | 158 |
| Artifact files (all) | 8 | 9 |
| Artifact total lines | 623 | 562 |
| Task count | 26 | 22 |
| Side files | research.md, data-model.md, quickstart.md, contracts, checklists | research.md, data-model.md, contracts, checklists |
| Files changed | 16 | 20 |
| LOC (+/−) | +651/−17 | +642/−37 |
| **Overall (health)** | 71 | 92 |
| · vs speckit | base | ▲+21 |
| · vs last run | ▼-2 | ▼-4 |

- **speckit rubric:** A textbook implementation that follows every documented convention — a tags store slice mirroring todos.tsx, persistence through lib/storage, prop-driven components, co-located role/label-based tests — with only minor blemishes: copy-pasted inline button styles in TagFilterBar/TodoItem, an FR-id comment, an isTagAssigned helper used only by a test harness, and a few invented behaviors (case-insensitive duplicate rejection, filter fallback) beyond the ask.
- **companion rubric:** A clean, idiomatic implementation that follows every documented convention (tags store slice, storage helpers, presentational components, co-located role-query tests) with no changes beyond the feature, docked only slightly for the degenerate all | string filter type, the pill-button styling duplicated in TagFilterBar instead of reusing TagBadgeToggle, and the untested TagsPage.

## All runs

- `easy-companion-logs` → companion-logs/easy · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-companion-standard` → companion-standard/easy · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-companion-turbo` → companion-turbo/easy · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-companion-fast-path` → companion-fast-path/easy · build ✓ · acceptance 1/1 · capture 17✓/0✗ · —
- `medium-companion-logs` → companion-logs/medium · build ✓ · acceptance 1/1 · capture 15✓/0✗ · —
- `medium-companion-standard` → companion-standard/medium · build ✓ · acceptance 1/1 · capture 15✓/0✗ · —
- `medium-companion-turbo` → companion-turbo/medium · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `medium-companion-fast-path` → companion-fast-path/medium · build ✓ · acceptance 1/1 · capture 17✓/0✗ · —
- `hard-companion-logs` → companion-logs/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `hard-companion-standard` → companion-standard/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `hard-companion-turbo` → companion-turbo/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `hard-companion-fast-path` → companion-fast-path/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-speckit` → speckit/easy · build ✓ · acceptance 3/3 · capture n/a · 10m 37s
- `easy-companion` → companion/easy · build ✓ · acceptance 2/2 · capture 19✓/0✗ · 4m 47s
- `medium-speckit` → speckit/medium · build ✓ · acceptance 12/12 · capture n/a · 9m 55s
- `medium-companion` → companion/medium · build ✓ · acceptance 12/12 · capture 15✓/0✗ · 17m
- `hard-speckit` → speckit/hard · build ✓ · acceptance 11/11 · capture n/a · 15m
- `hard-companion` → companion/hard · build ✓ · acceptance 13/13 · capture 15✓/0✗ · 17m 24s
