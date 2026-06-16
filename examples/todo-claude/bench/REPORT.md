# Faithful Bench — Report

Generated from `bench/stats.jsonl`. Each size shows the latest run per mode: **speckit** (plain upstream, no companion, blind) vs **companion** (the SpecKit Companion pipeline + capture). Both modes receive the SAME per-step GUI dispatch preamble, so this is a trustworthy RELATIVE comparison — the **Capture overhead** row isolates time spent journaling from work time. Absolute wall-clock here will NOT match a human's interactive GUI run (agents are far faster); your own GUI runs are the absolute yardstick.

### easy

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | — | — |
| Capture overhead | — | — |
| History total | 15m 3s | — |
| · specify | 5m 18s | — |
| · plan | 2m 34s | — |
| · tasks | 58s | — |
| · implement | 3m 12s | — |
| Build | ✓ | — |
| Acceptance | 1/1 | — |
| Regression | 5/5 | — |
| Conventions | ✓ | — |
| Out-of-scope files | 0 | — |
| Quality (rubric) | 5.0/5 | — |
| Capture eval | n/a | — |
| Spec shape | standard (US) | — |
| spec.md lines | 54 | — |
| plan.md lines | 75 | — |
| tasks.md lines | 123 | — |
| Artifact files (all) | — | — |
| Artifact total lines | — | — |
| Task count | 6 | — |
| Side files | research.md, data-model.md, quickstart.md | — |
| Files changed | 2 | — |
| LOC (+/−) | +2/−2 | — |
| **Overall (health)** | 75 | — |
| · vs speckit | base | — |
| · vs last run | — | — |

- **speckit rubric:** Clean exact rename touching only the header <h1>, the <title>, and the matching App.test.tsx expectation, with the precise text 'Task Manager' and zero out-of-scope churn.

### medium

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | — | — |
| Capture overhead | — | — |
| History total | 17m 17s | 9m 9s |
| · specify | 1m 37s | 2m 41s |
| · plan | 4m 6s | 0s |
| · tasks | 2m 13s | 4s |
| · implement | 7m 43s | 6m 24s |
| Build | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 |
| Regression | 23/23 | 12/12 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 1 | 0 |
| Quality (rubric) | 4.8/5 | 5.0/5 |
| Capture eval | n/a | 18✓/0✗ |
| Spec shape | standard (US) | lean (no US) |
| spec.md lines | 104 | 41 |
| plan.md lines | 84 | 4 |
| tasks.md lines | 186 | 10 |
| Artifact files (all) | 8 | 4 |
| Artifact total lines | 646 | 89 |
| Task count | 19 | 7 |
| Side files | research.md, data-model.md, quickstart.md, contracts, checklists | checklists |
| Files changed | 11 | 7 |
| LOC (+/−) | +273/−4 | +183/−4 |
| **Overall (health)** | 74 | 100 |
| · vs speckit | base | ▲+26 |
| · vs last run | ▼-1 | — |

- **speckit out-of-scope:** components/SortToggle.tsx
- **speckit rubric:** Clean naming, pure injectable helpers in lib/dueDate.ts, verbatim test-ids, and thorough co-located tests; feature-only scope with no churn. State follows the store-slice pattern; the sort toggle uses local useState (defensible as view-local ephemeral state, a slight nuance vs. the 'cross-component state → store slice' convention).
- **companion rubric:** Clear naming and a small pure isOverdue helper; state correctly lives in the todos store slice with a setDueDate action, components stay presentational, and all three test-ids match verbatim. Touched only the files the feature needs, added co-located tests, and left index.html and unrelated code untouched.

### hard

| Metric | speckit | companion |
|---|---|---|
| Wall-clock | — | — |
| Capture overhead | — | — |
| History total | 15m 24s | 12m 46s |
| · specify | 1m 41s | 1m 48s |
| · plan | 3m 49s | 1m 28s |
| · tasks | 1m 54s | 1m 11s |
| · implement | 5m 23s | 6m 6s |
| Build | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 |
| Regression | 23/23 | 16/16 |
| Conventions | ✓ | ✓ |
| Out-of-scope files | 0 | 0 |
| Quality (rubric) | 5.0/5 | 4.7/5 |
| Capture eval | n/a | 15✓/0✗ |
| Spec shape | standard (US) | lean (no US) |
| spec.md lines | 110 | 38 |
| plan.md lines | 95 | 66 |
| tasks.md lines | 187 | 46 |
| Artifact files (all) | 9 | 4 |
| Artifact total lines | 624 | 184 |
| Task count | 21 | 13 |
| Side files | research.md, data-model.md, quickstart.md, contracts, checklists | checklists |
| Files changed | 12 | 13 |
| LOC (+/−) | +493/−8 | +425/−33 |
| **Overall (health)** | 75 | 98 |
| · vs speckit | base | ▲+23 |
| · vs last run | = | — |

- **speckit rubric:** Clean, well-named reducer/context slice mirroring todos.tsx with co-located tests and verbatim test ids; persistence flows through lib/storage and the route/nav/store-slice convention is followed exactly. Only feature-relevant files changed (index.html, types, storage untouched), baseline behavior preserved; TodoItem reaching into the store directly is a minor but consistent pattern stretch.
- **companion rubric:** Tags store cleanly mirrors the todos slice (reducer + context + storage persistence) with a thorough, behavior-focused test suite and verbatim test ids; only ding is TodoItem swapping the Todo domain type for an inline structural shape. Scope is tight — storage.ts, todos.tsx, and unrelated files are untouched and existing behavior is preserved.

## All runs

- `easy-speckit` → speckit/easy · build ✓ · acceptance 1/1 · capture n/a · —
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
- `medium-speckit` → speckit/medium · build ✓ · acceptance 1/1 · capture n/a · —
- `medium-companion` → companion/medium · build ✓ · acceptance 1/1 · capture 18✓/0✗ · —
- `hard-speckit` → speckit/hard · build ✓ · acceptance 1/1 · capture n/a · —
- `hard-companion` → companion/hard · build ✓ · acceptance 1/1 · capture 15✓/0✗ · —
