# Implementation Plan: Living specs render readably in the viewer

**Feature**: 392-living-specs-viewer · [spec.md](./spec.md) · size: normal

## Summary

The viewer state's living-specs slice grows from two name lists into per-capability content: a new extension-side loader resolves each touched capability through the Spec Explorer's existing config reader, reads its spec file (size-capped, best-effort), and parses the living-spec document shape the fold-back writer itself emits (`### <heading>` requirement blocks under `## Requirements`, intro paragraph as the purpose). The provider enriches the derived state with that content — derivation stays pure — and the card renders per-capability open disclosures with requirement rows, keeping the folded-back tag and adding delta counts parsed from the feature spec's delta blocks. Verification is fixtures-only: Storybook payloads carry the rich/sparse/unavailable states, and a committed demo spec exercises the graceful names-plus-unavailable path in the real viewer (this repo deliberately has no living-specs config, so the rich path is Storybook's job).

## Project Structure

```
src/features/spec-viewer/
├── livingSpecsContent.ts              # NEW: resolve + read + parse capability content; delta summary from feature spec
├── __tests__/livingSpecsContent.test.ts  # NEW: parse/degrade/cap/delta cases (tmp-dir fixtures)
└── specViewerProvider.ts              # enrich derived viewerState.livingSpecs with content
src/features/specs/livingSpecsModel.ts # reused as-is (readLivingSpecs, isPathWithinRoot)
src/core/types/specContext.ts          # LivingSpecsView gains capabilities[] (extension copy)
webview/src/spec-viewer/types.ts       # mirrored LivingSpecsView change
webview/src/spec-viewer/components/cards/
├── LivingSpecsCard.tsx                # per-capability disclosures; names-only fallback preserved
└── LivingSpecsCard.stories.tsx        # rich / sparse / unavailable payloads
webview/styles/spec-viewer/_activity.css  # capability disclosure + requirement row styles
specs/_03_demo-living/                 # NEW committed fixture: names-only livingSpecs in the real viewer
README.md · CHANGELOG.md
```

**Structure Decision**: content loading is a new single-purpose module beside the other provider-side readers; the pure derivation and the model reader are reused untouched.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — reads the existing living-specs config through the existing reader; no new settings. |
| II. Spec-Driven Workflow | PASS — run as a Companion pipeline spec with full capture. |
| III. Visual and Interactive | PASS — extends the Activity panel in its established design language. |
| IV. Modular Architecture | PASS — new loader module + card change; webview receives pre-parsed structured data only. |
| AI Provider Integration | PASS — untouched. |
| User Interface | PASS — token-driven, text-node rendering, absent-when-empty preserved. |

No violations. Re-checked after Phase 1 design: still PASS — the design adds one impure loader at the provider seam and keeps `deriveViewerState` pure.
