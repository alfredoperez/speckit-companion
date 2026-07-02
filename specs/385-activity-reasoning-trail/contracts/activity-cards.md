# Contract: Activity panel cards & writer flag

Identifiers tests, stories, and the emitting body code against.

## Writer (spec-kit extension)

- `--coverage-req <id> --title "<text>"` — upserts `coverage.<id>.title` non-destructively (composes with `--tasks`/`--tests` in any order/calls).
- Emission point: tasks completion — `--coverage-req FR-001 --title "…" --tasks "T001,…"` (one call per requirement).

## Cards (webview)

| Card | Component | Section class | Absent when |
|---|---|---|---|
| Intent | `IntentCard` | `activity-card--intent` | no `intent` and no `expectations` |
| Decisions (changed) | `DecisionsCard` | `activity-card--decisions` | no decisions after normalization |
| Verified | `VerifiedCard` | `activity-card--verified` | no verifications |
| Coverage | `CoverageCard` | `activity-card--coverage` | no coverage rows |
| Approach (changed) | `ApproachCard` | unchanged | classification line only when `classification` present |

- Panel order (post-critique, why-first): Intent → Approach → Decisions → Phases → LivingSpecs → Tasks → Verified → Coverage → Concerns → Comments → Files.
- Coverage header rollup: `Coverage (covered/total)` where covered = row with ≥1 test.
- All user strings render as JSX text nodes; `title`-attribute tooltips set via JSX props only.
- `hasAnyData` additionally returns true for: `intent`, `expectations`, `verified`, `coverage`.

## Derivation (extension side)

`deriveViewerState` outputs the normalized shapes in `data-model.md`; new pickers: `pickDecisions`, `pickVerified`, `pickCoverage`, plus `intent`/`expectations`/`classification` passthroughs with type guards.
