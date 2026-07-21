# Implementation Plan: Living Spec Components

## Summary

Render the structures a living spec *repeats* — the draft notice, the purpose callout, requirement cards with confidence and coverage, WHEN/THEN/AND scenario steps, and the uncovered-evidence summary — as recognized components inside the viewer we already ship, so a reader can scan a draft before committing to read it. Feature (non-living) specs and any unrecognized markdown keep rendering exactly as they do today. The work attaches to the webview's existing string-based markdown pipeline (`webview/src/spec-viewer/markdown/renderer.ts` and its `preprocess*` chain), not a new surface: each component is a preprocessor that emits recognized HTML gated to living-spec mode, with a per-region fallback so a failing component hands its region back to the base renderer instead of blanking the page. No new dependency, storage, or product surface — the stack is the project's existing TypeScript + Preact webview and its CSS-partial styling.

## Project Structure

The feature lives entirely in the webview's markdown layer plus one CSS partial. Nothing on the extension side changes; the extension already sends `navState.livingMode` and owns draft detection (`src/features/spec-viewer/livingDocs.ts`, read-only here).

```
webview/src/spec-viewer/
├── markdown/
│   ├── renderer.ts                    # add livingMode gate + setLivingMode(); run living preprocessors only in living mode; register living component classes in the pass-through recognizer
│   ├── livingComponents.ts            # NEW — living-spec preprocessors: draft notice, purpose callout, requirement card, scenario steps, uncovered summary + disclosures; each wrapped for per-region fallback
│   ├── livingComponents.test.ts       # NEW — unit coverage for each preprocessor + fallback + line-identity
│   ├── LivingComponents.stories.tsx   # NEW — enumerated-state stories (FR-023)
│   ├── scenarios.ts                   # feature-spec Given/When/Then (untouched; living WHEN/THEN/AND is separate)
│   └── index.ts                       # export setLivingMode + living preprocessors
├── index.tsx                          # call setLivingMode(navState.livingMode) alongside setHasSpecContext
└── types.ts                           # livingMode already present on NavState
webview/styles/spec-viewer/
├── _living.css                        # NEW — component styles via existing viewer tokens (dark/light/HC/narrow/reduced-motion)
└── index.css                          # @import '_living.css'
```

**Structure Decision**: Follow the pipeline's established "component = preprocessor + recognized class + CSS partial + story" pattern (as used by `preprocessRequirements`, `preprocessTaskPhases`, `parseAcceptanceScenarios`); do not introduce Preact into the document body, because line-comment identity, per-region fallback, and feature-spec byte parity all depend on the existing string-render loop.

## Constitution Check

| Principle | Assessment |
|-----------|------------|
| I. Extensibility and Configuration | **PASS** — additive, gated rendering; no provider or configuration surface touched. Unrecognized markdown falls through, so the set stays open to extension. |
| II. Spec-Driven Workflow | **PASS** — a viewer rendering change only; the Specify→Plan→Tasks→Implement pipeline and lifecycle are untouched. |
| III. Visual and Interactive | **PASS** — this *is* the reading surface; the whole change is visual, inside the existing webview. |
| IV. Modular Architecture for Complex Features | **PASS** — new work is isolated to a focused `livingComponents.ts` module + one CSS partial + a stories file, matching the existing modular markdown layout. |
| AI Provider Integration | **PASS (N/A)** — no provider code involved. |
| User Interface | **PASS** — works inside the viewer we already ship, uses the canonical viewer tokens, adds no new activity-bar view. |

No violations — Complexity Tracking omitted.

## Phase 0 — Research

See `research.md` for the decision record. The load-bearing decisions:

1. **Keep the string-preprocessor pipeline; do not render the body with Preact.** Line-comment `data-line` identity, per-region fallback, and feature-spec byte parity all live in the existing render loop.
2. **Gate on a module-level `livingMode` flag** set before render (mirroring `hasSpecContext`), so feature specs never touch the new code path (SC-001). The webview does not re-derive living-ness — it uses the flag the extension already sends.
3. **Per-component fallback via a `safe()` wrapper** — a throwing preprocessor returns its input region unchanged so the base renderer takes over that region (FR-002, FR-003), instead of one document-wide try/catch.
4. **Requirement card = styled wrapper around still-individual commentable lines**, keyed on the exact `###` heading text, so per-line comment parity survives (FR-005, FR-008).
5. **A new scenario-steps preprocessor for the living WHEN/THEN/AND format**, separate from the feature-spec `parseAcceptanceScenarios` (Given/When/Then), because the authored shape and keywords differ.
6. **Coverage is best-effort** — shown only when the plumbing supplies it, omitted (never zero) otherwise (FR-011, FR-019).

## Phase 1 — Design & Contracts

- `data-model.md` — the parse-model shapes each preprocessor recognizes (Living spec document, Requirement, Scenario, Uncovered evidence entry, Draft marker / purpose) and the determinable-vs-omitted rule for confidence and coverage.
- `contracts/living-components.md` — the render contract: the verbatim input tokens (from the spec's Verbatim Constraints), the emitted CSS class names each component is recognized by, and the `setLivingMode` gating flag that consumers and stories code against.

Constitution re-checked against the final design: unchanged — still all PASS.
