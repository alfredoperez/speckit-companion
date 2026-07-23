# Implementation Plan: Label fast-path folded steps instead of showing "<1s"

**Branch**: `532-folded-steps-label` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

## Summary

On a fast-path run the extension stamps the plan and tasks lifecycle boundaries back-to-back inside the specify hook run, so those phases carry real-but-meaningless sub-second spans and the Overview's Run overview strip renders `Plan <1s` / `Tasks <1s` — which reads like a bug. The fix derives a `folded` flag once, in `deriveStepHistory` (where spans and trust are already computed), from the deterministic fast-path signature: an extension-stamped step-level start+complete pair within a 1-second window that also sits within 1 second of the previous step's extension-stamped close. The Overview strip then renders "folded into Specify" (anchored to the nearest earlier non-folded phase) with a distinct visual instead of a duration. Timing coverage, elapsed totals, and every non-folded rendering are unchanged.

## Project Structure

```
src/
├── core/types/specContext.ts                 # StepHistoryEntry gains folded?: boolean
└── features/specs/
    ├── stepHistoryDerivation.ts              # derive the folded flag (single derivation)
    └── __tests__/stepHistoryDerivation.test.ts

webview/
├── src/spec-viewer/
│   ├── types.ts                              # mirror folded?: boolean on webview StepHistoryEntry
│   └── components/
│       ├── OverviewDossier.tsx               # OverviewTiming renders the folded note
│       ├── __tests__/OverviewDossier.test.tsx
│       └── ActivityPanel.stories.tsx         # fast-path folded story variant
└── styles/spec-viewer/_overview-dossier.css  # .is-folded / __folded note styling

docs/viewer-states.md                          # timing display semantics
CHANGELOG.md                                   # Unreleased entry
```

**Structure Decision**: extension-side derivation + webview rendering, matching the existing split — the webview renders the state it is given and never re-derives run state (viewer-ui living spec).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new setting; folded detection is built-in default behavior (fast-path is a default, not a toggle). |
| II. Spec-Driven Workflow | PASS — presentation-only change to how recorded lifecycle state renders; the record itself is untouched. |
| III. Visual and Interactive | PASS — replaces a misleading number with an honest label plus a distinct visual state. |
| IV. Modular Architecture | PASS — one derivation in the shared module; consumers read the flag. |

No violations — Complexity Tracking omitted.

## Phase 0 — Research

Decisions and rationale live in [research.md](./research.md).

## Phase 1 — Design

The derived-shape change lives in [data-model.md](./data-model.md). No `contracts/` — the feature exposes no API/CLI surface; the rendering contract is pinned by the component tests (folded note present, `<1s` absent).

Post-design Constitution re-check: unchanged, PASS.
