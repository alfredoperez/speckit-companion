# Phase 0 Research: Trust timing from CLI-only runs

## Decision: express trust as a writer-authority tier, not an equality check

**Decision**: Replace the `by === 'extension'` equality on both boundaries with a two-tier rank — `boundaryWriterRank`: instrumented (`extension`/`cli`/`derive`/`user`) = 2, agent (`ai`) = 1, unrecognized = 0 — and require a step-level start with rank > 0 plus a close with rank > 0 AND rank ≥ the start's rank.

**Rationale**: The reproduction (`specs/407-fold-back-on-complete`, and the hand-authored `specs/535-surface-install-companion`) is a coherent CLI run whose four phases carry ordered `by:ai` step-level start/complete pairs stamped by `write-context.py` — deterministic, ms-precision, ordered — yet the gate rejected them purely on `by`. The current capture model routes every write through a clock-stamping script, so a recognized `by` value already implies a deterministic write; the honest line to draw is on **writer authority + boundary shape**, not on `by == extension`. The tier keeps the one dishonest shape the equality also rejected: an `ai` close cannot finalize an `extension` start (`1 >= 2` is false), so the #509 premature-finish masquerade stays untrusted. An advance-only phase has no start entry, so it never has a `trustedStart` and claims no duration — handled structurally, unchanged.

**Alternatives considered**:
- *Blanket-trust any recognized `by`* — rejected: it would trust the extension-start + premature-`ai`-close masquerade that `stepHistoryDerivation.test.ts` and #509 explicitly keep untrusted.
- *Add a new `by` value / schema field to mark script-stamped writes* — rejected: a schema change for a distinction the existing `by` enum already carries; the writer-authority tier reads it off the values already recorded.
- *Trust only when `start.by === close.by`* — rejected: over-narrow; an `ai` start legitimately closed by an instrumented next-step start (rank 2 ≥ 1) should be trusted, and the equality would drop it.

## Decision: mirror the tier verbatim in the Python eval

**Decision**: Port the same tier and close-authority rule into `check_quality.py`'s `_derive_trusted_spans`, replacing the `TRUSTED_BOUNDARY_BY = "extension"` constant with `_boundary_writer_rank`, and pin it with a parity test in `speckit-extension/tests/test_check_quality.py`.

**Rationale**: The two derivations are a documented drift pair (`.claude/review-checklist.md`, #505). The eval WARNs on untrusted spans; if it kept the strict `extension`-only rule it would flag CLI runs the viewer now trusts, diverging the grade from the display.

**Alternatives considered**: Leaving the eval strict — rejected, it would report a discrepancy the viewer no longer has.

## Finding: traceability is already CLI-friendly

The "X/Y traced" count (`CoverageSection` in `OverviewDossier.tsx`) is `rows.filter(r => r.tests.length > 0)` over `state.coverage`, populated from `--coverage-req --tests` writes. It shares no gating with the timing trust rule, so it already populates for any CLI run that recorded coverage. No code change; documented as FR-006 to prevent a future "fix" that wrongly couples them.
