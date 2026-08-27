# Faithful Bench — Report

Generated from `bench/stats.jsonl`. Each size shows the latest run per mode: **speckit** (plain upstream, no companion, blind) vs **companion** (the SpecKit Companion pipeline + capture). Both modes receive the SAME per-step GUI dispatch preamble, so this is a trustworthy RELATIVE comparison — the **Capture overhead** row isolates time spent journaling from work time. Absolute wall-clock here will NOT match a human's interactive GUI run (agents are far faster); your own GUI runs are the absolute yardstick.

### easy

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | 9m 11s | 8m 38s |
| Capture overhead | 0s | 0s |
| History total | — | 5m 37s |
| · specify | — | 1m 59s |
| · plan | — | 0s |
| · tasks | — | 0s |
| · implement | — | 51s |
| Build | ✓ | ✓ |
| Acceptance | 3/3 | 3/3 |
| Regression | 5/5 | 5/5 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 0 | 0 |
| Quality (rubric) | 5.0/5 (1/3 dims) ⚠︎out-of-range | 5.0/5 (1/3 dims) ⚠︎out-of-range |
| Capture eval | n/a | 19✓/1✗ |
| Spec shape | standard (US) | standard (US) |
| spec.md lines | 51 | 64 |
| plan.md lines | 78 | 4 |
| tasks.md lines | 105 | 6 |
| Artifact files (all) | 7 | 6 |
| Artifact total lines | 329 | 150 |
| Task count | 4 | 3 |
| Side files | research.md, data-model.md, quickstart.md, checklists | checklists |
| Files changed | 2 | 2 |
| LOC (+/−) | +2/−2 | +2/−2 |
| **Overall (health)** | 75 | 94 |
| · vs speckit | base | ▲+19 |
| · vs last run | = | = |

### medium

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | 21m 7s | 23m 12s |
| Capture overhead | 0s | 2s |
| History total | — | 17m 35s |
| · specify | — | 2m 12s |
| · plan | — | 2m 50s |
| · tasks | — | 2m 30s |
| · implement | — | 6m 42s |
| Build | ✓ | ✓ |
| Acceptance | 13/13 | 12/12 |
| Regression | 17/17 | 14/15 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 0 | 0 |
| Quality (rubric) | 5.0/5 | 5.0/5 |
| Capture eval | n/a | 15✓/0✗ |
| Spec shape | standard (US) | standard (US) |
| spec.md lines | 108 | 98 |
| plan.md lines | 81 | 50 |
| tasks.md lines | 181 | 94 |
| Artifact files (all) | 8 | 8 |
| Artifact total lines | 561 | 458 |
| Task count | 16 | 15 |
| Side files | research.md, data-model.md, quickstart.md, contracts, checklists | research.md, data-model.md, checklists |
| Files changed | 8 | 8 |
| LOC (+/−) | +222/−4 | +203/−5 |
| **Overall (health)** | 75 | 92 |
| · vs speckit | base | ▲+17 |
| · vs last run | ▲+1 | ▼-8 |

- **speckit rubric:** A small pure src/lib/dueDate.ts (todayISODate/isOverdue/sortByDueDate) plus a setDueDate action on the existing todos store keeps the feature clear, convention-perfect, and confined to exactly the files the ask requires.
- **companion rubric:** A minimal, well-named change: a pure src/lib/dueDate.ts (todayLocal/isOverdue/sortByDueDate) feeding a prop-driven date input and Overdue badge, a setDueDate action on the existing todos store slice that persists through storage.ts unchanged, a page-local sort toggle, and co-located tests that query by role/label with no invented test ids and nothing touched beyond the ask.

### hard

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | 15m 1s | 21m 27s |
| Capture overhead | 0s | 1s |
| History total | — | 16m 43s |
| · specify | — | 2m 40s |
| · plan | — | 1m 55s |
| · tasks | — | 1m 2s |
| · implement | — | 7m 46s |
| Build | ✓ | ✓ |
| Acceptance | 9/9 | 12/12 |
| Regression | 5/5 | 20/20 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 0 | 0 |
| Quality (rubric) | 4.7/5 | 4.7/5 |
| Capture eval | n/a | 15✓/0✗ |
| Spec shape | standard (US) | standard (US) |
| spec.md lines | 120 | 115 |
| plan.md lines | 96 | 56 |
| tasks.md lines | 153 | 101 |
| Artifact files (all) | 7 | 9 |
| Artifact total lines | 578 | 523 |
| Task count | 15 | 18 |
| Side files | research.md, data-model.md, quickstart.md, checklists | research.md, data-model.md, contracts, checklists |
| Files changed | 12 | 14 |
| LOC (+/−) | +312/−35 | +519/−37 |
| **Overall (health)** | 73 | 96 |
| · vs speckit | base | ▲+23 |
| · vs last run | ▼-2 | ▼-4 |

- **speckit rubric:** Clean, idiomatic implementation that mirrors the existing store/storage/presentational-component layering with no scope creep; the only real gap is that no co-located tests were added for the new tags surface (deliberately skipped per tasks.md), plus a little duplicated pill-style code between TagFilter and TodoItem.
- **companion rubric:** A clean, idiomatic implementation that mirrors the existing todos slice exactly and touches nothing unrelated, losing a scope point only for unrequested extras (case-insensitive duplicate-tag rejection, cascade unassignment, legacy tagIds migration).

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
- `easy-speckit` → speckit/easy · build ✓ · acceptance 3/3 · capture n/a · 9m 11s
- `easy-companion` → companion/easy · build ✓ · acceptance 3/3 · capture 19✓/1✗ · 8m 38s
- `medium-speckit` → speckit/medium · build ✓ · acceptance 13/13 · capture n/a · 21m 7s
- `medium-companion` → companion/medium · build ✓ · acceptance 12/12 · capture 15✓/0✗ · 23m 12s
- `hard-speckit` → speckit/hard · build ✓ · acceptance 9/9 · capture n/a · 15m 1s
- `hard-companion` → companion/hard · build ✓ · acceptance 12/12 · capture 15✓/0✗ · 21m 27s
