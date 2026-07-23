# Research: Label fast-path folded steps

**Decision**: Derive `folded` in `deriveStepHistory`, not in the renderer.
**Rationale**: The repo's one-fact-one-derivation rule; the derivation already owns spans, trust, and the raw history needed for the adjacency check. A renderer-side threshold would duplicate in every timing surface.
**Alternatives considered**: (a) Threshold check inline in `OverviewTiming` — rejected: second derivation, drifts. (b) Reading `classification.verdict === 'simple'` as the fold signal — rejected: the verdict is advisory AI-written data and old specs lack it; the timestamp signature is deterministic and extension-stamped.

**Decision**: Fold window = 1000ms, applied to both the step's own span and its gap from the previous step's close.
**Rationale**: The fold chain is stamped by consecutive `python3` processes in one hook run — observed gaps are under 350ms (real data: `specs/528-footer-done-guard` plan 82ms / tasks 81ms, gaps ≤83ms) — while any real phase takes multiple seconds. The adjacency requirement stops a sub-second span that happens minutes later (a manual instant re-run) from claiming it was folded into anything.
**Alternatives considered**: Span-only check — rejected: loses the "folded into" semantics for non-adjacent flukes.

**Decision**: `folded` does not require `durationTrusted`.
**Rationale**: A same-instant fold (start == complete) fails the strictly-positive trust rule and renders untrusted, but it is still a fold and must be labeled as one — folded is about provenance, trusted is about measurability.
**Alternatives considered**: Piggybacking on `durationTrusted` — rejected: leaves the same-instant fold showing nothing at all with no explanation.

**Decision**: The fold's close anchor is the step's own extension-stamped complete, not the derived `completedAt`.
**Rationale**: The derived close of a folded tasks step can be the *next* step's start (implement may begin minutes later), which would hide the fold behind idle time. The fold signature is the stamped pair itself.
**Alternatives considered**: Using derived `completedAt` — rejected: `specs/528-footer-done-guard` tasks would read as a 3m29s phase and keep a misleading duration.

**Decision**: Anchor the rendered label to the nearest earlier non-folded phase, computed at render time.
**Rationale**: Tasks folds transitively through the folded Plan; the anchor is the phase that actually did the work (Specify). The walk is a trivial presentation choice over already-derived flags, with exactly one consumer.
**Alternatives considered**: Persisting a `foldedInto` name from the derivation — rejected: widens the schema for a label only one surface renders.

**Decision**: No change to `check_quality.py` (the Python trust-rule mirror), the capture eval, or `PhasesCard`.
**Rationale**: The trust rule is untouched, so parity fixtures stay valid; `folded` has no Python consumer. Folded steps record no substep events, so `PhasesCard` already renders nothing for them — the Run overview strip is the only misleading surface.
