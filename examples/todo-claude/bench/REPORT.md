# Adoption-Ladder Bench — Report

Generated from `bench/stats.jsonl`. Each size shows the latest run per variant: **speckit** (plain, no companion) → **companion-logs** (capture, same commands) → **companion-standard** (standard preset) → **companion-turbo** (lean) → **companion-fast-path** (turbo + fast-path).

### easy

| Metric | speckit | companion-logs | companion-standard | companion-turbo | companion-fast-path |
|---|---|---|---|---|---|
| Wall-clock | — | — | — | — | — |
| History total | 15m 3s | 15m 11s | 14m 39s | 13m 52s | 6m 47s |
| · specify | 5m 18s | 5m 14s | 1m 30s | 31s | 31s |
| · plan | 2m 34s | 2m 24s | 1m 53s | 55s | 0s |
| · tasks | 58s | 1m 20s | 1m 21s | 1m 3s | 0s |
| · implement | 3m 12s | 3m 26s | 2m 57s | 2m 47s | 1m 22s |
| Build | ✓ | ✓ | ✓ | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| Regression | 5/5 | 6/6 | 5/5 | 5/5 | 5/5 |
| Conventions | ✓ | ✓ | ✓ | ✓ | ✓ |
| Out-of-scope files | 0 | 0 | 0 | 0 | 0 |
| Quality (rubric) | 5.0/5 | 4.7/5 | 5.0/5 | 5.0/5 | 5.0/5 |
| Capture eval | n/a | 14✓/0✗ | 14✓/0✗ | 14✓/0✗ | 17✓/0✗ |
| Spec shape | standard (US) | standard (US) | standard (US) | lean (no US) | lean (no US) |
| spec.md lines | 54 | 53 | 56 | 26 | 34 |
| plan.md lines | 75 | 73 | 71 | 41 | 0 |
| tasks.md lines | 123 | 123 | 125 | 38 | 0 |
| Artifact files (all) | — | — | — | — | — |
| Artifact total lines | — | — | — | — | — |
| Task count | 6 | 6 | 7 | 5 | 0 |
| Side files | research.md, data-model.md, quickstart.md | research.md, data-model.md, quickstart.md, contracts | research.md, data-model.md, quickstart.md | — | — |
| Files changed | 2 | 3 | 2 | 2 | 2 |
| LOC (+/−) | +2/−2 | +17/−2 | +2/−2 | +2/−2 | +2/−2 |
| **Overall (health)** | 75 | 98 | 100 | 100 | 100 |
| · vs speckit | base | ▲+23 | ▲+25 | ▲+25 | ▲+25 |
| · vs last run | — | — | — | — | — |

- **speckit rubric:** Clean exact rename touching only the header <h1>, the <title>, and the matching App.test.tsx expectation, with the precise text 'Task Manager' and zero out-of-scope churn.
- **companion-logs rubric:** Clean exact rename of the h1 and <title> with the App.test.tsx assertion updated to match; only minor scope creep is an added Header.test.tsx that the prompt's pure rename didn't require, though CLAUDE.md endorses co-located tests.
- **companion-standard rubric:** Clean exact rename: only Header.tsx <h1> and index.html <title> changed to "Task Manager", with zero out-of-scope edits or churn.
- **companion-turbo rubric:** Clean pure rename hitting exactly the two required targets — Header <h1> and <title> — with no extra files, no churn, and no missed edits.
- **companion-fast-path rubric:** Clean pure rename touching only the header <h1>, the <title>, and the matching test expectation, with no out-of-scope files or churn.

### medium

| Metric | speckit | companion-logs | companion-standard | companion-turbo | companion-fast-path |
|---|---|---|---|---|---|
| Wall-clock | — | — | — | — | — |
| History total | 10m 41s | 18m 11s | 18m 1s | 15m 2s | 6m 25s |
| · specify | 2m 25s | 2m 26s | 1m 36s | 1m 50s | 2m 23s |
| · plan | 2m 39s | 3m 1s | 2m 59s | 1m 10s | 0s |
| · tasks | 1m 25s | 1m 49s | 2m 27s | 51s | 0s |
| · implement | — | 7m 32s | 8m 4s | 4m 24s | 3m 18s |
| Build | ✓ | ✓ | ✓ | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| Regression | 27/27 | 31/31 | 30/30 | 15/15 | 9/9 |
| Conventions | ✓ | ✓ | ✓ | ✓ | ✓ |
| Out-of-scope files | 2 | 2 | 2 | 2 | 0 |
| Quality (rubric) | 5.0/5 | 5.0/5 | 5.0/5 | 5.0/5 | 5.0/5 |
| Capture eval | n/a | 15✓/0✗ | 15✓/0✗ | 14✓/0✗ | 17✓/0✗ |
| Spec shape | standard (US) | standard (US) | standard (US) | lean (no US) | lean (no US) |
| spec.md lines | 102 | 106 | 103 | 33 | 49 |
| plan.md lines | 82 | 87 | 87 | 50 | 0 |
| tasks.md lines | 189 | 174 | 182 | 44 | 0 |
| Artifact files (all) | — | — | — | — | — |
| Artifact total lines | — | — | — | — | — |
| Task count | 17 | 16 | 16 | 11 | 0 |
| Side files | research.md, data-model.md, quickstart.md, contracts | research.md, data-model.md, quickstart.md, contracts | research.md, data-model.md, quickstart.md, contracts | — | — |
| Files changed | 10 | 9 | 10 | 9 | 6 |
| LOC (+/−) | +314/−4 | +333/−1 | +305/−4 | +221/−4 | +152/−4 |
| **Overall (health)** | 75 | 100 | 100 | 100 | 100 |
| · vs speckit | base | ▲+25 | ▲+25 | ▲+25 | ▲+25 |
| · vs last run | — | — | — | — | — |

- **speckit out-of-scope:** lib/dueDate.test.ts, lib/dueDate.ts
- **speckit rubric:** Pure date helpers in lib/dueDate.ts, due-date state through the reducer/store with persistence via the existing save effect, presentational components, exact test ids, co-located tests, and zero out-of-scope churn.
- **companion-logs out-of-scope:** lib/dueDate.test.ts, lib/dueDate.ts
- **companion-logs rubric:** All three requirements met exactly via the existing store reducer (new setDueDate action persists through lib/storage automatically) with pure helpers extracted to lib/dueDate.ts, exact test ids, co-located tests, and no out-of-scope files.
- **companion-standard out-of-scope:** lib/dates.test.ts, lib/dates.ts
- **companion-standard rubric:** All three requirements met with verbatim test ids; due-date state flows through a store reducer action and persists via the existing storage useEffect, derived overdue/sort logic is isolated in a pure lib/dates.ts, components stay presentational, and no out-of-scope files were touched.
- **companion-turbo out-of-scope:** lib/dates.test.ts, lib/dates.ts
- **companion-turbo rubric:** All three requirements met with idiomatic implementation: dueDate state flows through the store reducer/useTodos, persistence rides the existing lib/storage useEffect, components stay prop-driven, test ids match verbatim, overdue logic is factored into a shared lib/dates, and changes stay strictly in-scope with well-targeted co-located tests.
- **companion-fast-path rubric:** Persisted due-date state flows through the todos reducer/store and the existing lib/storage save path with verbatim test ids; the sort toggle is correctly transient local state, no out-of-scope files, all requirements met.

### hard

| Metric | speckit | companion-logs | companion-standard | companion-turbo | companion-fast-path |
|---|---|---|---|---|---|
| Wall-clock | — | — | — | — | — |
| History total | 28m 30s | 24m 22s | 28m 45s | 14m 48s | 14m 12s |
| · specify | 3m 38s | 4m 41s | 4m 17s | 1m 43s | 1m 45s |
| · plan | 3m 32s | 4m 14s | 4m 5s | 58s | 1m 8s |
| · tasks | 2m 30s | 1m 54s | 1m 45s | 56s | 1m 5s |
| · implement | 10m 13s | 6m 8s | 10m 45s | 6m 24s | 5m 49s |
| Build | ✓ | ✓ | ✓ | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| Regression | 28/28 | 19/19 | 25/25 | 17/17 | 13/13 |
| Conventions | ✓ | ✓ | ✓ | ✓ | ✓ |
| Out-of-scope files | 0 | 0 | 0 | 0 | 0 |
| Quality (rubric) | 5.0/5 | 5.0/5 | 5.0/5 | 5.0/5 | 5.0/5 |
| Capture eval | n/a | 14✓/0✗ | 14✓/0✗ | 14✓/0✗ | 14✓/0✗ |
| Spec shape | standard (US) | standard (US) | standard (US) | lean (no US) | lean (no US) |
| spec.md lines | 126 | 112 | 114 | 38 | 39 |
| plan.md lines | 95 | 93 | 89 | 52 | 60 |
| tasks.md lines | 213 | 159 | 185 | 44 | 42 |
| Artifact files (all) | — | — | — | — | — |
| Artifact total lines | — | — | — | — | — |
| Task count | 22 | 18 | 18 | 12 | 12 |
| Side files | research.md, data-model.md, quickstart.md, contracts | research.md, data-model.md, quickstart.md, contracts | research.md, data-model.md, quickstart.md, contracts | — | — |
| Files changed | 14 | 13 | 14 | 12 | 11 |
| LOC (+/−) | +621/−32 | +416/−13 | +536/−12 | +464/−28 | +405/−28 |
| **Overall (health)** | 75 | 100 | 100 | 100 | 100 |
| · vs speckit | base | ▲+25 | ▲+25 | ▲+25 | ▲+25 |
| · vs last run | — | — | — | — | — |

- **speckit rubric:** Textbook execution: a tags store slice mirroring todos.tsx (reducer+context+hook) persisting both tags and assignments through lib/storage.ts, a /tags route + page + nav Link, presentational components with all exact testids, and zero out-of-scope churn.
- **companion-logs rubric:** Textbook implementation: a new tags store slice mirroring todos.tsx (pure extracted reducer, context, hook), persistence solely through lib/storage with tags and assignments both saved/restored, all required test ids and affordances met including cascade-on-remove and filter-revert, presentational components untouched-in-spirit, and zero out-of-scope churn.
- **companion-standard rubric:** Idiomatic tags store slice mirroring todos.tsx (reducer+context+hook), persistence of both tags and assignments through lib/storage.ts, full route/nav/page wiring, exact test ids, and no out-of-scope churn.
- **companion-turbo rubric:** Idiomatic new tags store slice mirroring todos.tsx, all persistence (tags + assignments, with cascade-on-remove) through lib/storage.ts, full route/nav/page/component wiring, verbatim test ids, and tightly-scoped edits with no out-of-scope churn.
- **companion-fast-path rubric:** A faithful clone of the todos store slice (reducer+context+hook, lib/storage persistence) that also persists assignments and cascade-removes them, with a presentational TagFilter, all required test ids verbatim, full requirement coverage, and zero out-of-scope churn.

## All runs

- `easy-speckit` → speckit/easy · build ✓ · acceptance 1/1 · capture n/a · —
- `easy-companion-logs` → companion-logs/easy · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-companion-standard` → companion-standard/easy · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-companion-turbo` → companion-turbo/easy · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `easy-companion-fast-path` → companion-fast-path/easy · build ✓ · acceptance 1/1 · capture 17✓/0✗ · —
- `medium-speckit` → speckit/medium · build ✓ · acceptance 1/1 · capture n/a · —
- `medium-companion-logs` → companion-logs/medium · build ✓ · acceptance 1/1 · capture 15✓/0✗ · —
- `medium-companion-standard` → companion-standard/medium · build ✓ · acceptance 1/1 · capture 15✓/0✗ · —
- `medium-companion-turbo` → companion-turbo/medium · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `medium-companion-fast-path` → companion-fast-path/medium · build ✓ · acceptance 1/1 · capture 17✓/0✗ · —
- `hard-speckit` → speckit/hard · build ✓ · acceptance 1/1 · capture n/a · —
- `hard-companion-logs` → companion-logs/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `hard-companion-standard` → companion-standard/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `hard-companion-turbo` → companion-turbo/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
- `hard-companion-fast-path` → companion-fast-path/hard · build ✓ · acceptance 1/1 · capture 14✓/0✗ · —
