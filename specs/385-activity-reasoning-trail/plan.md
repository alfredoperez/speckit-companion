# Implementation Plan: Activity panel renders the reasoning trail

**Feature**: 385-activity-reasoning-trail · **Spec**: [spec.md](./spec.md) · **Source issue**: [#397](https://github.com/alfredoperez/speckit-companion/issues/397)

## Summary

Read-side follow-up to the capture work: normalize the new reasoning-trail fields in the viewer's state derivation (fixing the regression where structured decisions are filtered out entirely), mirror them onto both `ViewerState` copies, and render them in the Activity panel — richer Decisions entries, a new Intent card (goal + out-of-scope), a new Verified card, a new Coverage card with a covered/total rollup, and a classification line in the Approach card. Everything degrades to today's output when the fields are absent.

## Project Structure

```
src/core/types/specContext.ts                 # ViewerState (core): normalized decision/verified/coverage/intent/expectations/classification
src/features/spec-viewer/stateDerivation.ts   # normalizers: decisions (string|object), verified, coverage, intent, expectations, classification
src/features/spec-viewer/__tests__/stateDerivation.test.ts   # normalization cases
webview/src/spec-viewer/types.ts              # ViewerState (webview mirror): same fields
webview/src/spec-viewer/components/
├── ActivityPanel.tsx                         # compose IntentCard/VerifiedCard/CoverageCard; hasAnyData gains the new fields
└── cards/
    ├── DecisionsCard.tsx (+ .stories.tsx)    # render why/rejected detail
    ├── ApproachCard.tsx                      # classification line (verdict · projected inputs)
    ├── IntentCard.tsx (+ .stories.tsx)       # NEW — goal + expectations fence
    ├── VerifiedCard.tsx (+ .stories.tsx)     # NEW — what/result/command/warnings
    └── CoverageCard.tsx (+ .stories.tsx)     # NEW — per-req tasks/tests + rollup
webview/styles/spec-viewer/                   # reuse existing activity-card partial classes (no new partial expected)
README.md · docs/spec-context-schema.md       # Reading Specs blurb + "viewer renders these" note
```

**Structure Decision**: one card component per field family, mirroring the existing card-per-concern layout; normalization lives in the extension-side derivation so the webview stays a dumb renderer.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | **PASS** — read-side rendering; no provider or config surface. |
| II. Spec-Driven Workflow | **PASS** — surfaces pipeline data; no lifecycle change. |
| III. Visual and Interactive | **PASS** — the whole feature is a visual surface for captured data. |
| IV. Modular Architecture | **PASS** — card-per-concern modules; derivation separate from rendering; stories per card. |

No violations. (Re-checked after design: still PASS.)

## Key risks

- **Two ViewerState copies** (core + webview) must stay in sync — same field names/shapes on both.
- **Injection safety**: all user strings render as JSX text nodes (Preact escapes); never build HTML strings or interpolate into attributes.
- **`hasAnyData`** must learn the new fields or a spec with only intent/verified would show "No activity recorded yet".
