# Implementation Plan: Complete the ICE capture

**Feature**: 386-ice-capture · **Spec**: [spec.md](./spec.md) · **Source issue**: [#399](https://github.com/alfredoperez/speckit-companion/issues/399)

## Summary

Add `--context` to the capture writer (a de-duped string list cloning the expectations pattern) and move requirement-title emission to specify time (the existing `--coverage-req --title` mechanism, emitted per FR the moment the requirements are written). Declare `context` in the schema and both ViewerState copies with a safe derivation passthrough. Pure additive plumbing; the panel rendering is #400.

## Project Structure

```
speckit-extension/scripts/write-context.py     # --context flag → append_string_list('context', …)
speckit-extension/nodes/specify/draft-spec.md  # emit per-FR titled coverage after drafting FRs
speckit-extension/nodes/specify/finalize.md    # emit --context entries (living specs, areas, constraints)
speckit-extension/tests/test_capture_fields.py # context + specify-title cases
src/core/types/{specContext.ts,spec-context.schema.json}
src/features/spec-viewer/stateDerivation.ts (+ __tests__)
webview/src/spec-viewer/types.ts
docs/{capture-and-timing.md,spec-context-schema.md} · speckit-extension/CHANGELOG.md
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility | **PASS** — additive, opt-in-by-emission, provider-agnostic. |
| II. Spec-Driven Workflow | **PASS** — enriches specify's capture; no lifecycle change. |
| III. Visual & Interactive | **PASS (deferred)** — data lands where #400 renders it. |
| IV. Modular Architecture | **PASS** — helpers reuse the shipped patterns verbatim. |

No violations (re-checked after design).

## Key Decisions

- **`context[]` = plain strings** via `append_string_list` — readable list beats a premature taxonomy; a structured consumer can motivate `{kind, ref}` later.
- **Requirement titles ride coverage** at specify — one traceability home, title-only entries already legal/tested; a parallel `requirements[]` would drift.
- **Emission split**: titles in `draft-spec` (right after the FRs exist), context in `finalize` (after living-specs load + investigation are known).
