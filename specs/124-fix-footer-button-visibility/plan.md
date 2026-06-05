# Implementation Plan: Fix Footer Button Visibility

**Branch**: `124-fix-footer-button-visibility` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/124-fix-footer-button-visibility/spec.md`

## Summary

The spec viewer footer (and step tabs) must be a deterministic function of the spec's true persisted state, not an artifact of which controls were clicked. Root cause is not the visibility rules themselves — those already live in one deterministic catalog (`footerActions.ts`). The defect is that the footer reads from **two parallel state objects** (`navState` and `viewerState`) that are refreshed by **two different messages with different completeness**, plus **three render paths** chosen at runtime by which object happens to be populated. After any footer/lifecycle action (or external disk change), only a *partial* `navState` is re-sent, so the footer mixes a fresh `viewerState` (button catalog, status) with a stale `navState` (the `isGenerating` short-circuit and run-step gating) → still-valid buttons vanish or expected buttons fail to appear.

Technical approach (clean + simple): make **one authoritative snapshot drive the entire footer**. Consolidate every footer-relevant field onto the already-canonical `ViewerState` (derived solely from `.spec-context.json`), have the webview footer read **only** `viewerState`, delete the legacy `navState`-driven fallback path and the multi-source status fallback chain, and emit a **complete** payload from a **single shared builder** on every refresh path so no message is ever partial. Determinism then holds by construction.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); Preact + `@preact/signals` (webview); Webpack 5
**Storage**: `.spec-context.json` per spec dir (single source of truth for workflow state)
**Testing**: Jest + ts-jest; VS Code API mocked via `tests/__mocks__/vscode.ts`; Storybook visual baseline for footer components (`FooterActions.stories.tsx`)
**Target Platform**: VS Code ≥ 1.84.0 (extension host + webview)
**Project Type**: VS Code extension (extension side `src/` + webview side `webview/src/`)
**Performance Goals**: footer/tabs reflect an external state change within 2 s (SC-004); no new polling — reuse existing file watchers
**Constraints**: extension isolation (no `.claude/**` / `.specify/**` runtime deps); footer must not regress the documented `docs/viewer-states.md` button matrix; generating-state UX + 10-min recovery timeout preserved
**Scale/Scope**: spec viewer footer action buttons + step tabs; ~6 source files + tests + 1 story + docs

No `NEEDS CLARIFICATION` — this is a fix within a known subsystem; the target behavior is the existing `docs/viewer-states.md` matrix (Assumptions in spec).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Extensibility & Configuration | PASS — change is internal to the spec-viewer feature; no provider/workflow contract changes. Dynamic Approve label still derives from the active workflow's step ordering. |
| II. Spec-Driven Workflow | PASS — reinforces the canonical lifecycle by making the footer reflect the true persisted status deterministically; no status vocabulary change. |
| III. Visual & Interactive | PASS — the entire fix is in service of a trustworthy, predictable GUI. |
| IV. Modular Architecture | PASS — keeps the modular footer split (`FooterActions` / `CatalogFooter` / `GeneratingFooter`) and the extension/webview separation; net effect removes a redundant render branch (simpler, more modular). |

**Initial gate: PASS** (no violations; Complexity Tracking left empty).
**Post-design re-check: PASS** — design removes state sources rather than adding any; no new dependency, no new persisted field beyond relocating existing fields onto `ViewerState`.

## Project Structure

### Documentation (this feature)

```text
specs/124-fix-footer-button-visibility/
├── plan.md              # This file
├── research.md          # Phase 0 — root cause + decisions
├── data-model.md        # Phase 1 — footer state entities + invariants
├── quickstart.md        # Phase 1 — manual verification across pause stages
├── contracts/
│   ├── footer-state-contract.md   # webview payload + single-source invariant
│   └── footer-button-matrix.md    # true-state → button-set mapping (the oracle)
└── tasks.md             # Phase 2 — created by /speckit.tasks (NOT here)
```

### Source Code (repository root)

```text
src/features/spec-viewer/
├── footerActions.ts          # Deterministic action catalog (visibleWhen) — already the oracle; unchanged rules
├── stateDerivation.ts        # deriveViewerState() — ADD run-step/generating fields to the derived ViewerState
├── stepArtifact.ts           # hasNonTrivialArtifact() — reused unchanged
├── specViewerProvider.ts     # Extract ONE payload builder; both refresh paths emit a COMPLETE viewerState
│                             #   - sendContentUpdateMessage()  (contentUpdated path)
│                             #   - refreshContextIfDisplaying() (viewerStateUpdated path) ← currently partial
└── types.ts                  # message + (core) ViewerState type updates

src/core/types/specContext.ts # ViewerState interface — add run-step/generating fields

webview/src/spec-viewer/
├── components/FooterActions.tsx         # Read footer state from viewerState ONLY; drop the legacy fallback branch + 4-source status chain
├── components/footer/CatalogFooter.tsx  # Stays the single lifecycle/step render path
├── components/footer/GeneratingFooter.tsx # Source generating fields from viewerState
├── components/FooterActions.stories.tsx # Update/extend stories for the consolidated states
├── navigation.ts                        # Step-tab classes — confirm they derive from the same snapshot (US3)
├── signals.ts                           # viewerState signal becomes the footer's sole input
├── index.tsx                            # Message handling — guarantee no message leaves the footer reading a stale/partial snapshot
└── types.ts                             # mirror ViewerState/message type changes

tests/
└── features/spec-viewer/                # unit tests: determinism (same state → same buttons), each pause stage, generating revert, external-change refresh

docs/viewer-states.md                    # Update the footer state-source description to the single-source model
```

**Structure Decision**: Existing VS Code-extension layout (extension `src/` + webview `webview/src/`). The fix is localized to the spec-viewer feature; no new modules — it removes a redundant state source and a redundant render path.

## Complexity Tracking

> No constitution violations — section intentionally empty.
